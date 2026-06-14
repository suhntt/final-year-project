package com.example.scms.ui.screens

import com.example.scms.*
import com.example.scms.ui.screens.* 
import com.example.scms.ui.components.* 
import com.example.scms.data.model.* 
import com.example.scms.data.network.* 
import com.example.scms.utils.* 
import com.example.scms.service.*
import com.google.android.gms.location.Priority

import android.content.Intent
import android.net.Uri
import android.location.Geocoder
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import com.example.scms.utils.NetworkObserver
import coil.compose.AsyncImage
import androidx.compose.ui.res.painterResource
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeInfoScreen(navController: NavController) {
    val context = LocalContext.current
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val user = UserSession.currentUser
    val isDark = isSystemInDarkTheme()

    // 📶 Network Observer for Offline Mode
    val networkObserver = remember { NetworkObserver(context) }
    val networkStatus by networkObserver.observe.collectAsState(initial = NetworkObserver.Status.Available)
    var showOfflineDialog by remember { mutableStateOf(false) }



    // Weather States
    var temp by remember { mutableStateOf("--°C") }
    var aqi by remember { mutableStateOf("--") }
    var isWeatherLoading by remember { mutableStateOf(true) }

    // Location Address State
    var currentAddress by remember { mutableStateOf("Detecting location...") }

    // Backend States
    var complaints by remember { mutableStateOf<List<Complaint>>(emptyList()) }
    var alerts by remember { mutableStateOf<List<Alert>>(emptyList()) }
    var userPoints by remember { mutableIntStateOf(user?.points ?: 150) }
    var userRank by remember { mutableStateOf("#12") }

    val fusedLocationClient = remember { com.google.android.gms.location.LocationServices.getFusedLocationProviderClient(context) }

    fun refreshData() {
        scope.launch {
            try {
                val userDistrict = UserSession.currentUser?.district
                val fetchedComplaints = RetrofitClient.api.getComplaints(district = userDistrict)
                complaints = fetchedComplaints
            } catch (_: Exception) {}

            try {
                val userDistrict = UserSession.currentUser?.district
                val fetchedAlerts = RetrofitClient.api.getAlerts(district = userDistrict)
                alerts = fetchedAlerts
            } catch (_: Exception) {}

            try {
                val pointsResponse = RetrofitClient.api.getUserPoints(user?.id ?: 0)
                if (pointsResponse.isSuccessful) {
                    pointsResponse.body()?.let { userPoints = it.points }
                }
            } catch (_: Exception) {}

            try {
                val leaderboard = RetrofitClient.api.getLeaderboard()
                val index = leaderboard.indexOfFirst { it.id == user?.id }
                if (index != -1) {
                    userRank = "#${index + 1}"
                }
            } catch (_: Exception) {}
        }
    }

    // Call once initially to populate from user session
    LaunchedEffect(Unit) {
        refreshData()
    }

    // Live-sync subscription for any background uploads/sync completions
    LaunchedEffect(Unit) {
        com.example.scms.utils.OfflineComplaintManager.syncEventFlow.collect { syncedCount ->
            if (syncedCount > 0) {
                refreshData()
            }
        }
    }

    LaunchedEffect(networkStatus) {
        if (networkStatus == NetworkObserver.Status.Lost) {
            delay(500)
            showOfflineDialog = true
        } else if (networkStatus == NetworkObserver.Status.Available) {
            showOfflineDialog = false
            scope.launch {
                val syncedCount = com.example.scms.utils.OfflineComplaintManager.syncOfflineComplaints(context)
                if (syncedCount > 0) {
                    refreshData()
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        // Simulate "Scanning City Vitals"
        delay(800)
        temp = "31°C"
        aqi = "42"
        isWeatherLoading = false

        // Fetch Location & Reverse Geocode
        val userId = UserSession.currentUser?.id ?: return@LaunchedEffect
        
        val processLocationUpdate: (android.location.Location) -> Unit = { loc ->
            // 1. Push coordinates to backend
            scope.launch(kotlinx.coroutines.Dispatchers.IO) {
                try {
                    RetrofitClient.api.updateUserLocation(
                        mapOf(
                            "user_id" to userId.toString(),
                            "lat" to loc.latitude.toString(),
                            "lon" to loc.longitude.toString()
                        )
                    )
                } catch (_: Exception) {}
            }

            // 2. Fetch district online/offline and sync district
            scope.launch(kotlinx.coroutines.Dispatchers.IO) {
                var detectedDistrict: String? = null
                try {
                    // Try online Nominatim lookup from backend
                    val resp = RetrofitClient.api.detectDistrict(loc.latitude.toString(), loc.longitude.toString())
                    detectedDistrict = if (resp.district.isBlank()) null else resp.district
                } catch (_: Exception) {}

                // Offline bounds fallback
                if (detectedDistrict == null) {
                    detectedDistrict = OfflineDistrictDetector.detectDistrict(loc.latitude, loc.longitude)
                }

                if (detectedDistrict != null) {
                    val cur = UserSession.currentUser
                    if (cur != null && cur.district != detectedDistrict) {
                        UserSession.currentUser = cur.copy(district = detectedDistrict)
                        try {
                            RetrofitClient.api.updateUserDistrict(
                                mapOf(
                                    "user_id" to cur.id.toString(),
                                    "district" to detectedDistrict
                                )
                            )
                        } catch (_: Exception) {}
                    }
                }
                // Reload complaints, alerts, stats, leaderboard for the new district
                refreshData()
            }

            // 3. Geocode for current address display
            scope.launch(kotlinx.coroutines.Dispatchers.IO) {
                try {
                    val geocoder = Geocoder(context, Locale.getDefault())
                    val addr = geocoder.getFromLocation(loc.latitude, loc.longitude, 1)?.firstOrNull()
                    if (addr != null) {
                        val street = addr.thoroughfare ?: addr.subLocality ?: ""
                        val city = addr.locality ?: addr.subAdminArea ?: ""
                        val state = addr.adminArea ?: "Assam"
                        val displayStr = if (street.isNotEmpty() && city.isNotEmpty()) {
                            "$street, $city"
                        } else if (city.isNotEmpty()) {
                            "$city, $state"
                        } else {
                            "${UserSession.currentUser?.district ?: "Hojai"}, Assam"
                        }
                        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                            currentAddress = displayStr
                        }
                    } else {
                        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                            currentAddress = OfflineDistrictDetector.buildOfflineAddress(loc.latitude, loc.longitude)
                        }
                    }
                } catch (_: Exception) {
                    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                        currentAddress = OfflineDistrictDetector.buildOfflineAddress(loc.latitude, loc.longitude)
                    }
                }
            }
        }

        try {
            val hasPermission = androidx.core.content.ContextCompat.checkSelfPermission(
                context, android.Manifest.permission.ACCESS_FINE_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            
            if (hasPermission) {
                // Request fresh real-time location
                fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                    .addOnSuccessListener { loc ->
                        if (loc != null) {
                            processLocationUpdate(loc)
                        } else {
                            // Fallback to lastLocation if getCurrentLocation returns null
                            fusedLocationClient.lastLocation.addOnSuccessListener { locLast ->
                                if (locLast != null) {
                                    processLocationUpdate(locLast)
                                } else {
                                    currentAddress = "${UserSession.currentUser?.district ?: "Hojai"}, Assam"
                                }
                            }.addOnFailureListener {
                                currentAddress = "${UserSession.currentUser?.district ?: "Hojai"}, Assam"
                            }
                        }
                    }
                    .addOnFailureListener {
                        // Fallback to lastLocation if getCurrentLocation fails
                        fusedLocationClient.lastLocation.addOnSuccessListener { locLast ->
                            if (locLast != null) {
                                processLocationUpdate(locLast)
                            } else {
                                currentAddress = "${UserSession.currentUser?.district ?: "Hojai"}, Assam"
                            }
                        }.addOnFailureListener {
                            currentAddress = "${UserSession.currentUser?.district ?: "Hojai"}, Assam"
                        }
                    }
            } else {
                currentAddress = "${UserSession.currentUser?.district ?: "Hojai"}, Assam"
            }
        } catch (e: Exception) {
            currentAddress = "${UserSession.currentUser?.district ?: "Hojai"}, Assam"
        }
    }

    // Calculations & Fallbacks
    val pendingCount = complaints.count { it.status == "Pending" || it.status == "Verified" }
    val inProgressCount = complaints.count { it.status == "In Progress" || it.status == "Assigned" }
    val resolvedCount = complaints.count { it.status == "Resolved" }

    val displayPending = if (complaints.isEmpty()) 5 else pendingCount
    val displayInProgress = if (complaints.isEmpty()) 3 else inProgressCount
    val displayResolved = if (complaints.isEmpty()) 12 else resolvedCount
    val displayTotal = if (complaints.isEmpty()) 20 else complaints.size

    val recentComplaints = if (complaints.isEmpty()) {
        listOf(
            Complaint(id = "1", category = "Pothole on Main Road", address = "MG Road, Hojai", created_at = "2024-05-12T00:00:00.000Z", status = "In Progress")
        )
    } else {
        complaints.take(1)
    }

    val displayUpdates = if (alerts.isEmpty()) {
        listOf(
            Alert(alertId = "1", message = "Road repair work completed in Ward 5", created_at = "2024-05-12T00:00:00.000Z"),
            Alert(alertId = "2", message = "Water supply restored in Ward 3", created_at = "2024-05-11T00:00:00.000Z"),
            Alert(alertId = "3", message = "New complaint officer assigned in Ward 2", created_at = "2024-05-09T00:00:00.000Z")
        )
    } else {
        alerts.take(3)
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            HomeTopAppBar(
                user = user,
                onProfileClick = {
                    navController.navigate("profile") {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
        ) {
            WelcomeSection(user = user, currentAddress = currentAddress, isDark = isDark)
            
            ReportComplaintBanner(onClick = {
                navController.navigate("report")
            })

            ComplaintStatisticsSection(
                pending = displayPending,
                inProgress = displayInProgress,
                resolved = displayResolved,
                total = displayTotal,
                isDark = isDark,
                onViewAll = {
                    navController.navigate("complaints") {
                        launchSingleTop = true
                    }
                }
            )

            RecentComplaintsSection(
                recent = recentComplaints,
                isDark = isDark,
                onViewAll = {
                    navController.navigate("complaints") {
                        launchSingleTop = true
                    }
                },
                onComplaintClick = { complaint ->
                    navController.navigate("timeline/${complaint.id}")
                }
            )

            ActiveAlertSection(
                alerts = alerts,
                isDark = isDark,
                onAlertClick = {
                    navController.navigate("alerts") {
                        launchSingleTop = true
                    }
                }
            )

            EmergencyServicesSection()

            Spacer(modifier = Modifier.height(100.dp))
        }
    }

    // 📶 OFFLINE MODE DIALOG
    if (showOfflineDialog) {
        AlertDialog(
            onDismissRequest = { showOfflineDialog = false },
            icon = { Icon(Icons.Default.WifiOff, null, tint = Color.Red, modifier = Modifier.size(40.dp)) },
            title = { Text("Connection Lost", fontWeight = FontWeight.Bold) },
            text = { 
                Text("You are currently offline. Would you like to switch to 'Offline Mode' to report issues locally? They will sync automatically later.") 
            },
            confirmButton = {
                Button(
                    onClick = { 
                        showOfflineDialog = false
                        navController.navigate("report") 
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6366F1))
                ) {
                    Text("Go to Offline Mode")
                }
            },
            dismissButton = {
                TextButton(onClick = { showOfflineDialog = false }) {
                    Text("Stay Here", color = Color.Gray)
                }
            },
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface,
            textContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
        )
    }
}

@Composable
fun WelcomeSection(user: User?, currentAddress: String, isDark: Boolean) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 12.dp)
    ) {
        Text(
            text = "Hello, ${user?.name?.split(" ")?.firstOrNull() ?: "Sushant"} 👋",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
            letterSpacing = (-0.5).sp
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Let's make our city better together",
            color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B),
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
fun HomeTopAppBar(user: User?, onProfileClick: () -> Unit) {
    val isDark = isSystemInDarkTheme()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            Image(
                painter = painterResource(id = com.example.scms.R.drawable.ic_scms_logo),
                contentDescription = "SCMS Logo",
                modifier = Modifier
                    .size(40.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = "SCMS",
                    color = if (isDark) Color(0xFF34D399) else Color(0xFF0F9F59),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp
                )
                Text(
                    text = "Smart Complaint Management System",
                    color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
        
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .clickable { onProfileClick() },
            contentAlignment = Alignment.Center
        ) {
            AsyncImage(
                model = user?.profile_picture ?: "https://api.dicebear.com/9.x/avataaars/png?seed=${user?.name?.replace(" ", "") ?: "User"}",
                contentDescription = "Profile",
                modifier = Modifier.fillMaxSize().clip(CircleShape),
                contentScale = ContentScale.Crop
            )
        }
    }
}

@Composable
fun ReportComplaintBanner(onClick: () -> Unit) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF0E9F6E)
        ),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 8.dp)
            .clickable { onClick() }
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(Color.White, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Add",
                    tint = Color(0xFF0E9F6E),
                    modifier = Modifier.size(28.dp)
                )
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Report a Complaint",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "Help your city by reporting issues",
                    color = Color.White.copy(alpha = 0.9f),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
            }
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = "Go",
                tint = Color.White,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

