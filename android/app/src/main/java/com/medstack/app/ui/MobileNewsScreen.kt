package com.medstack.app.ui

import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.medstack.app.data.MedstackRepository
import com.medstack.app.data.MedstackUiState
import com.medstack.app.data.MobileNewsCache
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun MobileNewsScreen(ui: MedstackUiState, repository: MedstackRepository) {
    val context = LocalContext.current
    var clock by remember { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    var query by remember { mutableStateOf("") }
    var coverageExpanded by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { while (true) { clock = SystemClock.elapsedRealtime(); delay(1000) } }
    val news = ui.news
    val remaining = ui.newsReceivedElapsed?.let { received ->
        ((news?.optLong("nextRunAt", 0) ?: 0) - (news?.optLong("serverNow", 0) ?: 0) - (clock - received)).coerceAtLeast(0) / 1000
    }
    val countdown = when {
        news?.optBoolean("busy") == true -> "服务器正在采集"
        remaining == null -> "等待服务器刷新计划"
        remaining == 0L -> "等待服务器刷新结果"
        else -> "距下次刷新 %02d:%02d:%02d".format(remaining / 3600, remaining % 3600 / 60, remaining % 60)
    }
    val raw = news?.optJSONArray("items")
    val articles = (0 until (raw?.length() ?: 0)).mapNotNull { raw?.optJSONObject(it) }.filter {
        listOf("title", "source", "excerpt").any { key -> it.optString(key).contains(query.trim(), ignoreCase = true) }
    }
    LazyColumn(contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(countdown, style = MaterialTheme.typography.titleMedium)
                    Text("每天每小时整点采集 · ${news?.optJSONArray("sources")?.length() ?: 12} 个公众号")
                    if (ui.newsError.isNotBlank()) Text(ui.newsError, color = MaterialTheme.colorScheme.error)
                    if (!news?.optString("error").isNullOrBlank()) Text(news?.optString("error").orEmpty())
                    Button(repository::syncSharedNews, enabled = !ui.newsBusy) { Text(if (ui.newsBusy) "同步中…" else "同步最新信息") }
                }
            }
        }
        item { OutlinedTextField(query, { query = it }, label = { Text("搜索标题、摘要或来源") }, modifier = Modifier.fillMaxWidth()) }
        item { TextButton({ coverageExpanded = !coverageExpanded }) { Text(if (coverageExpanded) "收起来源状态" else "查看来源状态") } }
        if (coverageExpanded) {
            val coverage = news?.optJSONArray("coverage")
            items(coverage?.length() ?: 0) { i ->
                val row = coverage?.optJSONObject(i)
                Text("${row?.optString("source")} · ${if (row?.optString("status") == "partial") "部分覆盖" else "未能读取"}\n${row?.optString("note")}")
            }
        }
        if (articles.isEmpty()) item { Text("暂未收录符合条件的消息；可查看来源状态。") }
        items(articles, key = { it.getString("id") }) { article ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(article.optString("title"), style = MaterialTheme.typography.titleMedium)
                    val published = Instant.ofEpochMilli(article.optLong("publishedAt")).atZone(ZoneId.of("Asia/Shanghai")).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                    Text("${article.optString("source")} · $published", style = MaterialTheme.typography.bodySmall)
                    Text(article.optString("excerpt"))
                    TextButton({
                        val url = article.optString("url")
                        if (MobileNewsCache.safeURL(url)) runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                    }) { Text(if (article.optBoolean("searchResult")) "查看公开索引" else "查看原文") }
                }
            }
        }
    }
}
