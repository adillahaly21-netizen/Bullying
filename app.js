/* Sahabat Aman — frontend. Database access is protected by Supabase Auth + RLS. */
(() => {
  const SUPABASE_URL = "ISI_SUPABASE_PROJECT_URL";
  const SUPABASE_PUBLISHABLE_KEY = "ISI_SUPABASE_PUBLISHABLE_KEY";
  const $ = (id) => document.getElementById(id);
  const authView = $("authView"), appView = $("appView");
  let sb = null, currentUser = null, profile = null, allReports = [], activeReport = null;
  const statuses = ["Baru", "Ditinjau", "Ditindaklanjuti", "Selesai"];
  const statusClass = (s) => ({ "Baru":"baru", "Ditinjau":"ditinjau", "Ditindaklanjuti":"ditindaklanjuti", "Selesai":"selesai" }[s] || "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = (v) => v ? new Date(v + (String(v).length === 10 ? "T12:00:00" : "")).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}) : "Tanggal tidak dicantumkan";
  function notify(message, error=false) { const el=$("toast"); el.textContent=message; el.classList.remove("hidden","error"); if(error)el.classList.add("error"); setTimeout(()=>el.classList.add("hidden"),4500); }
  function appMessage(message,error=false) { const el=$("appMessage");el.textContent=message;el.classList.remove("hidden","error");if(error)el.classList.add("error"); }
  function clearAppMessage(){ $("appMessage").classList.add("hidden"); }
  function isStaff(){ return profile && ["counselor","admin","principal"].includes(profile.role); }
  function isAdmin(){ return profile && profile.role === "admin"; }
  function showAuth(tab="login"){ authView.classList.remove("hidden");appView.classList.add("hidden");$("logoutBtn").classList.add("hidden");switchAuth(tab); }
  function showApp(){ authView.classList.add("hidden");appView.classList.remove("hidden");$("logoutBtn").classList.remove("hidden"); }
  function switchAuth(tab){ const login=tab==="login";$("loginForm").classList.toggle("hidden",!login);$("signupForm").classList.toggle("hidden",login);$("loginTab").classList.toggle("active",login);$("signupTab").classList.toggle("active",!login);$("authMessage").classList.add("hidden"); }
  function setPage(name){ document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));$(name+"Page").classList.remove("hidden");document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));if(name==="reports")loadReports();if(name==="stats")renderStats(); }
  function reportCard(r){return `<article class="report-card"><div><h3>${esc(r.title)}</h3><div class="report-meta">${esc(r.category)} · ${fmtDate(r.incident_date)} · dibuat ${fmtDate(r.created_at)}</div></div><div><span class="status ${statusClass(r.status)}">${esc(r.status)}</span><br><button class="report-open" data-open-report="${esc(r.id)}">Buka detail →</button></div></article>`;}
  function empty(msg){return `<div class="empty">${esc(msg)}</div>`;}
  async function loadProfile(){
    const {data,error}=await sb.from("profiles").select("id,full_name,class_name,role").eq("id",currentUser.id).single();
    if(error) throw error; profile=data;
  }
  async function loadReports(){
    const {data,error}=await sb.from("reports").select("id,title,category,incident_date,created_at,status,description,location,reporter_id,assigned_to").order("created_at",{ascending:false}).limit(100);
    if(error){appMessage("Laporan tidak dapat dimuat. Periksa koneksi atau hak akses.",true);return;}
    allReports=data||[];
    $("reportList").innerHTML=allReports.length?allReports.map(reportCard).join(""):empty("Belum ada laporan. Jika membutuhkan bantuan, kamu dapat membuat laporan baru.");
    $("recentReports").innerHTML=allReports.slice(0,3).length?allReports.slice(0,3).map(reportCard).join(""):empty("Belum ada laporan.");
    $("summaryCards").innerHTML=metric("Laporan yang terlihat",allReports.length)+metric("Perlu perhatian",allReports.filter(r=>r.status==="Baru"||r.status==="Ditinjau").length)+metric("Selesai",allReports.filter(r=>r.status==="Selesai").length);
    $("recentTitle").textContent=isStaff()?"Laporan terbaru yang dapat diakses":"Laporan terbaru saya";
    $("reportsHeading").textContent=isStaff()?"Laporan yang dapat diakses":"Laporan saya";
    $("newReportBtn").classList.toggle("hidden",isStaff() && !["counselor","admin"].includes(profile.role));
  }
  function metric(label,value){return `<div class="metric"><span>${esc(label)}</span><strong>${Number(value)||0}</strong></div>`;}
  async function loadDashboard(){
    $("welcomeTitle").textContent="Halo, "+(profile.full_name||"Sahabat")+"!";
    $("roleDescription").textContent=({student:"Kamu tidak sendirian. Kamu dapat melapor dan memantau laporanmu.",counselor:"Tinjau laporan yang ditugaskan dan berikan dukungan dengan aman.",admin:"Kelola laporan dan akun sesuai tanggung jawab admin.",principal:"Pantau ringkasan dan statistik sesuai akses akun."})[profile.role]||"Selamat datang.";
    document.querySelectorAll(".staff-only").forEach(e=>e.classList.toggle("hidden",!isStaff()));
    $("newReportBtn").classList.toggle("hidden",profile.role==="principal");
    await loadReports();
  }
  async function openReport(id){
    clearAppMessage(); const r=allReports.find(x=>x.id===id); if(!r)return;
    activeReport=r;
    const detail=$("caseDetail"); detail.classList.remove("hidden");
    const canManage=isStaff() && (isAdmin() || profile.role==="counselor" && (r.assigned_to===currentUser.id || r.assigned_to===null));
    detail.innerHTML=`<div class="section-heading"><div><span class="eyebrow">DETAIL LAPORAN</span><h2>${esc(r.title)}</h2></div><button class="text-btn" id="closeDetail">Tutup</button></div>
      <div class="report-meta">${esc(r.category)} · kejadian ${fmtDate(r.incident_date)} · dibuat ${fmtDate(r.created_at)}</div>
      <p><b>Status:</b> <span class="status ${statusClass(r.status)}">${esc(r.status)}</span></p>
      <p><b>Lokasi:</b> ${esc(r.location||"Tidak dicantumkan")}</p><div class="detail-body">${esc(r.description)}</div>
      ${canManage?`<div class="form-grid"><label>Status tindak lanjut<select id="changeStatus">${statuses.map(s=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("")}</select></label><label>Tugaskan konselor (ID pengguna)<input id="assignUser" placeholder="UUID akun konselor" value="${esc(r.assigned_to||"")}"></label><div class="full"><button class="btn btn-primary" id="saveCase">Simpan perubahan</button></div></div>`:""}
      <h3>Pesan terkait laporan</h3><div id="messages" class="message-list">${empty("Memuat pesan…")}</div>
      <form id="messageForm" class="message-form"><input id="messageText" required maxlength="2000" placeholder="Tulis pesan yang sopan dan aman…"><button class="btn btn-primary" type="submit">Kirim</button></form>`;
    detail.scrollIntoView({behavior:"smooth",block:"start"});
    $("closeDetail").onclick=()=>detail.classList.add("hidden");
    await loadMessages(id);
    $("messageForm").onsubmit=async e=>{e.preventDefault();const body=$("messageText").value.trim();if(!body)return;const {error}=await sb.from("messages").insert({report_id:id,sender_id:currentUser.id,body});if(error){notify("Pesan gagal dikirim. Periksa akses dan koneksi.",true);return;} $("messageText").value="";await loadMessages(id);};
    if(canManage) $("saveCase").onclick=async()=>{
      const status=$("changeStatus").value, assigned=$("assignUser").value.trim()||null;
      const patch={status,assigned_to:assigned};
      const {error}=await sb.from("reports").update(patch).eq("id",id);
      if(error){notify("Perubahan gagal. Pastikan ID konselor benar dan hak akses sesuai.",true);return;}
      notify("Perubahan kasus tersimpan.");await loadReports();await openReport(id);
    };
  }
  async function loadMessages(id){
    const el=$("messages");const {data,error}=await sb.from("messages").select("id,body,created_at,sender_id").eq("report_id",id).order("created_at",{ascending:true});
    if(error){el.innerHTML=empty("Pesan belum dapat dimuat.");return;}
    el.innerHTML=data.length?data.map(m=>`<div class="message"><small>${m.sender_id===currentUser.id?"Anda":"Petugas / peserta laporan"} · ${new Date(m.created_at).toLocaleString("id-ID")}</small>${esc(m.body)}</div>`).join(""):empty("Belum ada pesan. Pesan hanya dapat dibaca pihak yang berhak mengakses laporan ini.");
  }
  async function renderStats(){
    if(!isStaff())return;await loadReports();const data=allReports;
    $("statsCards").innerHTML=metric("Total laporan yang terlihat",data.length)+metric("Baru / ditinjau",data.filter(r=>["Baru","Ditinjau"].includes(r.status)).length)+metric("Selesai",data.filter(r=>r.status==="Selesai").length);
    $("statusStats").innerHTML=statuses.map(s=>{const n=data.filter(r=>r.status===s).length;const pct=data.length?Math.round(n/data.length*100):0;return `<div class="bar-row"><span>${esc(s)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><b>${n}</b></div>`;}).join("");
  }
  function openComposer(){ $("reportComposer").classList.remove("hidden");$("caseDetail").classList.add("hidden");$("reportDate").value=new Date().toISOString().slice(0,10);$("reportComposer").scrollIntoView({behavior:"smooth",block:"start"}); }
  async function initUser(user){
    currentUser=user;
    try{await loadProfile();showApp();await loadDashboard();}
    catch(e){showAuth();appMessage("Profil belum tersedia. Pastikan SQL setup telah dijalankan dan akun sudah terverifikasi.",true);console.error(e);}
  }
  $("loginTab").onclick=()=>switchAuth("login");$("signupTab").onclick=()=>switchAuth("signup");
  $("loginForm").onsubmit=async e=>{e.preventDefault();if(!sb){notify("Isi konfigurasi Supabase terlebih dahulu.",true);return;}const {error}=await sb.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});if(error){$("authMessage").textContent="Tidak dapat masuk. Periksa email/kata sandi atau verifikasi akun."; $("authMessage").classList.remove("hidden");return;}notify("Berhasil masuk.");};
  $("signupForm").onsubmit=async e=>{e.preventDefault();if(!sb){notify("Isi konfigurasi Supabase terlebih dahulu.",true);return;}const {data,error}=await sb.auth.signUp({email:$("signupEmail").value.trim(),password:$("signupPassword").value,options:{data:{full_name:$("signupName").value.trim(),class_name:$("signupClass").value.trim()}}});if(error){$("authMessage").textContent=error.message;$("authMessage").classList.remove("hidden","error");return;} $("authMessage").textContent=data.session?"Akun dibuat. Memuat aplikasi…":"Akun dibuat. Periksa email untuk verifikasi sebelum masuk."; $("authMessage").classList.remove("hidden");};
  $("forgotBtn").onclick=async()=>{if(!sb)return notify("Konfigurasikan Supabase dahulu.",true);const email=$("loginEmail").value.trim();if(!email)return notify("Isi email pada kolom masuk dahulu.",true);const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});notify(error?"Permintaan reset gagal. Periksa konfigurasi email.":"Jika email terdaftar, instruksi reset akan dikirim.");};
  $("logoutBtn").onclick=async()=>{if(sb)await sb.auth.signOut();currentUser=null;profile=null;showAuth();};
  document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>setPage(b.dataset.view));
  $("newReportBtn").onclick=$("newReportBtn2").onclick=openComposer;
  $("educationBtn").onclick=()=>setPage("education");$("allReportsBtn").onclick=()=>setPage("reports");
  $("cancelReportBtn").onclick=()=>$("reportComposer").classList.add("hidden");
  $("reportForm").onsubmit=async e=>{
    e.preventDefault();const payload={reporter_id:currentUser.id,title:$("reportTitle").value.trim(),category:$("reportCategory").value,incident_date:$("reportDate").value,location:$("reportLocation").value.trim()||null,description:$("reportDescription").value.trim(),status:"Baru"};
    if(!navigator.onLine){localStorage.setItem("sahabat-aman-pending-report",JSON.stringify(payload));notify("Offline: laporan disimpan sebagai draf di perangkat ini. Buka kembali saat online untuk mengirimnya.",true);return;}
    const {error}=await sb.from("reports").insert(payload);
    if(error){notify("Laporan belum terkirim. Periksa koneksi dan coba lagi.",true);return;}
    e.target.reset();$("reportComposer").classList.add("hidden");notify("Laporan berhasil dikirim.");await loadReports();
  };
  document.addEventListener("click",e=>{const b=e.target.closest("[data-open-report]");if(b)openReport(b.dataset.openReport);});
  function updateNetwork(){const el=$("network");el.textContent=navigator.onLine?"Online":"Offline";el.style.color=navigator.onLine?"#0f766e":"#a45a0a";}
  window.addEventListener("online",updateNetwork);window.addEventListener("offline",updateNetwork);updateNetwork();
  if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  if(!window.supabase){showAuth();$("authMessage").textContent="Pustaka autentikasi belum tersedia. Sambungkan internet untuk memuat aplikasi."; $("authMessage").classList.remove("hidden");return;}
  if(SUPABASE_URL.startsWith("ISI_")||SUPABASE_PUBLISHABLE_KEY.startsWith("ISI_")){showAuth();$("authMessage").textContent="Langkah awal: isi SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di app.js setelah membuat proyek Supabase. Jangan pernah menaruh service-role/secret key di sini."; $("authMessage").classList.remove("hidden");return;}
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  sb.auth.onAuthStateChange((_event,session)=>{if(session?.user){initUser(session.user);}else{currentUser=null;profile=null;showAuth();}});
  sb.auth.getSession().then(({data})=>{if(data.session)initUser(data.session.user);else showAuth();});
})();
