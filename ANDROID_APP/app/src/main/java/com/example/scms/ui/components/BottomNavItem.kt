package com.example.scms.ui.components
import com.example.scms.*
import com.example.scms.ui.screens.* 
import com.example.scms.ui.components.* 
import com.example.scms.data.model.* 
import com.example.scms.data.network.* 
import com.example.scms.utils.* 
import com.example.scms.service.*

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.ui.graphics.vector.ImageVector

sealed class BottomNavItem(
    val route: String,
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    object Home        : BottomNavItem("home",        "Home",        Icons.Filled.Home,           Icons.Outlined.Home)
    object Complaints  : BottomNavItem("complaints",  "Complaints",  Icons.Filled.Assignment,     Icons.Outlined.Assignment)
    object Alerts      : BottomNavItem("alerts",      "Alerts",      Icons.Filled.Notifications,  Icons.Outlined.Notifications)
    object Profile     : BottomNavItem("profile",     "Profile",      Icons.Filled.Person,         Icons.Outlined.Person)
}
