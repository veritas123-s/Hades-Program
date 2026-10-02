package com.medstack.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val MedstackColors = lightColorScheme(
    primary = Color(0xFF713D66),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFF0D9EA),
    onPrimaryContainer = Color(0xFF33152D),
    secondary = Color(0xFF9A493C),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFFFDAD3),
    background = Color(0xFFF8F2EA),
    surface = Color(0xFFFFFBF7),
    surfaceVariant = Color(0xFFEADFE4),
    onSurface = Color(0xFF2A2226),
    onSurfaceVariant = Color(0xFF5C5057),
    outline = Color(0xFF8B7480),
    error = Color(0xFFB3261E),
)

private val MedstackTypography = Typography(
    displaySmall = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 36.sp),
    headlineLarge = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 30.sp),
    headlineMedium = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold, fontSize = 25.sp),
    titleLarge = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold, fontSize = 21.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold, fontSize = 18.sp),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 17.sp, lineHeight = 26.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 15.sp, lineHeight = 23.sp),
    labelLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 15.sp),
    labelMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 13.sp),
)

@Composable
fun MedstackTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = MedstackColors, typography = MedstackTypography, content = content)
}
