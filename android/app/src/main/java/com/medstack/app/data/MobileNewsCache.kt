package com.medstack.app.data

import android.content.Context
import android.util.AtomicFile
import java.io.File
import java.net.URI
import java.security.MessageDigest
import org.json.JSONObject

class MobileNewsCache(context: Context) {
    private val directory = File(context.filesDir, "shared-news").apply { mkdirs() }
    private fun file(uid: String): AtomicFile {
        require(uid.isNotBlank())
        val name = MessageDigest.getInstance("SHA-256").digest(uid.toByteArray()).joinToString("") { "%02x".format(it) }
        return AtomicFile(File(directory, "$name.json"))
    }
    fun read(uid: String): JSONObject? = runCatching {
        val stored = file(uid)
        if (stored.baseFile.length() > 8 * 1024 * 1024) return null
        validate(JSONObject(stored.readFully().toString(Charsets.UTF_8)))
    }.getOrNull()
    fun save(uid: String, data: JSONObject) {
        val stored = file(uid)
        val stream = stored.startWrite()
        try { stream.write(data.toString().toByteArray(Charsets.UTF_8)); stored.finishWrite(stream) }
        catch (error: Exception) { stored.failWrite(stream); throw error }
    }
    companion object {
        private val hosts = setOf("mp.weixin.qq.com", "weixin.sogou.com", "news.sjtu.edu.cn", "www.shsmu.edu.cn")
        fun safeURL(value: String): Boolean = runCatching {
            val uri = URI(value)
            uri.scheme == "https" && uri.host in hosts && uri.userInfo == null && uri.port == -1
        }.getOrDefault(false)
        fun validate(data: JSONObject): JSONObject {
            require(data.getInt("version") == 1)
            val now = data.getLong("serverNow")
            require(data.getLong("nextRunAt") in (now - 90000)..(now + 3600000))
            val sources = data.getJSONArray("sources")
            require(sources.length() <= 40)
            for (i in 0 until sources.length()) require(sources.getString(i).length in 1..60)
            val coverage = data.getJSONArray("coverage")
            require(coverage.length() <= 42)
            val items = data.getJSONArray("items")
            require(items.length() <= 3000)
            for (i in 0 until items.length()) {
                val row = items.getJSONObject(i)
                require(row.getString("id").length in 1..200 && row.getString("title").length in 1..300)
                require(row.getString("source").length in 1..60 && row.getString("excerpt").length <= 1000)
                require(row.getLong("publishedAt") <= now + 300000 && safeURL(row.getString("url")))
            }
            return data
        }
    }
}