@Composable
fun ComplaintStatisticsSection(pending: Int, inProgress: Int, resolved: Int, total: Int, isDark: Boolean, onViewAll: () -> Unit) {
    Card(
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, if (isDark) Color(0xFF334155) else Color(0xFFE2E8F0)),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 20.dp, horizontal = 24.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Pending Stats
            Row(
                modifier = Modifier.weight(1.5f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(if (isDark) Color(0xFF38230D) else Color(0xFFFFEDD5), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.WatchLater,
                        contentDescription = "Pending",
                        tint = Color(0xFFD97706),
                        modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text(
                        text = pending.toString(),
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Pending",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B)
                    )
                }
            }

            // Divider
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(44.dp)
                    .background(if (isDark) Color(0xFF334155) else Color(0xFFE2E8F0))
            )

            // Resolved Stats
            Row(
                modifier = Modifier.weight(1.5f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(if (isDark) Color(0xFF022C22) else Color(0xFFDCFCE7), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Outlined.CheckCircle,
                        contentDescription = "Resolved",
                        tint = Color(0xFF16A34A),
                        modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text(
                        text = resolved.toString(),
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Resolved",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B)
                    )
                }
            }
        }
    }
}

@Composable
fun RecentComplaintsSection(recent: List<Complaint>, isDark: Boolean, onViewAll: () -> Unit, onComplaintClick: (Complaint) -> Unit) {
    Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Recent Complaint",
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onBackground
            )
        }
        Spacer(modifier = Modifier.height(12.dp))
        
        Card(
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, if (isDark) Color(0xFF334155) else Color(0xFFE2E8F0)),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column {
                recent.forEachIndexed { index, complaint ->
                    RecentComplaintItem(
                        complaint = complaint,
                        isDark = isDark,
                        onClick = { onComplaintClick(complaint) }
                    )
                    if (index < recent.size - 1) {
                        HorizontalDivider(color = if (isDark) Color(0xFF334155) else Color(0xFFE2E8F0))
                    }
                }
            }
        }
    }
}

