import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement
} from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  LayoutDashboard, ClipboardList, Users as UsersIcon, MapPin, FileText, Bell, Settings, LogOut, 
  Search, Filter, Download, ArrowUpRight, CheckCircle, Clock, AlertCircle, Eye, ShieldCheck, 
  Send, Zap, Activity, Globe, Sun, Moon, ArrowLeft, Briefcase, Calendar, Smartphone, User
} from 'lucide-react';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement);

// Fix Leaflet marker icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const ADMIN_ACCOUNTS = {
  "admin@badarpur.gov": { password: "admin", district: "Karimganj", name: "Badarpur Municipality" },
  "admin@jorhat.gov": { password: "admin", district: "Jorhat", name: "Jorhat Municipality" }
};

const App = () => {
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedIntel, setSelectedIntel] = useState(null);
  const [previousPage, setPreviousPage] = useState('dashboard');
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const handleAnalyze = (complaint) => {
    setSelectedIntel(complaint);
    setPreviousPage(activePage);
    setActivePage('complaint_details');
  };
  
  // Custom interactive mock settings
  const [suspendedUsers, setSuspendedUsers] = useState({});
  const [municipalProfile, setMunicipalProfile] = useState({
    officeName: "Badarpur Municipal Corporation",
    eoName: "S. K. Das, Executive Officer",
    phone: "+91 94350 48215",
    address: "Station Road, Badarpur, Karimganj, Assam - 788806"
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('scms_admin_theme');
    return saved ? saved === 'dark' : true;
  });

  const [adminProfile, setAdminProfile] = useState(() => {
    const saved = localStorage.getItem('scms_admin_session');
    if (saved) return JSON.parse(saved);
    return { email: "admin@badarpur.gov", district: "Karimganj", name: "Badarpur Municipality" };
  });

  useEffect(() => {
    localStorage.setItem('scms_admin_theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!adminProfile) return;
    setLoading(true);
    let unsubComplaints = () => {};
    let unsubUsers = () => {};
    let unsubAlerts = () => {};

    const safetyTimer = setTimeout(() => {
      setLoading(false);
      console.warn('⚠️ Firestore took too long — showing UI with available data');
    }, 8000);

    try {
      const qC = query(collection(db, "complaints"), orderBy("created_at", "desc"));
      unsubComplaints = onSnapshot(qC, (snap) => {
        clearTimeout(safetyTimer);
        let docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (adminProfile.district) {
            docs = docs.filter(d => !d.district || d.district.toLowerCase() === adminProfile.district.toLowerCase());
        }
        setComplaints(docs);
        setLoading(false);
      }, (err) => {
        clearTimeout(safetyTimer);
        if (err.code === 'failed-precondition' || err.message?.includes('index')) {
          console.error('🔴 Firestore Missing Index Error:', err.message);
          setLoading(false);
        } else {
          setLoading(false);
          setError(`Database Access Error: ${err.message}`);
        }
      });

      unsubUsers = onSnapshot(query(collection(db, "users")), (snap) => {
        setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => console.warn('Users fetch error:', err.message));

      unsubAlerts = onSnapshot(query(collection(db, "alerts"), orderBy("created_at", "desc")), (snap) => {
        setAlerts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => console.warn('Alerts fetch error:', err.message));
    } catch (e) {
      clearTimeout(safetyTimer);
      setLoading(false);
      setError(e.message);
    }

    return () => {
      clearTimeout(safetyTimer);
      unsubComplaints();
      unsubUsers();
      unsubAlerts();
    };
  }, [adminProfile]);

  const sendBroadcast = async (broadcastTitle = "Announcement", broadcastArea = "All Districts", broadcastType = "Advisory") => {
    if (!broadcastMsg) return;
    try {
      await addDoc(collection(db, "alerts"), {
        title: broadcastTitle,
        message: broadcastMsg,
        area: broadcastArea,
        type: broadcastType,
        created_at: serverTimestamp()
      });
      setBroadcastMsg("");
      alert("📡 Announcement broadcasted successfully!");
    } catch (e) { console.error(e); }
  };

  const updateStatus = async (id, newStatus, additionalData = null) => {
    try {
      if (newStatus === 'Assigned' && additionalData?.department) {
        await fetch(`http://localhost:3000/complaint/department/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ department: additionalData.department })
        });
      } else if (newStatus === 'Resolved' && additionalData?.file) {
        const formData = new FormData();
        formData.append('photo', additionalData.file);
        await fetch(`http://localhost:3000/complaint/resolve-proof/${id}`, {
          method: 'POST',
          body: formData
        });
      } else if (newStatus === 'High' || newStatus === 'Medium' || newStatus === 'Low') {
        await fetch(`http://localhost:3000/complaint/severity/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ severity: newStatus })
        });
      } else {
        await fetch(`http://localhost:3000/complaint/status/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
      }
      setSelectedIntel(null);
    } catch (e) { console.error(e); }
  };

  if (!adminProfile) return <LoginScreen onLogin={setAdminProfile} />;
  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen msg={error} />;

  return (
    <div className={`admin-layout ${isDarkMode ? 'dark' : ''}`}>
      {/* 🏛️ SIDEBAR */}
      <aside className="sidebar animate-slide bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors">
        <div className="sidebar-logo p-8 border-b border-slate-100 dark:border-slate-800">
          <div className="logo-box bg-teal-700 dark:bg-teal-600"><Globe size={28} /></div>
          <div className="mt-4">
            <h2 className="text-xl font-black tracking-tighter text-slate-800 dark:text-slate-100">SCMS Portal</h2>
            <p className="text-[9px] text-teal-600 dark:text-teal-400 font-black uppercase tracking-[0.2em]">Municipal Admin</p>
          </div>
        </div>

        <nav className="nav-links flex-1 py-6">
          <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activePage === 'dashboard'} onClick={() => setActivePage('dashboard')} />
          <NavItem icon={<ClipboardList size={20}/>} label="Complaints List" active={activePage === 'complaints'} onClick={() => setActivePage('complaints')} />
          <NavItem icon={<UsersIcon size={20}/>} label="Registered Citizens" active={activePage === 'users'} onClick={() => setActivePage('users')} />
          <NavItem icon={<MapPin size={20}/>} label="Complaints Map" active={activePage === 'locations'} onClick={() => setActivePage('locations')} />
          <NavItem icon={<FileText size={20}/>} label="Analytics Summary" active={activePage === 'reports'} onClick={() => setActivePage('reports')} />
          <NavItem icon={<Bell size={20}/>} label="Alert Broadcasts" active={activePage === 'alerts'} onClick={() => setActivePage('alerts')} />
          <NavItem icon={<Settings size={20}/>} label="Admin Settings" active={activePage === 'settings'} onClick={() => setActivePage('settings')} />
        </nav>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 mt-auto">
          <button onClick={() => {
            localStorage.removeItem('scms_admin_session');
            setAdminProfile(null);
          }} className="flex items-center gap-3 text-red-500 hover:text-red-700 font-black text-xs uppercase tracking-widest hover:opacity-90 px-4 bg-transparent border-none cursor-pointer">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* 🏙️ MAIN WORKSPACE */}
      <main className="main-content flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
        <header className="topbar">
          <div className="flex items-center gap-4">
            <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></div>
            <h1 className="text-sm font-black uppercase tracking-[0.3em] opacity-90">SCMS Admin Console</h1>
          </div>
          <div className="flex items-center gap-8">
             <button 
                onClick={() => setIsDarkMode(!isDarkMode)} 
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full border border-white/10 text-white transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
             >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
             </button>
             <div className="flex items-center gap-4 border-l border-white/20 pl-8">
                <div className="text-right">
                  <p className="text-xs font-black uppercase tracking-widest text-white">{adminProfile.name}</p>
                  <p className="text-[9px] opacity-70 font-bold text-teal-200">District: {adminProfile.district}</p>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-xl"><ShieldCheck size={20}/></div>
             </div>
          </div>
        </header>

        <div className="workspace-container">
          {activePage === 'dashboard' && <DashboardOverview complaints={complaints} users={users} adminProfile={adminProfile} onAnalyze={handleAnalyze} isDarkMode={isDarkMode} />}
          {activePage === 'complaints' && <ComplaintsRegistry complaints={complaints} users={users} onAnalyze={handleAnalyze} onUpdate={updateStatus} />}
          {activePage === 'users' && <CitizenMatrix users={users} complaints={complaints} suspendedUsers={suspendedUsers} setSuspendedUsers={setSuspendedUsers} />}
          {activePage === 'locations' && <GeospatialIntel complaints={complaints} />}
          {activePage === 'reports' && <AdvancedAnalytics complaints={complaints} users={users} isDarkMode={isDarkMode} />}
          {activePage === 'alerts' && <SignalLog alerts={alerts} broadcastMsg={broadcastMsg} setBroadcastMsg={setBroadcastMsg} onSend={sendBroadcast} />}
          {activePage === 'settings' && <SystemProtocols municipalProfile={municipalProfile} setMunicipalProfile={setMunicipalProfile} />}
          {activePage === 'complaint_details' && (
            <ComplaintDetailsView 
              complaint={selectedIntel} 
              users={users} 
              onBack={() => setActivePage(previousPage)} 
              onUpdate={updateStatus} 
            />
          )}
        </div>
      </main>
    </div>
  );
};

