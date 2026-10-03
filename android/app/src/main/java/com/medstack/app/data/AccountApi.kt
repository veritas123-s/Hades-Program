package com.medstack.app.data

import com.medstack.app.BuildConfig
import com.medstack.app.security.SecureStore
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class ApiException(message: String, val status: Int, val code: String = "") : Exception(message)

data class ApiResult(val json: JSONObject, val status: Int)

class AccountApi(private val secureStore: SecureStore) {
    private val origin = BuildConfig.ACCOUNT_BASE_URL.trimEnd('/')
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .followRedirects(false)
        .followSslRedirects(false)
        .retryOnConnectionFailure(false)
        .build()

    fun hasSession(): Boolean = !secureStore.get("token").isNullOrBlank()

    private fun request(path: String, body: JSONObject? = null, authenticated: Boolean = false): ApiResult {
        val builder = Request.Builder()
            .url(origin + path)
            .header("Accept", "application/json")
            .header("Origin", origin)
            .header("User-Agent", "MedstackAndroid/${BuildConfig.VERSION_NAME}")
        if (authenticated) {
            val token = secureStore.get("token") ?: throw ApiException("请先登录 医栈通", 401)
            builder.header("Authorization", "Bearer $token")
        }
        if (body == null) builder.get()
        else builder.post(body.toString().toRequestBody(jsonType))
        client.newCall(builder.build()).execute().use { response ->
            if (response.code in 300..399) throw ApiException("账号服务返回了不允许的跳转", response.code)
            val stream = response.body?.byteStream() ?: throw ApiException("账号服务没有返回内容", 502)
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
                val count = stream.read(buffer)
                if (count < 0) break
                total += count
                if (total > (if (path == "/api/news/shared") 8 else 2) * 1024 * 1024) throw ApiException("账号服务返回内容过大", 502)
                output.write(buffer, 0, count)
            }
            val json = try {
                JSONObject(output.toString(Charsets.UTF_8.name()).ifBlank { "{}" })
            } catch (_: Exception) {
                throw ApiException("账号服务返回格式无效", 502)
            }
            if (!response.isSuccessful || json.has("error")) {
                if (response.code == 401) secureStore.clearSession()
                val code = json.optString("code", json.optString("error"))
                val message = when (response.code) {
                    401 -> "邮箱或密码不正确，或登录已过期"
                    403 -> "账号服务拒绝了当前请求"
                    429 -> "请求太频繁，请稍后再试"
                    in 500..599 -> "账号服务暂时不可用"
                    else -> "账号操作未完成，请检查输入"
                }
                throw ApiException(message, response.code, code)
            }
            response.header("set-auth-token")?.let { token ->
                if (token.length !in 16..4096) throw ApiException("登录会话无效", 502)
                secureStore.put("token", token)
            }
            return ApiResult(json, response.code)
        }
    }

    fun signIn(email: String, password: String) = request(
        "/api/auth/sign-in/email",
        JSONObject().put("email", email).put("password", password),
    ).json

    fun signUp(email: String, password: String) = request(
        "/api/auth/sign-up/email",
        JSONObject().put("email", email).put("password", password).put("name", "医栈通 用户"),
    ).json

    fun verify(email: String, code: String) = request(
        "/api/auth/email-otp/verify-email",
        JSONObject().put("email", email).put("otp", code),
    ).json

    fun current() = request("/api/auth/get-session", authenticated = true).json
    fun sharedNews() = request("/api/news/shared", authenticated = true).json

    fun signOut() {
        try {
            request("/api/auth/sign-out", JSONObject(), authenticated = true)
        } finally {
            secureStore.clearSession()
        }
    }

    fun updatePreferences(enabled:Boolean?=null)=request("/api/releases/preferences",enabled?.let{JSONObject().put("emailUpdates",it)},authenticated=true).json

    fun pull() = request(
        "/api/sync",
        JSONObject().put("action", "pull"),
        authenticated = true,
    ).json

    fun push(version: Int, document: JSONObject) = request(
        "/api/sync",
        JSONObject().put("action", "push").put("version", version).put("document", document),
        authenticated = true,
    ).json
}