@Composable
fun RecentComplaintItem(complaint: Complaint, isDark: Boolean, onClick: () -> Unit) {
    val category = complaint.category ?: ""
    
    val (iconColor, iconBg, iconVec) = when {
        category.contains("Water", ignoreCase = true) || category.contains("Leak", ignoreCase = true) -> {
            Triple(Color(0xFF3B82F6), if (isDark) Color(0xFF172554) else Color(0xFFDBEAFE), Icons.Default.WaterDrop)
        }
        category.contains("Road", ignoreCase = true) || category.contains("Pothole", ignoreCase = true) -> {
            Triple(Color(0xFF3B82F6), if (isDark) Color(0xFF172554) else Color(0xFFDBEAFE), Icons.Default.AltRoute)
        }
        category.contains("Electricity", ignoreCase = true) || category.contains("Light", ignoreCase = true) -> {
            Triple(Color(0xFF3B82F6), if (isDark) Color(0xFF172554) else Color(0xFFDBEAFE), Icons.Default.Bolt)
        }
        category.contains("Waste", ignoreCase = true) || category.contains("Dump", ignoreCase = true) -> {
            Triple(Color(0xFF3B82F6), if (isDark) Color(0xFF172554) else Color(0xFFDBEAFE), Icons.Default.Delete)
        }
        else -> {
            Triple(Color(0xFF3B82F6), if (isDark) Color(0xFF172554) else Color(0xFFDBEAFE), Icons.Default.Warning)
        }
    }

    val dateStr = try {
        val inputFormat = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
        inputFormat.timeZone = java.util.TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(complaint.created_at ?: "")
        val outputFormat = java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.US)
        outputFormat.format(date ?: java.util.Date())
    } catch (_: Exception) {
        complaint.created_at?.take(10) ?: "12 May 2024"
    }

    val status = complaint.status ?: "Pending"
    val (statusColor, statusBg) = when (status) {
        "Resolved" -> Pair(Color(0xFF059669), if (isDark) Color(0xFF022C22) else Color(0xFFECFDF5))
        else -> Pair(Color(0xFF2563EB), if (isDark) Color(0xFF172554) else Color(0xFFEFF6FF))
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .background(iconBg, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = iconVec,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(24.dp)
            )
        }
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = complaint.title?.takeIf { it.isNotBlank() } ?: complaint.category ?: "Issue",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = Color(0xFF10B981),
                    modifier = Modifier.size(12.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = complaint.address ?: "Location",
                    color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1
                )
            }
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = dateStr,
                color = if (isDark) Color(0xFF64748B) else Color(0xFF94A3B8),
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
        }
        
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .background(statusBg, RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 5.dp)
            ) {
                Text(
                    text = status,
                    color = statusColor,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = if (isDark) Color(0xFF475569) else Color(0xFFCBD5E1),
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Composable
fun ActiveAlertSection(alerts: List<Alert>, isDark: Boolean, onAlertClick: () -> Unit) {
    val activeAlert = alerts.firstOrNull()
    val alertTitle = activeAlert?.title ?: "Heavy Rain Warning"
    val alertMessage = activeAlert?.message ?: "Please stay safe and avoid unnecessary travel."

    Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)) {
        Text(
            text = "Active Alert",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onBackground
        )
        Spacer(modifier = Modifier.height(12.dp))
        
        Card(
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, if (isDark) Color(0xFF450A0A) else Color(0xFFFEE2E2)),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onAlertClick() }
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .background(if (isDark) Color(0xFF450A0A) else Color(0xFFFEE2E2), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = "Alert",
                        tint = Color(0xFFEF4444),
                        modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = alertTitle,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = alertMessage,
                        color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 2,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                    )
                }
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = if (isDark) Color(0xFF475569) else Color(0xFFCBD5E1),
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
fun EmergencyServicesSection() {
    val context = LocalContext.current

    fun dial(number: String) {
        try {
            val intent = Intent(Intent.ACTION_DIAL).apply {
                data = Uri.parse("tel:$number")
            }
            context.startActivity(intent)
        } catch (_: Exception) {}
    }

    Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)) {
        Text(
            text = "Emergency Services",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground
        )
        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Police Card
            EmergencyCard(
                name = "Police",
                number = "100",
                icon = Icons.Filled.LocalPolice,
                color = Color(0xFF2563EB),
                onClick = { dial("100") },
                modifier = Modifier.weight(1f)
            )

            // Ambulance Card
            EmergencyCard(
                name = "Ambulance",
                number = "108",
                icon = Icons.Filled.AirportShuttle,
                color = Color(0xFFEF4444),
                onClick = { dial("108") },
                modifier = Modifier.weight(1f)
            )

            // Fire Card
            EmergencyCard(
                name = "Fire Service",
                number = "101",
                icon = Icons.Default.Whatshot,
                color = Color(0xFFF97316),
                onClick = { dial("101") },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
fun EmergencyCard(
    name: String,
    number: String,
    icon: ImageVector,
    color: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isDark = isSystemInDarkTheme()
    Card(
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, if (isDark) Color(0xFF334155) else Color(0xFFE2E8F0)),
        colors = CardDefaults.cardColors(
            containerColor = if (isDark) MaterialTheme.colorScheme.surface else Color.White
        ),
        modifier = modifier
            .height(72.dp)
            .clickable { onClick() }
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Start
        ) {
            Icon(
                imageVector = icon,
                contentDescription = name,
                tint = color,
                modifier = Modifier.size(30.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Column(verticalArrangement = Arrangement.Center) {
                Text(
                    text = name,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1
                )
                Text(
                    text = number,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = color
                )
            }
        }
    }
}
