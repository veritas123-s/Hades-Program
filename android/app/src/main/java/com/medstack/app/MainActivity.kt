package com.medstack.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.SideEffect
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.view.WindowCompat
import com.medstack.app.data.MedstackRepository
import com.medstack.app.data.MedstackUiState
import com.medstack.app.ui.MedstackApp
import com.medstack.app.ui.MedstackTheme

class MainActivity : ComponentActivity() {
    private lateinit var repository: MedstackRepository
    private var uiState by mutableStateOf(MedstackUiState())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repository = MedstackRepository(applicationContext)
        repository.onStateChanged = { uiState = it }
        setContent {
            val dark = isSystemInDarkTheme()
            SideEffect {
                val bars = WindowCompat.getInsetsController(window, window.decorView)
                bars.isAppearanceLightStatusBars = !dark
                bars.isAppearanceLightNavigationBars = !dark
            }
            MedstackTheme {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    MedstackApp(uiState, repository)
                }
            }
        }
    }

    override fun onDestroy() {
        repository.onStateChanged = null
        repository.close()
        super.onDestroy()
    }
}
