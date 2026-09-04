let sb=null, currentUser=null, currentProfile=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function toast(t){$('toast').textContent=t;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),2600)}
function msg(t){$('authMsg').textContent=t}
function dateEL(d){return new Date(d+'T00:00:00').toLocaleDateString('el-GR')}
function setView(v){['authView','workerView','adminView'].forEach(x=>$(x).classList.add('hidden'));$(v).classList.remove('hidden');$('logoutBtn').classList.toggle('hidden',v==='authView')}
function modal(title,body){$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modal').classList.remove('hidden')}
$('closeModal').onclick=()=>$('modal').classList.add('hidden');

let recoveryMode=false;

async function init(){
  if(!window.POWERGRID_SUPABASE_URL || !window.POWERGRID_SUPABASE_KEY){$('configWarning').classList.remove('hidden'); return}
  sb=window.supabase.createClient(window.POWERGRID_SUPABASE_URL,window.POWERGRID_SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data}=await sb.auth.getSession();
  // When Supabase returns from a password-reset link, wait for the user to set a new password.
  if(data.session && !recoveryMode) await loadUser(data.session.user);
  sb.auth.onAuthStateChange(async(event,session)=>{
    if(event==='PASSWORD_RECOVERY' && session){
      recoveryMode=true;
      showRecovery();
      return;
    }
    if(session && !recoveryMode) await loadUser(session.user);
    else if(!session && !recoveryMode){currentUser=null;currentProfile=null;setView('authView')}
  });
}

function showRecovery(){
  setView('authView');
  $('recoveryBox').classList.remove('hidden');
  $('authMsg').textContent='';
  $('recoveryMsg').textContent='';
  $('newPassword').value='';
  $('newPassword2').value='';
  $('newPassword').focus();
}

async function saveNewPassword(){
  const p1=$('newPassword').value;
  const p2=$('newPassword2').value;
  if(p1.length<6) return $('recoveryMsg').textContent='Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.';
  if(p1!==p2) return $('recoveryMsg').textContent='Οι δύο κωδικοί δεν είναι ίδιοι.';
  $('savePasswordBtn').disabled=true;
  const {error}=await sb.auth.updateUser({password:p1});
  $('savePasswordBtn').disabled=false;
  if(error){$('recoveryMsg').textContent='Δεν έγινε η αλλαγή: '+error.message;return}
  recoveryMode=false;
  $('recoveryBox').classList.add('hidden');
  $('recoveryMsg').textContent='';
  toast('Ο κωδικός άλλαξε επιτυχώς.');
  const {data}=await sb.auth.getSession();
  if(data.session) await loadUser(data.session.user);
}

$('savePasswordBtn').onclick=saveNewPassword;

async function loadUser(user){
  currentUser=user;
  const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(error){
    console.error('POWERGRID profile load error:',error);
    setView('authView');
    msg('Δεν μπορώ να φορτώσω το προφίλ. Έλεγξε τη σύνδεση Supabase και τις πολιτικές RLS.');
    return;
  }
  if(!data){setView('authView');msg('Ο λογαριασμός δημιουργήθηκε αλλά δεν βρέθηκε το προφίλ.');return}
  currentProfile=data;
  if(!data.active){setView('authView');msg('Ο λογαριασμός σου είναι σε αναμονή έγκρισης από διαχειριστή.');await sb.auth.signOut();return}
  if(data.role==='admin'){setView('adminView');await loadAdmin()}
  else {setView('workerView');await loadWorker()}
}
$('loginBtn').onclick=async()=>{
  msg('');
  if(!sb)return msg('Πρώτα ρύθμισε το Supabase.');
  const email=$('email').value.trim(), password=$('password').value;
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error)msg('Λάθος email ή κωδικός.');
};
$('signupBtn').onclick=async()=>{
  if(!sb)return msg('Πρώτα ρύθμισε το Supabase.');
  const name=prompt('Ονοματεπώνυμο εργαζομένου:'); if(!name)return;
  const email=$('email').value.trim(), password=$('password').value;
  if(!email||!password)return msg('Βάλε email και κωδικό.');
  const {error}=await sb.auth.signUp({email,password,options:{data:{full_name:name}}});
  msg(error?error.message:'Ο λογαριασμός δημιουργήθηκε και περιμένει έγκριση από διαχειριστή.');
};
$('resetBtn').onclick=async()=>{
  if(!sb)return msg('Πρώτα ρύθμισε το Supabase.');
  const email=$('email').value.trim(); if(!email)return msg('Βάλε πρώτα το email.');
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  msg(error?error.message:'Στάλθηκε email για αλλαγή κωδικού.');
};
$('logoutBtn').onclick=()=>sb?.auth.signOut();
$('arriveBtn').onclick=async()=>{
  const today=new Date().toISOString().slice(0,10);
  const {error}=await sb.from('attendance').insert({user_id:currentUser.id,work_date:today});
  if(error) toast(error.code==='23505'?'Έχεις ήδη δηλώσει παρουσία σήμερα.':error.message); else {toast('Η παρουσία στάλθηκε για έγκριση.');loadWorker()}
};
$('leaveReqBtn').onclick=()=>requestModal('day_off','Ρεπό');
$('vacationReqBtn').onclick=()=>requestModal('leave','Άδεια');
$('overtimeBtn').onclick=()=>modal('Νέα υπερωρία',`
<label>Ημερομηνία</label><input id="mDate" type="date" value="${new Date().toISOString().slice(0,10)}">
<label>Ώρες</label><input id="mHours" type="number" min="0" max="24" step=".5" placeholder="π.χ. 2">
<label>Σημείωση</label><textarea id="mNote" placeholder="προαιρετικά"></textarea>
<button class="primary" onclick="submitOT()">Υποβολή</button>`);
async function submitOT(){
  const {error}=await sb.from('overtime').insert({user_id:currentUser.id,work_date:$('mDate').value,hours:Number($('mHours').value),note:$('mNote').value});
  $('modal').classList.add('hidden'); toast(error?error.message:'Η υπερωρία στάλθηκε για έγκριση.');loadWorker();
}
function requestModal(type,label){modal('Νέο αίτημα '+label,`
<label>Από</label><input id="rStart" type="date">
<label>Έως</label><input id="rEnd" type="date">
<label>Σημείωση</label><textarea id="rNote"></textarea>
<button class="primary" onclick="submitRequest('${type}')">Υποβολή</button>`)}
async function submitRequest(type){
  const {error}=await sb.from('time_off_requests').insert({user_id:currentUser.id,request_type:type,start_date:$('rStart').value,end_date:$('rEnd').value,note:$('rNote').value});
  $('modal').classList.add('hidden');toast(error?error.message:'Το αίτημα στάλθηκε.');loadWorker();
}
async function loadWorker(){
  $('workerName').textContent=currentProfile.full_name||currentUser.email;
  $('workerRole').textContent='Εργαζόμενος';
  const today=new Date().toISOString().slice(0,10);
  const a=await sb.from('attendance').select('*').eq('user_id',currentUser.id).order('work_date',{ascending:false}).limit(20);
  const ot=await sb.from('overtime').select('*').eq('user_id',currentUser.id).order('work_date',{ascending:false}).limit(20);
  const rq=await sb.from('time_off_requests').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(20);
  const ta=a.data?.find(x=>x.work_date===today); $('todayStatus').textContent=ta?({pending:'Σε αναμονή',approved:'Εγκεκριμένη',rejected:'Απορρίφθηκε',absent:'Δεν ήρθε'}[ta.status]):'Δεν δηλώθηκε';
  $('workerAttendance').innerHTML=renderAttendance(a.data||[]);
  $('workerOvertime').innerHTML=renderOT(ot.data||[]);
  $('workerRequests').innerHTML=renderRequests(rq.data||[]);
}
function renderAttendance(rows){return rows.length?rows.map(x=>`<div class="item"><div class="itemTitle">${dateEL(x.work_date)}</div><div class="itemMeta">${({pending:'Σε αναμονή',approved:'Εγκεκριμένη',rejected:'Απορρίφθηκε',absent:'Δεν ήρθε'}[x.status]||x.status)}</div></div>`).join(''):'<div class="empty">Δεν υπάρχουν παρουσίες.</div>'}
function renderOT(rows){return rows.length?rows.map(x=>`<div class="item"><div class="itemTitle">${dateEL(x.work_date)} — ${x.hours} ώρες</div><div class="itemMeta">${x.status}</div></div>`).join(''):'<div class="empty">Δεν υπάρχουν υπερωρίες.</div>'}
function renderRequests(rows){return rows.length?rows.map(x=>`<div class="item"><div class="itemTitle">${x.request_type==='leave'?'Άδεια':'Ρεπό'}: ${dateEL(x.start_date)} → ${dateEL(x.end_date)}</div><div class="itemMeta">${x.status}${x.note?' • '+esc(x.note):''}</div></div>`).join(''):'<div class="empty">Δεν υπάρχουν αιτήματα.</div>'}

