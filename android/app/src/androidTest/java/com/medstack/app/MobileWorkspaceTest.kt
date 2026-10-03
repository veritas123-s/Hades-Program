package com.medstack.app

import android.graphics.Bitmap
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.medstack.app.data.MedstackRepository
import com.medstack.app.data.MedstackUiState
import com.medstack.app.security.SecureStore
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.time.LocalDate

/** All fixtures live in the separate test APK. No login bypass enters the app. */
@RunWith(AndroidJUnit4::class)
class MobileWorkspaceTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    private lateinit var repository: MedstackRepository
    private lateinit var secure: SecureStore
    private val uid = "synthetic-mobile-ui-account"

    private fun navigate(label: String) = compose.onNode(hasText(label) and hasClickAction()).performClick()

    private fun screenshot(name: String) {
        compose.waitForIdle()
        val folder = File(compose.activity.getExternalFilesDir(null), "ui-evidence").apply { mkdirs() }
        InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot().let { bitmap ->
            File(folder, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
        }
    }

    @Test fun offlineWorkspaceActionsNavigationEncryptionAndLogout() {
        compose.onNodeWithText("医栈通 Medstack").assertIsDisplayed()
        compose.runOnIdle {
            val field = MainActivity::class.java.getDeclaredField("repository").apply { isAccessible = true }
            repository = field.get(compose.activity) as MedstackRepository
            secure = SecureStore(compose.activity)
            // No token is installed: authenticated requests fail locally, without reaching production.
            secure.clearSession()
            secure.put("user", JSONObject().put("id", uid).put("email", "mobile@synthetic.invalid").toString())
            val document = JSONObject(compose.activity.assets.open("default-cloud-document.json").bufferedReader().use { it.readText() })
            document.getJSONArray("events").put(JSONObject().put("title", "合成日程").put("start", "${LocalDate.now().plusDays(1)}T15:00:00+08:00").put("end", "${LocalDate.now().plusDays(1)}T16:00:00+08:00").put("deletedAt", JSONObject.NULL))
            val base = MedstackUiState(loading = false, authenticated = true, email = "mobile@synthetic.invalid", nickname = "合成验证账号", document = document)
            val parse = MedstackRepository::class.java.getDeclaredMethod("documentState", MedstackUiState::class.java, JSONObject::class.java).apply { isAccessible = true }
            val state = parse.invoke(repository, base, document) as MedstackUiState
            val emit = MedstackRepository::class.java.getDeclaredMethod("emit", MedstackUiState::class.java).apply { isAccessible = true }
            emit.invoke(repository, state)
        }
        screenshot("today")
        navigate("任务")
        compose.onNodeWithText("添加任务").performClick()
        compose.onNodeWithText("任务名称").performTextInput("合成离线任务")
        compose.onNodeWithText("截止日期 YYYY-MM-DD").performTextInput(LocalDate.now().plusDays(2).toString())
        compose.onNodeWithText("保存").performClick()
        compose.waitUntil(6000) { repository.state.tasks.any { it.title == "合成离线任务" } }
        compose.onNodeWithText("合成离线任务").assertIsDisplayed()
        screenshot("tasks")
        compose.onNode(hasRole(Role.Checkbox)).performClick()
        compose.runOnIdle { assertTrue(repository.state.tasks.single().completed) }
        compose.onNodeWithText("删除").performClick()
        compose.runOnIdle {
            assertTrue(repository.state.tasks.isEmpty())
            assertFalse(repository.state.document!!.getJSONArray("tasks").getJSONObject(0).isNull("deletedAt"))
        }
        navigate("日程")
        compose.onNodeWithText("合成日程").assertIsDisplayed()
        screenshot("schedule")
        navigate("专注")
        compose.onNodeWithText("开始专注").performClick()
        Thread.sleep(1300)
        compose.onNodeWithText("结束并保存").performClick()
        compose.runOnIdle { assertEquals(1, repository.state.document!!.getJSONArray("logs").length()) }
        screenshot("focus")
        navigate("更多")
        navigate("Poseidon")
        compose.onNodeWithText("自己的 API 密钥").assertIsDisplayed()
        screenshot("assistant")
        compose.onNodeWithText("返回更多").performClick()
        navigate("账号与设置")
        screenshot("settings")
        compose.runOnIdle {
            val cached = JSONObject(secure.get("document:$uid")!!)
            assertEquals(1, cached.getJSONArray("logs").length())
            assertFalse(cached.getJSONArray("tasks").getJSONObject(0).isNull("deletedAt"))
            val raw = compose.activity.getSharedPreferences("medstack_secure_v1", 0).getString("document:$uid", "")!!
            assertFalse(raw.contains("合成离线任务"))
            assertNull(secure.get("document:another-synthetic-account"))
        }
        compose.onNodeWithText("退出账号").performScrollTo().performClick()
        compose.waitUntil(6000) { !repository.state.authenticated }
        compose.onNodeWithText("医栈通 Medstack").assertIsDisplayed()
        compose.onNodeWithText("合成离线任务").assertDoesNotExist()
        screenshot("logout")
        compose.runOnIdle { assertNotNull(secure.get("document:$uid")) }
    }
}
