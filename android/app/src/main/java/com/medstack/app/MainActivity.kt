package com.medstack.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
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
            MedstackTheme {
                MedstackApp(uiState, repository)
            }
        }
    }

    override fun onDestroy() {
        repository.onStateChanged = null
        repository.close()
        super.onDestroy()
    }
}
