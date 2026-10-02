package com.medstack.app.agent

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import com.medstack.app.security.SecureStore
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

// A sealed, local asset hosts Pi. No external pages, navigation, cookies or JS network.
@SuppressLint("SetJavaScriptEnabled")
class MobilePiEngine(context: Context, private val userId: String, private val authorized: () -> Boolean, private val completed: (JSONObject) -> Unit) {
    private val vault = SecureStore(context)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val main = Handler(Looper.getMainLooper())
    private var closed = false
    private var running = false
    private var calls = 0
    private var activeCall: Call? = null
    private val ledger = ArrayDeque<Long>()
    private val client = OkHttpClient.Builder().connectTimeout(12,TimeUnit.SECONDS).readTimeout(90,TimeUnit.SECONDS).callTimeout(90,TimeUnit.SECONDS).followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false).build()
    private val web = WebView(context)
    private var ready = false
    private var startupError = ""
    private var queued: JSONObject? = null
    private val asset = context.assets.open("pi/agent.js").bufferedReader().use { it.readText() }
    init {
        web.settings.javaScriptEnabled = true
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = false
        web.settings.domStorageEnabled = false
        web.settings.blockNetworkLoads = true
        web.addJavascriptInterface(Bridge(), "NativePi")
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?) = true
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse = WebResourceResponse("text/plain","UTF-8",ByteArrayInputStream(ByteArray(0)))
            override fun onPageFinished(view: WebView?, url: String?) {
                if (closed) return
                web.evaluateJavascript(asset) {
                    web.evaluateJavascript("typeof globalThis.MedstackPi === 'object'") { supported ->
                        if(closed) return@evaluateJavascript
                        ready=supported=="true"
                        if(ready) queued?.let { queued=null; launch(it) }
                        else {
                            startupError="助手运行库未能启动，请更新 Android System WebView 后重试"
                            queued=null
                            if(running) { running=false; completed(JSONObject().put("error",startupError)) }
                        }
                    }
                }
            }
        }
        web.loadDataWithBaseURL("https://medstack.local/", "<html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'\"></head><body></body></html>", "text/html", "UTF-8", null)
    }
    fun configuration(): JSONObject = vault.get("assistant:$userId")?.let { JSONObject(it) } ?: JSONObject().put("endpoint","https://models.sjtu.edu.cn/api/v1").put("model","deepseek-chat")
    fun configure(endpoint: String, model: String, key: String) {
        check(!running) { "请先等待或停止生成" }
        check(authorized()) { "请先登录" }
        val url = endpoint.trim().trimEnd('/').toHttpUrlOrNull() ?: error("API 地址无效")
        require(url.isHttps && url.username.isBlank() && url.password.isBlank() && url.query == null && url.fragment == null && !url.encodedPath.endsWith("/chat/completions") && !url.encodedPath.endsWith("/models")) { "请填写不含参数的 HTTPS Base URL" }
        require(model.matches(Regex("[a-zA-Z0-9@][a-zA-Z0-9._:/@+\\-]{0,199}"))) { "模型名称无效" }
        val prior=configuration()
        val nextKey=key.trim().ifBlank { if(prior.optString("endpoint")==url.toString().trimEnd('/')) prior.optString("key") else "" }
        require(nextKey.length in 1..4096 && nextKey.none { it.isWhitespace() }) { "请填写该服务自己的密钥" }
        vault.put("assistant:$userId",JSONObject().put("endpoint",url.toString().trimEnd('/')).put("model",model).put("key",nextKey).toString())
    }
    fun run(text: String, workspace: JSONObject?, includeContext: Boolean) {
        check(authorized() && !closed) { "请先登录" }
        check(startupError.isBlank()) { startupError }
        require(!running) { "助手正在处理上一条请求" }
        require(text.isNotBlank() && text.length <= 4000) { "请输入1至4000字" }
        val config=configuration(); check(config.optString("key").isNotBlank()) { "请先保存自己的 API 连接" }
        running=true; calls=0
        val input=JSONObject().put("text",text.replace(config.optString("key"),"[密钥已隐藏]")).put("model",config.getString("model")).put("includeContext",includeContext).put("workspace",workspace)
        if(ready) launch(input) else queued=input
    }
    private fun launch(input: JSONObject) { web.evaluateJavascript("MedstackPi.run($input)",null) }
    inner class Bridge {
        @JavascriptInterface fun request(id: String, payload: String) {
            scope.launch {
                val result=try {
                    check(running && authorized() && !closed) { "登录状态已失效" }
                    require(payload.length <= 200000 && ++calls <= 6) { "已达到步骤或内容上限" }
                    val now=System.currentTimeMillis()
                    synchronized(ledger) { while(ledger.isNotEmpty() && now-ledger.first()>60000) ledger.removeFirst(); check(ledger.size<8) { "已接近每分钟调用额度" }; ledger.addLast(now) }
                    val config=configuration()
                    val body=JSONObject(payload)
                    require(body.optString("model")==config.getString("model") && !body.optBoolean("stream")) { "模型请求无效" }
                    val request=Request.Builder().url(config.getString("endpoint")+"/chat/completions").header("Authorization","Bearer "+config.getString("key")).post(payload.toRequestBody("application/json; charset=utf-8".toMediaType())).build()
                    val call=client.newCall(request); activeCall=call
                    call.execute().use { response ->
                        check(response.isSuccessful) { "模型服务返回 HTTP ${response.code}；请检查网络和 API 权限" }
                        val stream=response.body?.byteStream() ?: error("模型回复为空")
                        val output=ByteArrayOutputStream(); val buffer=ByteArray(8192)
                        while(true) { val size=stream.read(buffer); if(size<0) break; require(output.size()+size<=1_000_000) { "模型回复过大" }; output.write(buffer,0,size) }
                        val bytes=output.toByteArray()
                        check(authorized() && !closed && running) { "生成已停止" }
                        JSONObject(String(bytes,Charsets.UTF_8))
                    }
                } catch(e:Exception) { JSONObject().put("error",e.message ?: "请求未完成") }
                finally { activeCall=null }
                main.post { if(!closed) web.evaluateJavascript("MedstackPi.resolve(${JSONObject.quote(id)},$result)",null) }
            }
        }
        @JavascriptInterface fun completed(payload: String) {
            main.post {
                if(closed || !running) return@post
                running=false
                if(authorized()) {
                    val key=configuration().optString("key")
                    val safe=if(key.isNotBlank()) payload.replace(key,"[密钥已隐藏]") else payload
                    completed(JSONObject(safe))
                }
            }
        }
    }
    fun cancel() {
        queued=null; activeCall?.cancel()
        if(!closed) web.evaluateJavascript("MedstackPi.cancel()",null)
        if(running) { running=false; completed(JSONObject().put("error","生成已停止")) }
    }
    fun close() { cancel(); closed=true; scope.cancel(); web.removeJavascriptInterface("NativePi"); web.destroy() }
}
