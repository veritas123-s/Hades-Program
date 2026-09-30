package com.shsmuveritas.hades

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.shsmuveritas.hades.data.HadesRepository
import com.shsmuveritas.hades.data.HadesUiState
import com.shsmuveritas.hades.ui.HadesApp
import com.shsmuveritas.hades.ui.HadesTheme

class MainActivity : ComponentActivity() {
    private lateinit var repository: HadesRepository
    private var uiState by mutableStateOf(HadesUiState())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repository = HadesRepository(applicationContext)
        repository.onStateChanged = { uiState = it }
        setContent {
            HadesTheme {
                HadesApp(uiState, repository)
            }
        }
    }

    override fun onDestroy() {
        repository.onStateChanged = null
        repository.close()
        super.onDestroy()
    }
}
