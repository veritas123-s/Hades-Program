package com.medstack.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val MedstackColors = lightColorScheme(
    primary = Color(0xFF086B91),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE2F1F7),
    onPrimaryContainer = Color(0xFF164052),
    secondary = Color(0xFF16877A),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE0F4EC),
    background = Color(0xFFF3F8FB),
    surface = Color.White,
    surfaceVariant = Color(0xFFEAF1F4),
    onSurface = Color(0xFF172B38),
    onSurfaceVariant = Color(0xFF526977),
    outline = Color(0xFF748B98),
    error = Color(0xFFB3261E),
)

private val MedstackTypography = Typography(
    displaySmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Medium, fontSize = 42.sp, lineHeight = 50.sp),
    headlineLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 24.sp, lineHeight = 32.sp),
    headlineMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 22.sp, lineHeight = 30.sp),
    titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 26.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Medium, fontSize = 15.sp, lineHeight = 23.sp),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 15.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 15.sp, lineHeight = 23.sp),
    labelLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 15.sp),
    labelMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 13.sp),
)

@Composable
fun MedstackTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) darkColorScheme(
        primary = Color(0xFF86D0E8), onPrimary = Color(0xFF063749),
        primaryContainer = Color(0xFF193F50), onPrimaryContainer = Color(0xFFC8ECF8),
        background = Color(0xFF111B25), surface = Color(0xFF18232E), surfaceVariant = Color(0xFF22323F),
        onSurface = Color(0xFFE7EEF3), onSurfaceVariant = Color(0xFFB6C5D0), outline = Color(0xFF6D8391),
    ) else MedstackColors
    MaterialTheme(colorScheme = colors, typography = MedstackTypography, content = content)
}