async function loadAdmin(){
  const [p,a,r,o]=await Promise.all([
    sb.from('profiles').select('*').order('created_at'),
    sb.from('attendance').select('*, profiles(full_name)').order('work_date',{ascending:false}).limit(100),
    sb.from('time_off_requests').select('*, profiles(full_name)').order('created_at',{ascending:false}).limit(100),
    sb.from('overtime').select('*, profiles(full_name)').order('work_date',{ascending:false}).limit(100)
  ]);
  $('adminWorkers').innerHTML=(p.data||[]).map(x=>`<div class="item"><div class="itemTitle">${esc(x.full_name)||'Χωρίς όνομα'}</div><div class="itemMeta">${x.role} • ${x.active?'Ενεργός':'Σε αναμονή'}</div><div class="actions">${x.role==='worker'?`<button class="${x.active?'reject':'approve'}" onclick="toggleWorker('${x.id}',${!x.active})">${x.active?'Απενεργοποίηση':'Έγκριση'}</button>`:''}</div></div>`).join('')||'<div class="empty">Δεν υπάρχουν χρήστες.</div>';
  $('adminAttendance').innerHTML=(a.data||[]).map(x=>`<div class="item"><div class="itemTitle">${esc(x.profiles?.full_name||'—')} — ${dateEL(x.work_date)}</div><div class="itemMeta">${x.status}</div><div class="actions">${x.status==='pending'?`<button class="approve" onclick="setAttendance('${x.id}','approved')">✓ Εγκρίνω</button><button class="reject" onclick="setAttendance('${x.id}','rejected')">✕ Απόρριψη</button><button class="edit" onclick="setAttendance('${x.id}','absent')">Δεν ήρθε</button>`:''}</div></div>`).join('')||'<div class="empty">Δεν υπάρχουν παρουσίες.</div>';
  $('adminRequests').innerHTML=(r.data||[]).map(x=>`<div class="item"><div class="itemTitle">${esc(x.profiles?.full_name||'—')} — ${x.request_type==='leave'?'Άδεια':'Ρεπό'}</div><div class="itemMeta">${dateEL(x.start_date)} → ${dateEL(x.end_date)} • ${x.status}</div><div class="actions">${x.status==='pending'?`<button class="approve" onclick="setRequest('${x.id}','approved')">✓ Εγκρίνω</button><button class="reject" onclick="setRequest('${x.id}','rejected')">✕ Απόρριψη</button>`:''}</div></div>`).join('')||'<div class="empty">Δεν υπάρχουν αιτήματα.</div>';
  $('adminOvertime').innerHTML=(o.data||[]).map(x=>`<div class="item"><div class="itemTitle">${esc(x.profiles?.full_name||'—')} — ${dateEL(x.work_date)} — ${x.hours} ώρες</div><div class="itemMeta">${x.status}${x.note?' • '+esc(x.note):''}</div><div class="actions">${x.status==='pending'?`<button class="approve" onclick="setOT('${x.id}','approved')">✓ Εγκρίνω</button><button class="reject" onclick="setOT('${x.id}','rejected')">✕ Απόρριψη</button><button class="edit" onclick="editOT('${x.id}',${x.hours})">Αλλαγή ωρών</button>`:''}</div></div>`).join('')||'<div class="empty">Δεν υπάρχουν υπερωρίες.</div>';
}
async function toggleWorker(id,active){const {error}=await sb.from('profiles').update({active}).eq('id',id);toast(error?error.message:(active?'Ο εργαζόμενος εγκρίθηκε.':'Ο εργαζόμενος απενεργοποιήθηκε.'));loadAdmin()}
async function setAttendance(id,status){const {error}=await sb.from('attendance').update({status,reviewed_by:currentUser.id}).eq('id',id);toast(error?error.message:'Η παρουσία ενημερώθηκε.');loadAdmin()}
async function setRequest(id,status){const {error}=await sb.from('time_off_requests').update({status,reviewed_by:currentUser.id}).eq('id',id);toast(error?error.message:'Το αίτημα ενημερώθηκε.');loadAdmin()}
async function setOT(id,status){const {error}=await sb.from('overtime').update({status,reviewed_by:currentUser.id}).eq('id',id);toast(error?error.message:'Η υπερωρία ενημερώθηκε.');loadAdmin()}
async function editOT(id,hours){const h=prompt('Νέες ώρες:',hours);if(h===null)return;const {error}=await sb.from('overtime').update({hours:Number(h)}).eq('id',id);toast(error?error.message:'Οι ώρες άλλαξαν.');loadAdmin()}
$('refreshBtn').onclick=loadAdmin;
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tabPanel').forEach(x=>x.classList.add('hidden'));b.classList.add('active');$(b.dataset.tab).classList.remove('hidden')});
init();
