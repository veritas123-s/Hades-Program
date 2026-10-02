package com.medstack.app.data

import android.content.Context
import com.medstack.app.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.time.Instant
import java.util.concurrent.TimeUnit

data class ReleaseNotice(val version:String,val title:String,val notes:List<String>,val url:String,val sha256:String,val urgent:Boolean)
data class UpdateStatus(val release:ReleaseNotice?=null,val available:Boolean=false,val dismissed:Boolean=false,val message:String="")
class MobileUpdates(context:Context) {
    private val preferences=context.getSharedPreferences("medstack-updates",Context.MODE_PRIVATE)
    private val client=OkHttpClient.Builder().callTimeout(8,TimeUnit.SECONDS).followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false).build()
    private val api=AccountApi(com.medstack.app.security.SecureStore(context))
    private fun parts(version:String):List<Int> {require(version.matches(Regex("(0|[1-9][0-9]{0,5})\\.(0|[1-9][0-9]{0,5})\\.(0|[1-9][0-9]{0,5})")));return version.split('.').map(String::toInt)}
    private fun newer(candidate:String,installed:String):Boolean {val a=parts(candidate);val b=parts(installed);for(i in 0..2)if(a[i]!=b[i])return a[i]>b[i];return false}
    private fun parse(raw:String):ReleaseNotice {
        val envelope=JSONObject(raw);val d=envelope.optJSONObject("release")?:envelope
        require(d.getInt("schema")==1);val version=d.getString("version");parts(version)
        require(Instant.parse(d.getString("publishedAt")).toEpochMilli()<=System.currentTimeMillis()+300000)
        val title=d.getString("title");require(title.isNotBlank()&&title.length<=100)
        val list=d.getJSONArray("notes");require(list.length() in 1..20);val notes=(0 until list.length()).map{list.getString(it).also{n->require(n.isNotBlank()&&n.length<=300)}}
        val item=d.getJSONObject("downloads").getJSONObject("android");val url=item.getString("url");val hash=item.getString("sha256")
        require(url=="https://github.com/veritas123-s/Medstack-Program/releases/download/v$version/Medstack-$version-Android.apk")
        require(hash.matches(Regex("[a-f0-9]{64}")))
        return ReleaseNotice(version,title,notes,url,hash,d.optBoolean("urgent"))
    }
    private fun status(release:ReleaseNotice?,message:String="")=UpdateStatus(release,release?.let{newer(it.version,BuildConfig.VERSION_NAME)}?:false,release?.let{preferences.getBoolean("dismissed:${it.version}",false)}?:false,message)
    fun cached():UpdateStatus=status(runCatching{preferences.getString("release",null)?.let(::parse)}.getOrNull())
    fun check():UpdateStatus {
        for(url in listOf(BuildConfig.ACCOUNT_BASE_URL.trimEnd('/')+"/api/releases/latest","https://raw.githubusercontent.com/veritas123-s/Medstack-Program/main/releases/stable.json")){
            try{
                client.newCall(Request.Builder().url(url).header("User-Agent","MedstackAndroid/${BuildConfig.VERSION_NAME}").build()).execute().use{r->
                    require(r.isSuccessful);val input=r.body?.byteStream()?:error("Empty feed");val buffer=ByteArray(32769);var size=0
                    while(size<buffer.size){val n=input.read(buffer,size,buffer.size-size);if(n<0)break;size+=n};require(size<=32768)
                    val raw=String(buffer,0,size,Charsets.UTF_8);val parsed=parse(raw);val old=cached().release
                    require(old==null||!newer(old.version,parsed.version))
                    preferences.edit().putString("release",raw).apply();return status(parsed)
                }
            }catch(_:Exception){}
        }
        return cached().copy(message="暂时无法检查更新，已保留上次公告")
    }
    fun dismiss(notice:ReleaseNotice):UpdateStatus {preferences.edit().putBoolean("dismissed:${notice.version}",true).apply();return cached()}
    fun emailPreferences(enabled:Boolean?=null):Boolean=api.updatePreferences(enabled).getBoolean("emailUpdates")
}
