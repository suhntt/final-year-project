package com.example.scms.ui.components
import com.example.scms.*
import com.example.scms.ui.screens.* 
import com.example.scms.ui.components.* 
import com.example.scms.data.model.* 
import com.example.scms.data.network.* 
import com.example.scms.utils.* 
import com.example.scms.service.*

import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.navigation.NavController
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState

import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.unit.dp

@Composable
fun BottomBar(navController: NavController) {
    val haptic = LocalHapticFeedback.current
    val isDark = isSystemInDarkTheme()

    val items = listOf(
        BottomNavItem.Home,
        BottomNavItem.Complaints,
        BottomNavItem.Alerts,
        BottomNavItem.Profile
    )

    NavigationBar(
        containerColor = if (isDark) MaterialTheme.colorScheme.surface else Color.White,
        tonalElevation = 0.dp
    ) {
        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentDestination = navBackStackEntry?.destination

        items.forEach { item ->
            val isSelected = currentDestination?.hierarchy?.any { it.route?.startsWith(item.route) == true } == true
            
            NavigationBarItem(
                selected = isSelected,
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    if (!isSelected) {
                        navController.navigate(item.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                icon = {
                    Icon(
                        imageVector = if (isSelected) item.selectedIcon else item.unselectedIcon,
                        contentDescription = item.title
                    )
                },
                label = {
                    Text(item.title)
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = if (isDark) Color(0xFF34D399) else Color(0xFF0F9F59),
                    selectedTextColor = if (isDark) Color(0xFF34D399) else Color(0xFF0F9F59),
                    unselectedIconColor = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B),
                    unselectedTextColor = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B),
                    indicatorColor = Color.Transparent
                )
            )
        }
    }
}