/* 📊 DASHBOARD OVERVIEW */
const DashboardOverview = ({ complaints, users, adminProfile, onAnalyze, isDarkMode }) => {
  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => c.status === 'Pending').length,
    critical: complaints.filter(c => c.severity === 'High' && c.status !== 'Resolved').length,
    users: users.length
  };

  const departmentCounts = {
    "Public Works Dept (PWD)": 0,
    "Water Supply Board": 0,
    "Electricity Board": 0,
    "Waste Management": 0,
    "Police / Civil Defence": 0,
    "Unassigned": 0
  };

  complaints.forEach(c => {
    if (c.department && departmentCounts[c.department] !== undefined) {
      departmentCounts[c.department]++;
    } else {
      departmentCounts["Unassigned"]++;
    }
  });

  return (
    <div className="p-10 animate-fade">
      
      {/* 🌟 MUNICIPALITY BANNER */}
      <div className="mb-10 bg-gradient-to-r from-teal-900 to-slate-900 dark:from-teal-950 dark:to-slate-950 p-10 rounded-[40px] shadow-2xl relative overflow-hidden text-white border border-teal-800 dark:border-teal-900">
         <div className="absolute top-0 right-0 p-8 opacity-10"><Globe size={150} /></div>
         <div className="relative z-10">
            <h2 className="text-4xl font-black tracking-tighter mb-2 text-white">{adminProfile?.district?.toUpperCase()} MUNICIPALITY</h2>
            <p className="text-teal-400 dark:text-teal-300 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <ShieldCheck size={16}/> {adminProfile?.name} • Administrative Dashboard
            </p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <StatTile icon={<Activity size={24}/>} label="Total Complaints" value={stats.total} color="text-teal-700 dark:text-teal-400" bg="bg-teal-50 dark:bg-teal-950/20" />
        <StatTile icon={<Clock size={24}/>} label="Pending Issues" value={stats.pending} color="text-orange-700 dark:text-orange-400" bg="bg-orange-50 dark:bg-orange-950/20" />
        <StatTile icon={<AlertCircle size={24}/>} label="High Priority" value={stats.critical} color="text-red-700 dark:text-red-400" bg="bg-red-50 dark:bg-red-950/20" />
        <StatTile icon={<UsersIcon size={24}/>} label="Registered Citizens" value={stats.users} color="text-blue-700 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-950/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left main area */}
        <div className="lg:col-span-8 flex flex-col gap-10">
          {/* Trend Chart */}
          <div className="admin-card p-8 relative overflow-hidden">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-8">Weekly Complaint Trends</h3>
             <div className="h-[300px]">
               <Line data={{
                 labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                 datasets: [{
                   label: 'Complaints Logged',
                   data: [12, 19, 15, 25, 22, 30, stats.total],
                   borderColor: isDarkMode ? '#14b8a6' : '#0f766e',
                   borderWidth: 4,
                   pointRadius: 6,
                   pointBackgroundColor: 'white',
                   tension: 0.4,
                   fill: true,
                   backgroundColor: isDarkMode ? 'rgba(20, 184, 166, 0.05)' : 'rgba(15, 118, 110, 0.05)'
                 }]
               }} options={{ 
                 maintainAspectRatio: false, 
                 plugins: {
                   legend: {
                     labels: {
                       color: isDarkMode ? '#f8fafc' : '#0f172a'
                     }
                   }
                 },
                 scales: { 
                   y: { 
                     grid: { color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                     ticks: { color: isDarkMode ? '#94a3b8' : '#64748b' }
                   }, 
                   x: { 
                     grid: { display: false },
                     ticks: { color: isDarkMode ? '#94a3b8' : '#64748b' }
                   } 
                 } 
               }} />
             </div>
          </div>

          {/* Recent Complaints Table */}
          <div className="admin-card overflow-hidden">
             <div className="p-8 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Recent Complaints</h3>
                <span className="bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 px-4 py-1 rounded-full text-[10px] font-black">LIVE</span>
             </div>
             <div className="overflow-x-auto">
               <table className="elite-table">
                 <thead>
                   <tr>
                     <th className="dark:text-slate-400">ID</th>
                     <th className="dark:text-slate-400">Category</th>
                     <th className="dark:text-slate-400">Reporter</th>
                     <th className="dark:text-slate-400">District</th>
                     <th className="dark:text-slate-400">Address</th>
                     <th className="dark:text-slate-400">Status</th>
                     <th className="dark:text-slate-400">Action</th>
                   </tr>
                 </thead>
                 <tbody>
                   {complaints.slice(0, 6).map(c => (
                     <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                       <td className="font-black text-teal-700 dark:text-teal-400 text-[10px]">#C-{c.id?.toString().slice(-4)}</td>
                       <td className="font-bold text-sm text-slate-800 dark:text-slate-200">{c.category}</td>
                       <td className="text-slate-650 dark:text-slate-300 text-xs font-semibold">
                         {users?.find(u => u.id?.toString() === c.user_id?.toString())?.name || c.reporter_name || c.user_name || 'Anonymous'}
                       </td>
                       <td className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase">{c.district || '—'}</td>
                       <td className="text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase truncate max-w-[140px]">{c.address || 'Field Location'}</td>
                       <td>
                         <span className={`badge-elite badge-${(c.status || 'pending').toLowerCase()} ${c.severity === 'High' ? 'badge-critical' : ''}`}>
                           {c.status}
                         </span>
                       </td>
                       <td>
                         <button onClick={() => onAnalyze(c)} className="p-3 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-2xl text-teal-700 dark:text-teal-400 transition-all active:scale-90 bg-transparent border-none cursor-pointer">
                           <Eye size={18}/>
                         </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>

        {/* Right sidebar area */}
        <div className="lg:col-span-4 flex flex-col gap-10">
          {/* Pie Chart */}
          <div className="admin-card p-8">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-8">Complaints by Category</h3>
             <div className="h-[250px]">
               <Pie data={{
                 labels: ['Waste', 'Roads', 'Water', 'Electric', 'Safety'],
                 datasets: [{
                   data: [30, 20, 25, 15, 10],
                   backgroundColor: ['#0d9488', '#0891b2', '#0284c7', '#4f46e5', '#7c3aed'],
                   borderWidth: 0
                 }]
               }} options={{ 
                 maintainAspectRatio: false, 
                 plugins: { 
                   legend: { 
                     position: 'bottom', 
                     labels: { 
                       color: isDarkMode ? '#f8fafc' : '#0f172a',
                       font: { size: 10, weight: '900' }, 
                       usePointStyle: true 
                     } 
                   } 
                 } 
               }} />
             </div>
          </div>

          {/* Department Workloads */}
          <div className="department-workload-card">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-teal-400 mb-6">Department Distribution</h3>
             <div className="space-y-6">
                <UnitStatus label="Public Works" status={`${departmentCounts["Public Works Dept (PWD)"]} complaints`} />
                <UnitStatus label="Water Supply" status={`${departmentCounts["Water Supply Board"]} complaints`} />
                <UnitStatus label="Electricity" status={`${departmentCounts["Electricity Board"]} complaints`} />
                <UnitStatus label="Waste Management" status={`${departmentCounts["Waste Management"]} complaints`} />
                <UnitStatus label="Unassigned" status={`${departmentCounts["Unassigned"]} pending`} color="text-orange-400 dark:text-orange-300" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* 🗺️ COMPLAINTS MAP (LEAFLET MAP) */
const GeospatialIntel = ({ complaints }) => {
  const sessionData = localStorage.getItem('scms_admin_session');
  const session = sessionData ? JSON.parse(sessionData) : null;
  const [selectedCategory, setSelectedCategory] = useState("");
  
  let defaultCenter = [24.8667, 92.5667]; 
  if (session && session.district === "Jorhat") {
    defaultCenter = [26.7509, 94.2037]; 
  }

  const categories = Array.from(new Set(complaints.map(c => c.category).filter(Boolean)));

  const validComplaints = complaints.filter(c => c.latitude && c.longitude && (!selectedCategory || c.category === selectedCategory));
  const mapCenter = validComplaints.length > 0 
    ? [parseFloat(validComplaints[0].latitude), parseFloat(validComplaints[0].longitude)] 
    : defaultCenter;

  return (
    <div className="p-10 animate-fade">
      <div className="mb-10 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">Complaints Map</h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em]">Live complaints visualized across the municipality</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Filter Category:</label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-4 py-2 text-xs font-bold rounded-2xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="bg-white dark:bg-slate-800 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 shadow-sm transition-colors">
            <MapPin size={16} className="text-red-500"/>
            <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">Active Pins: {validComplaints.length}</span>
          </div>
        </div>
      </div>
      <div className="map-frame">
        <MapContainer key={mapCenter.join(',')} center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {validComplaints.map(c => (
            <Marker key={c.id} position={[parseFloat(c.latitude), parseFloat(c.longitude)]}>
              <Popup>
                 <div className="p-2">
                   <p className="font-black text-teal-700 dark:text-teal-400 text-xs uppercase mb-1">{c.category}</p>
                   <p className="text-[10px] text-slate-500 dark:text-slate-400">{c.address}</p>
                   <p className={`text-[9px] font-black uppercase mt-2 ${c.status === 'Resolved' ? 'text-green-600' : c.status === 'Escalated' ? 'text-red-600' : 'text-orange-600'}`}>Status: {c.status}</p>
                 </div>
              </Popup>
              <Circle center={[parseFloat(c.latitude), parseFloat(c.longitude)]} radius={200} pathOptions={{ color: c.severity === 'High' ? 'red' : 'teal' }} />
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

/* 🔍 COMPLAINT DETAILS VIEW */
const ComplaintDetailsView = ({ complaint, users, onBack, onUpdate }) => {
  const [department, setDepartment] = useState(complaint.department || "");
  const [resolvePhoto, setResolvePhoto] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const fileInputRef = useRef(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showDeptMenu, setShowDeptMenu] = useState(false);
  const [showResolveMenu, setShowResolveMenu] = useState(false);
  
  const photos = complaint.photo_urls?.length > 0 ? complaint.photo_urls : (complaint.photoUrl ? [complaint.photoUrl] : []);

  const handleAssign = () => {
    if (!department) return alert("Select a department first.");
    onUpdate(complaint.id, 'Assigned', { department });
    setShowDeptMenu(false);
  };

  const handleResolve = () => {
    if (!resolvePhoto) return alert("Please upload a resolution photo first.");
    setIsResolving(true);
    onUpdate(complaint.id, 'Resolved', { file: resolvePhoto });
    setShowResolveMenu(false);
  };

  const handleResolveNoProof = () => {
    onUpdate(complaint.id, 'Resolved');
    setShowResolveMenu(false);
  };

  const displayId = `CMP-${complaint.created_at?.toDate ? complaint.created_at.toDate().getFullYear() : (new Date(complaint.created_at).getFullYear() || 2026)}-${String(complaint.id).padStart(5, '0')}`;
  
  const formattedDate = complaint.created_at?.toDate 
    ? complaint.created_at.toDate().toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
    : (complaint.created_at?.slice?.(0, 16)?.replace('T', ' ') || '—');

  return (
    <div className="p-8 min-h-screen bg-slate-50/50 dark:bg-slate-950/40 animate-fade">
      
      {/* Breadcrumbs Header */}
      <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">Complaint Details</h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">
            Home &gt; Complaints &gt; Complaint Details
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column (Info Card + Timeline) - 4 cols span */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Back button */}
          <div>
            <button 
              onClick={onBack} 
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition-all shadow-sm"
            >
              <ArrowLeft size={14} /> Back to Complaints
            </button>
          </div>

          {/* Complaint ID Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl flex flex-col gap-4 shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Complaint ID</span>
              <h3 className="text-xl font-extrabold text-teal-600 dark:text-teal-400 mt-1 tracking-tight">{displayId}</h3>
              <div className="mt-2">
                <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${complaint.severity === 'High' ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50' : 'bg-slate-100 text-slate-655 dark:bg-slate-800 dark:text-slate-350'}`}>
                  {complaint.severity || 'Medium'} Priority
                </span>
              </div>
            </div>

            {/* Metadata Table */}
            <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-450 dark:text-slate-500 font-bold flex items-center gap-2"><Briefcase size={13} /> Category</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">{complaint.category || '—'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-450 dark:text-slate-500 font-bold flex items-center gap-2"><Clock size={13} /> Date & Time</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">{formattedDate}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-450 dark:text-slate-500 font-bold flex items-center gap-2"><User size={13} /> Reported By</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {users?.find(u => u.id?.toString() === complaint.user_id?.toString())?.name || complaint.reporter_name || complaint.user_name || "Anonymous Citizen"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-450 dark:text-slate-500 font-bold flex items-center gap-2"><Smartphone size={13} /> Source</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">Mobile App</span>
              </div>
            </div>
          </div>

          {/* Status Timeline Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <h4 className="text-xs font-black uppercase text-slate-450 dark:text-slate-500 tracking-wider mb-6">Status Timeline</h4>
            <div className="flex flex-col gap-6 pl-2">
              <TimelineRow 
                label="Submitted" 
                time={formattedDate} 
                checked 
                line 
              />
              <TimelineRow 
                label="Under Review" 
                time={complaint.status !== 'Pending' ? 'Active Status' : '—'} 
                checked={complaint.status !== 'Pending'}
                active={complaint.status === 'Assigned' || complaint.status === 'Verified'} 
                line 
              />
              <TimelineRow 
                label="In Progress" 
                time={complaint.status === 'In Progress' || complaint.status === 'Verification Pending' || complaint.status === 'Resolved' ? 'Working State' : '—'} 
                checked={complaint.status === 'In Progress' || complaint.status === 'Verification Pending' || complaint.status === 'Resolved'}
                active={complaint.status === 'In Progress'} 
                line 
              />
              <TimelineRow 
                label="Resolved" 
                time={complaint.status === 'Resolved' ? 'Verified Resolved' : (complaint.status === 'Verification Pending' ? 'Pending Verification' : '—')} 
                checked={complaint.status === 'Resolved' || complaint.status === 'Verification Pending'}
                active={complaint.status === 'Resolved' || complaint.status === 'Verification Pending'} 
              />
            </div>
          </div>

        </div>

        {/* Right Column (Images, Description, Details Row, Actions) - 8 cols span */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Complaint Images Slider Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <h4 className="text-xs font-black uppercase text-slate-450 dark:text-slate-500 tracking-wider mb-4">Complaint Images</h4>
            
            {/* Images layout */}
            <div className="relative w-full aspect-[2.2/1] rounded-xl overflow-hidden border border-slate-100 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
              {photos.length > 0 ? (
                <div className="flex gap-4 p-4 w-full h-full overflow-x-auto justify-center">
                  {photos.map((p, idx) => (
                    <div key={idx} className="relative h-full aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-850 flex-shrink-0 shadow-sm">
                      <img src={p} className="w-full h-full object-cover" alt="Complaint Evidence" />
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">No Photo Evidence</span>
              )}
            </div>

            {/* Description section */}
            <div className="mt-6">
              <h5 className="text-xs font-black uppercase text-slate-450 dark:text-slate-500 tracking-wider mb-2">Description</h5>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-850/20 p-4 rounded-xl">
                {complaint.description || "No description provided."}
              </p>
            </div>

            {/* 3 boxes details row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              
              {/* Box 1: Location */}
              <div className="flex items-start gap-3 p-4 bg-slate-50/50 dark:bg-slate-850/20 border border-slate-150 dark:border-slate-800 rounded-xl">
                <div className="p-2 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-lg mt-0.5"><MapPin size={16}/></div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Location</span>
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{complaint.place || 'Assam Jurisdiction'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{complaint.district || 'Karimganj'}</p>
                </div>
              </div>

              {/* Box 2: Assigned Department */}
              <div className="flex items-start gap-3 p-4 bg-slate-50/50 dark:bg-slate-850/20 border border-slate-150 dark:border-slate-800 rounded-xl">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg mt-0.5"><Briefcase size={16}/></div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Assigned Department</span>
                  <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">{complaint.department || 'Unassigned'}</p>
                </div>
              </div>

              {/* Box 3: Assigned Officer */}
              <div className="flex items-start gap-3 p-4 bg-slate-50/50 dark:bg-slate-850/20 border border-slate-150 dark:border-slate-800 rounded-xl">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg mt-0.5"><User size={16}/></div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Assigned Officer</span>
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{complaint.department ? 'Regional Officer' : '—'}</p>
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-1">{complaint.department ? 'Junior Engineer' : 'Awaiting assignment'}</p>
                </div>
              </div>

            </div>

          </div>

          {/* Notes Card */}
          <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 p-5 rounded-2xl flex items-start gap-4 shadow-sm">
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg mt-0.5"><FileText size={16}/></div>
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 leading-relaxed">
                {complaint.status === 'Pending' ? 'The complaint is pending review by the municipal administrator. Department routing will occur upon review.' : 
                 complaint.status === 'Assigned' ? 'The complaint is assigned to the respective department. A regional officer has been notified to inspect.' :
                 complaint.status === 'In Progress' ? 'Work order has been dispatched. Field operators are working on resolving the hazard.' :
                 complaint.status === 'Verification Pending' ? 'Resolution proof uploaded. Awaiting citizen verification to finalize ticket.' :
                 'The complaint has been successfully resolved and verified by local citizens.'}
              </p>
              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-500 mt-2 block uppercase tracking-wider">SCMS Automated Update System</span>
            </div>
          </div>

          {/* Actions Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col gap-4">
            <h4 className="text-xs font-black uppercase text-slate-450 dark:text-slate-500 tracking-wider">Actions</h4>
            
            {/* Buttons Row */}
            <div className="flex gap-4 flex-wrap">
              <button 
                onClick={() => { setShowStatusMenu(!showStatusMenu); setShowDeptMenu(false); setShowResolveMenu(false); }}
                className={`flex-1 min-w-[150px] py-3.5 px-6 rounded-xl text-white text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all hover:opacity-90 border-none ${showStatusMenu ? 'bg-teal-700 dark:bg-teal-850' : 'bg-teal-600'}`}
              >
                Update Status
              </button>
              
              <button 
                onClick={() => { setShowDeptMenu(!showDeptMenu); setShowStatusMenu(false); setShowResolveMenu(false); }}
                className={`flex-1 min-w-[180px] py-3.5 px-6 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all bg-white dark:bg-slate-900 border text-slate-700 dark:text-slate-200 ${showDeptMenu ? 'border-teal-500 bg-teal-50/10' : 'border-slate-200 dark:border-slate-700'}`}
              >
                Assign to Department
              </button>

              <button 
                onClick={() => { setShowResolveMenu(!showResolveMenu); setShowStatusMenu(false); setShowDeptMenu(false); }}
                className={`flex-1 min-w-[150px] py-3.5 px-6 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 ${showResolveMenu ? 'border-rose-500 bg-rose-50/10' : ''}`}
              >
                Mark as Resolved
              </button>
            </div>

            {/* Status Selector menu */}
            {showStatusMenu && (
              <div className="p-4 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col gap-3 animate-fade">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Choose New Status</span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <button onClick={() => { onUpdate(complaint.id, 'High'); setShowStatusMenu(false); }} className="py-2.5 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-755 hover:border-red-500 text-slate-750 dark:text-slate-200 text-xs font-bold rounded-lg cursor-pointer transition-all">Flag High Priority</button>
                  <button onClick={() => { onUpdate(complaint.id, 'In Progress'); setShowStatusMenu(false); }} className="py-2.5 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-755 hover:border-teal-500 text-slate-750 dark:text-slate-200 text-xs font-bold rounded-lg cursor-pointer transition-all">Mark In Progress</button>
                  <button onClick={() => { onUpdate(complaint.id, 'Escalated'); setShowStatusMenu(false); }} className="py-2.5 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-755 hover:border-orange-500 text-slate-750 dark:text-slate-200 text-xs font-bold rounded-lg cursor-pointer transition-all">Escalate</button>
                  <button onClick={() => { onUpdate(complaint.id, 'Pending'); setShowStatusMenu(false); }} className="py-2.5 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-755 hover:border-slate-400 text-slate-750 dark:text-slate-200 text-xs font-bold rounded-lg cursor-pointer transition-all">Set back to Pending</button>
                </div>
              </div>
            )}

            {/* Department assignment menu */}
            {showDeptMenu && (
              <div className="p-4 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col gap-3 animate-fade">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Select Department</span>
                <div className="flex gap-2">
                  <select 
                    className="flex-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-xs font-bold"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="">Select Department...</option>
                    <option value="Public Works Dept (PWD)">Public Works (PWD)</option>
                    <option value="Water Supply Board">Water Supply Board</option>
                    <option value="Electricity Board">Electricity Board</option>
                    <option value="Waste Management">Waste Management</option>
                    <option value="Police / Civil Defence">Police / Civil Defence</option>
                  </select>
                  <button onClick={handleAssign} className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer border-none transition-all">Assign</button>
                </div>
              </div>
            )}

            {/* Resolution flow menu */}
            {showResolveMenu && (
              <div className="p-4 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col gap-3 animate-fade">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Mark as Resolved</span>
                
                {/* Upload proof */}
                <div className="flex gap-2 items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={(e) => setResolvePhoto(e.target.files[0])}
                  />
                  <button 
                    onClick={() => fileInputRef.current.click()}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-350 font-bold text-xs py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer truncate max-w-[200px]"
                  >
                    {resolvePhoto ? resolvePhoto.name : "📷 Upload Proof Photo"}
                  </button>
                  <button 
                    onClick={handleResolve}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer border-none transition-all"
                  >
                    {isResolving ? "Uploading..." : "Resolve with Proof"}
                  </button>
                </div>
                
                <div className="flex justify-between items-center text-xs text-slate-450 mt-2">
                  <span>Or directly resolve without upload:</span>
                  <button onClick={handleResolveNoProof} className="underline text-rose-600 hover:text-rose-700 font-bold bg-transparent border-none cursor-pointer">Resolve (No Photo)</button>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};

/* 🕒 TIMELINE ROW HELPER */
const TimelineRow = ({ label, time, checked, active, line }) => (
  <div className="relative flex gap-4">
    {line && (
      <div className={`absolute top-5 bottom-0 left-[9px] w-0.5 -translate-x-1/2 ${checked ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
    )}
    
    <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-5 h-5">
      {checked ? (
        <CheckCircle size={18} className="text-emerald-500 bg-white dark:bg-slate-900 rounded-full" />
      ) : active ? (
        <div className="w-[16px] h-[16px] rounded-full border-4 border-teal-500 bg-white dark:bg-slate-900 flex-shrink-0" />
      ) : (
        <div className="w-[16px] h-[16px] rounded-full border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0" />
      )}
    </div>

    <div>
      <h5 className={`text-xs font-extrabold uppercase ${checked ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>{label}</h5>
      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{time}</span>
      {active && (
        <span className="mt-1 inline-block text-[8px] font-black uppercase tracking-wider bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 px-1.5 py-0.5 rounded">
          Current
        </span>
      )}
    </div>
  </div>
);

/* Checklist helper item */
const ChecklistItem = ({ label, checked }) => (
  <div className="checklist-item">
    {checked ? (
      <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />
    ) : (
      <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300 dark:border-slate-600 flex-shrink-0" />
    )}
    <span className={`text-xs font-semibold ${checked ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-205'}`}>
      {label}
    </span>
  </div>
);

/* 🧱 SUB-COMPONENTS & UTILS */

const StatTile = ({ icon, label, value, color, bg }) => (
  <div className={`stat-card-premium ${bg} border border-slate-150 dark:border-slate-700/50 hover:translate-y-[-10px]`}>
    <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center ${color} mb-6 shadow-xl border border-white/50 dark:border-slate-800`}>{icon}</div>
    <p className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">{label}</p>
    <h4 className={`text-4xl font-black ${color} tracking-tighter`}>{value}</h4>
  </div>
);

const TimelineItem = ({ status, time, note, active }) => (
  <div className="timeline-item flex gap-5">
    <div className="timeline-dot"></div>
    <div className="pb-6">
      <p className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-teal-700 dark:text-teal-400' : 'text-slate-450 dark:text-slate-500'}`}>{status}</p>
      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-500 mb-1">{time}</p>
      <p className="text-[11px] font-semibold text-slate-750 dark:text-slate-300">{note}</p>
    </div>
  </div>
);

const NavItem = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`nav-item ${active ? 'active' : ''}`}>
    {icon} 
    <span className="uppercase tracking-widest text-left">{label}</span>
  </button>
);

const UnitStatus = ({ label, status, color = "text-green-500 dark:text-green-300" }) => (
  <div className="flex justify-between items-center">
    <span className="text-[10px] font-black uppercase tracking-widest opacity-75">{label}</span>
    <span className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{status}</span>
  </div>
);

const TacticalBtn = ({ label, icon, onClick, color }) => (
  <button onClick={onClick} className={`${color} p-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest hover:scale-[1.03] active:scale-95 transition-all shadow-md border-none cursor-pointer`}>{icon} {label}</button>
);

const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-slate-900 dark:bg-[#090d16] text-white transition-colors">
    <div className="w-16 h-16 border-t-4 border-teal-500 rounded-full animate-spin mb-8"></div>
    <h2 className="text-xl font-black uppercase tracking-[0.4em] animate-pulse">Loading SCMS Portal...</h2>
  </div>
);

const ErrorScreen = ({ msg }) => (
  <div className="flex items-center justify-center h-screen bg-slate-900 dark:bg-[#090d16] p-10 transition-colors">
    <div className="bg-red-500/10 p-10 rounded-[40px] border border-red-500/20 text-center max-w-md">
      <AlertCircle size={60} className="text-red-500 mx-auto mb-6" />
      <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter">Database Error</h2>
      <p className="text-red-400 text-sm font-bold mb-8">{msg}</p>
      <button onClick={() => window.location.reload()} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-600/30 border-none cursor-pointer">Retry Connection</button>
    </div>
  </div>
);

/* 🔐 AUTHORIZED LOGIN SCREEN */
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    const account = ADMIN_ACCOUNTS[email.toLowerCase()];
    if (account && account.password === password) {
      const profileData = { email, ...account };
      localStorage.setItem('scms_admin_session', JSON.stringify(profileData));
      onLogin(profileData);
    } else {
      setError("Invalid Credentials. Access Denied.");
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 dark:bg-[#090d16] items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-slate-800 p-10 rounded-[40px] w-full max-w-md shadow-2xl relative overflow-hidden animate-scale border border-slate-100 dark:border-slate-700/50 transition-colors">
        <div className="absolute top-0 right-0 p-8 opacity-5"><Globe size={100}/></div>
        <div className="flex flex-col items-center mb-8 relative z-10">
           <div className="w-16 h-16 bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded-3xl flex items-center justify-center mb-4"><ShieldCheck size={32}/></div>
           <h2 className="text-2xl font-black text-gray-800 dark:text-slate-100 tracking-tighter uppercase">SCMS Admin Login</h2>
           <p className="text-[10px] text-teal-700 dark:text-teal-400 font-black uppercase tracking-[0.2em] mt-1">Municipal Administrator Portal</p>
        </div>

        {error && <div className="bg-red-50 dark:bg-red-950/20 text-red-550 dark:text-red-400 p-3 rounded-xl text-xs font-bold mb-6 text-center border border-red-100 dark:border-red-900/30">{error}</div>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4 relative z-10">
          <div>
            <label className="text-[10px] font-black text-gray-500 dark:text-gray-500 uppercase tracking-widest ml-2">Official Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={e=>setEmail(e.target.value)} 
              className="w-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-none rounded-2xl p-4 text-sm font-bold mt-1 focus:ring-2 ring-teal-500/20" 
              placeholder="admin@badarpur.gov / admin@jorhat.gov" 
              required 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-500 dark:text-gray-500 uppercase tracking-widest ml-2">Secure Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              className="w-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-none rounded-2xl p-4 text-sm font-bold mt-1 focus:ring-2 ring-teal-500/20" 
              placeholder="••••••••" 
              required 
            />
          </div>
          <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl mt-4 hover:scale-[1.02] shadow-xl shadow-teal-600/30 dark:shadow-teal-950 transition-all border-none cursor-pointer">
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

/* 📋 COMPLAINTS REGISTRY (TABLE ONLY) */
const ComplaintsRegistry = ({ complaints, users, onAnalyze, onUpdate }) => {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");

  const categories = Array.from(new Set(complaints.map(c => c.category).filter(Boolean)));
  const districts = Array.from(new Set(complaints.map(c => c.district).filter(Boolean)));
  const statuses = Array.from(new Set(complaints.map(c => c.status).filter(Boolean)));

  const filtered = complaints.filter(c => {
    const matchesSearch = !search ||
      c.category?.toLowerCase().includes(search.toLowerCase()) ||
      c.address?.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = !filterCategory || c.category === filterCategory;
    const matchesDistrict = !filterDistrict || c.district === filterDistrict;
    const matchesStatus = !filterStatus || c.status === filterStatus;
    const matchesSeverity = !filterSeverity || c.severity === filterSeverity;

    return matchesSearch && matchesCategory && matchesDistrict && matchesStatus && matchesSeverity;
  });

  const exportToCSV = () => {
    const headers = ["ID", "Category", "Reporter", "District", "Address", "Date Logged", "Priority", "Status", "Department"];
    const rows = filtered.map(c => [
      c.id,
      c.category || "",
      users?.find(u => u.id?.toString() === c.user_id?.toString())?.name || c.reporter_name || c.user_name || "Anonymous",
      c.district || "",
      (c.address || c.place || "").replace(/,/g, " "),
      c.created_at?.toDate ? c.created_at.toDate().toISOString().slice(0,10) : (c.created_at?.slice?.(0,10) || ""),
      c.severity || "Medium",
      c.status || "Pending",
      c.department || "Unassigned"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `complaints_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-10 animate-fade">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">Complaints List</h2>
          <p className="text-[10px] font-black text-teal-700 dark:text-teal-400 uppercase tracking-widest">
            {filtered.length} shown · {filtered.filter(c => c.status === 'Pending').length} pending resolution
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" size={15}/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search address, category..."
              className="pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs w-60 font-bold text-slate-800 dark:text-slate-100 focus:ring-2 ring-teal-500/20"
            />
          </div>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] transition-all shadow-md shadow-teal-600/20 border-none cursor-pointer flex items-center gap-2"
          >
            <Download size={12}/> Export CSV
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 admin-card p-6 rounded-3xl">
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Category</label>
          <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} className="w-full text-xs font-bold p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100">
            <option value="">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">District</label>
          <select value={filterDistrict} onChange={e=>setFilterDistrict(e.target.value)} className="w-full text-xs font-bold p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100">
            <option value="">All Districts</option>
            {districts.map(dst => <option key={dst} value={dst}>{dst}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Status</label>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="w-full text-xs font-bold p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100">
            <option value="">All Statuses</option>
            {statuses.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Severity</label>
          <select value={filterSeverity} onChange={e=>setFilterSeverity(e.target.value)} className="w-full text-xs font-bold p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100">
            <option value="">All Severities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Main Registry Table */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="elite-table">
            <thead>
              <tr>
                <th className="dark:text-slate-400">ID</th>
                <th className="dark:text-slate-400">Category</th>
                <th className="dark:text-slate-400">Reporter</th>
                <th className="dark:text-slate-400">District</th>
                <th className="dark:text-slate-400">Address</th>
                <th className="dark:text-slate-400">Date</th>
                <th className="dark:text-slate-400">Priority</th>
                <th className="dark:text-slate-400">Status</th>
                <th className="dark:text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                  <td className="font-black text-teal-700 dark:text-teal-400 text-[10px]">#{c.id?.toString().slice(-6)}</td>
                  <td className="font-bold text-sm text-slate-800 dark:text-slate-200">{c.category}</td>
                  <td className="text-slate-600 dark:text-slate-300 text-xs font-semibold">{users?.find(u => u.id?.toString() === c.user_id?.toString())?.name || c.reporter_name || c.user_name || '—'}</td>
                  <td className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase">{c.district || '—'}</td>
                  <td className="text-slate-400 dark:text-slate-500 text-[10px] font-semibold max-w-[150px] truncate" title={c.address || c.place || '—'}>{c.address || c.place || '—'}</td>
                  <td className="text-slate-400 dark:text-slate-500 text-[10px] font-black">{c.created_at?.toDate ? c.created_at.toDate().toISOString().slice(0,10) : (c.created_at?.slice?.(0,10) || '—')}</td>
                  <td>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.severity === 'High' ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-350'}`}>
                      {c.severity || 'Medium'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-elite badge-${(c.status || 'pending').toLowerCase().replace(' ','-')} ${c.status === 'Escalated' ? 'badge-critical' : ''}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => onAnalyze(c)} className="p-2 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-xl text-teal-700 dark:text-teal-400 transition-all active:scale-90 bg-transparent border-none cursor-pointer">
                      <Eye size={16}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* 👤 CITIZEN DATABASE */
const CitizenMatrix = ({ users, complaints, suspendedUsers, setSuspendedUsers }) => {
  const [search, setSearch] = useState("");

  const filtered = users.filter(u => {
    return !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
  });

  const toggleSuspension = (userId) => {
    setSuspendedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  return (
    <div className="p-10 animate-fade">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">Registered Citizens</h2>
          <p className="text-[10px] font-black text-teal-700 dark:text-teal-400 uppercase tracking-widest">
            {users.length} active portal members
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" size={15}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search citizen name, email..."
            className="pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs w-64 font-bold text-slate-800 dark:text-slate-100 focus:ring-2 ring-teal-500/20"
          />
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="elite-table">
            <thead>
              <tr>
                <th className="dark:text-slate-400">Citizen</th>
                <th className="dark:text-slate-400">Email</th>
                <th className="dark:text-slate-400">Active Points</th>
                <th className="dark:text-slate-400">Status</th>
                <th className="dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const isSuspended = !!suspendedUsers[u.id];

                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold text-sm uppercase">
                          {u.name?.charAt(0) || 'C'}
                        </div>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{u.name || 'Citizen'}</span>
                      </div>
                    </td>
                    <td className="text-slate-600 dark:text-slate-350 text-xs font-semibold">{u.email}</td>
                    <td>
                      <span className="bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 px-3 py-1 rounded-full text-xs font-bold">
                        {u.points || 0} PTS
                      </span>
                    </td>
                    <td>
                      {isSuspended ? (
                        <span className="px-3 py-1 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-red-200 dark:border-red-900/50">Suspended</span>
                      ) : (
                        <span className="px-3 py-1 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-green-200 dark:border-green-900/50">Active</span>
                      )}
                    </td>
                    <td>
                      <button 
                        onClick={() => toggleSuspension(u.id)}
                        className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border cursor-pointer ${
                          isSuspended 
                            ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
                            : 'bg-red-50 hover:bg-red-100 text-red-650 dark:text-red-400 border-red-200 dark:border-red-900/50'
                        }`}
                      >
                        {isSuspended ? 'Reactivate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* 📈 ANALYTICS SCREEN */
const AdvancedAnalytics = ({ complaints, users, isDarkMode }) => {
  const total = complaints.length;
  const resolved = complaints.filter(c => c.status === 'Resolved').length;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const totalPoints = users.reduce((sum, u) => sum + (parseInt(u.points) || 0), 0);

  const categoriesCount = { Waste: 0, Roads: 0, Water: 0, Electricity: 0, Safety: 0 };
  complaints.forEach(c => {
    const cat = c.category?.toLowerCase();
    if (cat?.includes('waste') || cat?.includes('garbage')) categoriesCount.Waste++;
    else if (cat?.includes('road') || cat?.includes('pothole') || cat?.includes('damage')) categoriesCount.Roads++;
    else if (cat?.includes('water') || cat?.includes('leak') || cat?.includes('drain')) categoriesCount.Water++;
    else if (cat?.includes('electric') || cat?.includes('power') || cat?.includes('light')) categoriesCount.Electricity++;
    else categoriesCount.Safety++;
  });

  return (
    <div className="p-10 animate-fade">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         
         {/* Resolution Rate */}
         <div className="admin-card p-10 transition-colors">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-10">Resolution Rates by Department</h3>
            <div className="h-[300px]">
              <Bar data={{
                labels: ['Public Works (PWD)', 'Water Board', 'Electricity Board', 'Waste Management', 'Civil Defence'],
                datasets: [{
                  label: 'Resolution Rate (%)',
                  data: [82, 60, 92, 88, 75],
                  backgroundColor: isDarkMode ? '#14b8a6' : '#00897b',
                  borderRadius: 20
                }]
              }} options={{ 
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    labels: {
                      color: isDarkMode ? '#f8fafc' : '#0f172a'
                    }
                  }
                },
                scales: { 
                  y: { 
                    grid: { color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                    ticks: { color: isDarkMode ? '#94a3b8' : '#64748b' }
                  }, 
                  x: { 
                    grid: { display: false },
                    ticks: { color: isDarkMode ? '#94a3b8' : '#64748b' }
                  } 
                }
              }} />
            </div>
         </div>

         {/* Category pie chart */}
         <div className="admin-card p-10 transition-colors">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-10">Category Breakdown (Live)</h3>
            <div className="h-[300px]">
              <Pie data={{
                labels: ['Waste & Sanitation', 'Road Maintenance', 'Water Supply', 'Electricity/Streetlights', 'Other/Safety'],
                datasets: [{
                  data: [categoriesCount.Waste, categoriesCount.Roads, categoriesCount.Water, categoriesCount.Electricity, categoriesCount.Safety],
                  backgroundColor: ['#0d9488', '#f59e0b', '#0284c7', '#8b5cf6', '#ef4444'],
                  borderWidth: 0
                }]
              }} options={{ 
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      color: isDarkMode ? '#f8fafc' : '#0f172a',
                      font: { size: 10, weight: '700' }
                    }
                  }
                }
              }} />
            </div>
         </div>

         {/* Performance metrics list */}
         <div className="admin-card p-10 transition-colors lg:col-span-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-10">Performance Indicators</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <MetricBar label="Dynamic Resolution Rate" val={`${resolutionRate}%`} color="bg-teal-500" />
               <MetricBar label="Average Service Delivery Time" val="2.4 Days" color="bg-blue-500" valNum={75} />
               <MetricBar label="Citizen Support Points Disbursed" val={`${totalPoints} PTS`} color="bg-purple-500" valNum={100} />
               <MetricBar label="Active Citizen Rate" val="92%" color="bg-orange-500" />
            </div>
         </div>
      </div>
    </div>
  );
};

const MetricBar = ({ label, val, color, valNum }) => {
  const percentage = valNum !== undefined ? valNum : parseFloat(val);
  return (
    <div>
      <div className="flex justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-black text-sm text-slate-800 dark:text-slate-100">{val}</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`${color} h-full`} style={{width: `${percentage}%`}}></div>
      </div>
    </div>
  );
};

/* 📡 ALERT BROADCASTS */
const SignalLog = ({ alerts, broadcastMsg, setBroadcastMsg, onSend }) => {
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastArea, setBroadcastArea] = useState("All Districts");
  const [broadcastType, setBroadcastType] = useState("Advisory");
  const [search, setSearch] = useState("");

  const filteredAlerts = alerts.filter(a => {
    return !search ||
      a.message?.toLowerCase().includes(search.toLowerCase()) ||
      a.title?.toLowerCase().includes(search.toLowerCase());
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMsg) return alert("Write title and content.");
    onSend(broadcastTitle, broadcastArea, broadcastType);
    setBroadcastTitle("");
  };

  return (
    <div className="p-10 animate-fade grid grid-cols-1 lg:grid-cols-3 gap-10">
      
      {/* Dispatch Console */}
      <div className="lg:col-span-1 admin-card p-8 flex flex-col gap-6">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">Broadcast Console</h3>
          <p className="text-[10px] font-black text-teal-700 dark:text-teal-400 uppercase tracking-widest mt-1">Send real-time alerts to nearby citizens</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Alert Title</label>
            <input
              type="text"
              value={broadcastTitle}
              onChange={e => setBroadcastTitle(e.target.value)}
              placeholder="e.g. Traffic Diverted, Water Main Repair"
              className="w-full text-xs font-semibold p-3.5 mt-1 rounded-xl"
              required
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Target Area</label>
            <select
              value={broadcastArea}
              onChange={e => setBroadcastArea(e.target.value)}
              className="w-full text-xs font-semibold p-3.5 mt-1 rounded-xl"
            >
              <option value="All Districts">All Districts</option>
              <option value="Karimganj">Karimganj</option>
              <option value="Jorhat">Jorhat</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Alert Priority Level</label>
            <select
              value={broadcastType}
              onChange={e => setBroadcastType(e.target.value)}
              className="w-full text-xs font-semibold p-3.5 mt-1 rounded-xl"
            >
              <option value="Info">🟢 Info (Low)</option>
              <option value="Advisory">🔵 Advisory (Medium)</option>
              <option value="Warning">🟡 Warning (High)</option>
              <option value="Emergency">🔴 Emergency (Critical)</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Broadcast message</label>
            <textarea
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              placeholder="Provide clean instructions..."
              className="w-full text-xs font-semibold p-3.5 mt-1 rounded-xl h-28 resize-none text-white"
              required
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-xl cursor-pointer shadow-md transition-all border-none"
          >
            Dispatch Announcement
          </button>
        </form>
      </div>

      {/* Broadcast logs */}
      <div className="lg:col-span-2 admin-card p-8 flex flex-col gap-6">
         <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">Broadcast History</h3>
              <p className="text-[10px] font-black text-teal-700 dark:text-teal-400 uppercase tracking-widest mt-1">Audit log of issued announcements</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" size={15}/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search history..."
                className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs w-52 font-bold text-slate-800 dark:text-slate-100 focus:ring-2 ring-teal-500/20"
              />
            </div>
         </div>
         <div className="overflow-y-auto max-h-[500px] border border-slate-200 dark:border-slate-705 rounded-2xl">
           <table className="elite-table">
              <thead>
                <tr>
                  <th className="dark:text-slate-400">Date</th>
                  <th className="dark:text-slate-400">Alert Title</th>
                  <th className="dark:text-slate-400">Target Area</th>
                  <th className="dark:text-slate-400">Level</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((a, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                    <td className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase">
                      {a.created_at?.toDate ? a.created_at.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-850 dark:text-slate-100">{a.title || 'Civic Advisory'}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{a.message}</span>
                      </div>
                    </td>
                    <td className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">{a.area || 'All Districts'}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                        a.type === 'Emergency' ? 'bg-red-50 text-red-750 border-red-200 dark:bg-red-950/40 dark:text-red-450 dark:border-red-900/50' :
                        a.type === 'Warning' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50' :
                        a.type === 'Advisory' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50' :
                        'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/50'
                      }`}>
                        {a.type || 'Info'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
         </div>
      </div>
    </div>
  );
};

/* ⚙️ PORTAL SETTINGS */
const SystemProtocols = ({ municipalProfile, setMunicipalProfile }) => {
  const [profileForm, setProfileForm] = useState({ ...municipalProfile });

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setMunicipalProfile(profileForm);
    alert("💾 Municipal Profile Saved Successfully!");
  };

  return (
    <div className="p-10 animate-fade grid grid-cols-1 lg:grid-cols-2 gap-10">
      
      {/* Left Settings */}
      <div className="admin-card p-10 transition-colors">
         <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-8 uppercase tracking-tighter">Portal Settings</h3>
         <div className="space-y-6">
            <ProtocolToggle label="Enable Automatic Categorization" active />
            <ProtocolToggle label="Send Local Proximity Notifications" active />
            <ProtocolToggle label="Require Two-Factor Authentication" />
            <ProtocolToggle label="Enable Geofenced Broadcasts" active />
         </div>
      </div>

      {/* Right Municipal Profile */}
      <div className="admin-card p-10 transition-colors">
         <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-8 uppercase tracking-tighter">Municipal Profile Settings</h3>
         <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
           <div>
             <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400">Municipality Office Name</label>
             <input
               type="text"
               value={profileForm.officeName}
               onChange={e=>setProfileForm({ ...profileForm, officeName: e.target.value })}
               className="w-full text-xs font-bold p-3.5 mt-1 rounded-xl"
               required
             />
           </div>
           <div>
             <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400">Designated Officer In-Charge</label>
             <input
               type="text"
               value={profileForm.eoName}
               onChange={e=>setProfileForm({ ...profileForm, eoName: e.target.value })}
               className="w-full text-xs font-bold p-3.5 mt-1 rounded-xl"
               required
             />
           </div>
           <div>
             <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400">Designated Office Phone Number</label>
             <input
               type="text"
               value={profileForm.phone}
               onChange={e=>setProfileForm({ ...profileForm, phone: e.target.value })}
               className="w-full text-xs font-bold p-3.5 mt-1 rounded-xl"
               required
             />
           </div>
           <div>
             <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400">Designated Office Location Address</label>
             <textarea
               value={profileForm.address}
               onChange={e=>setProfileForm({ ...profileForm, address: e.target.value })}
               className="w-full text-xs font-bold p-3.5 mt-1 rounded-xl h-24 resize-none"
               required
             />
           </div>
           <button
             type="submit"
             className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-xl cursor-pointer border-none shadow-md transition-all"
           >
             Save Profile Settings
           </button>
         </form>
      </div>

    </div>
  );
};

const ProtocolToggle = ({ label, active: initialActive }) => {
  const [active, setActive] = useState(initialActive);
  return (
    <div className="toggle-card">
       <span className="text-xs font-black uppercase tracking-widest text-slate-650 dark:text-slate-350">{label}</span>
       <button 
          onClick={() => setActive(!active)} 
          className={`w-12 h-6 rounded-full relative transition-colors border-none cursor-pointer focus:outline-none ${active ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'}`}
       >
          <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${active ? 'right-1' : 'left-1'}`}></div>
       </button>
    </div>
  );
};

export default App;
