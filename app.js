const demoUsers={
 admin:{password:"1234",role:"admin",name:"Διαχειριστής 1"},
 boss:{password:"1234",role:"admin",name:"Διαχειριστής 2"},
 worker1:{password:"1234",role:"worker",name:"Εργαζόμενος 1"}
};
let current=null;
let data=JSON.parse(localStorage.getItem("powergrid_v2_data")||'{"requests":[],"workers":[]}');

function save(){localStorage.setItem("powergrid_v2_data",JSON.stringify(data))}
function login(){
 const u=document.getElementById("username").value.trim(), p=document.getElementById("password").value;
 const x=demoUsers[u];
 if(!x||x.password!==p){alert("Λάθος όνομα χρήστη ή κωδικός.");return}
 current={username:u,...x};
 document.getElementById("login").classList.add("hidden");
 document.getElementById("logout").classList.remove("hidden");
 document.getElementById("roleBadge").textContent=x.role==="admin"?"ΔΙΑΧΕΙΡΙΣΤΗΣ":"ΕΡΓΑΖΟΜΕΝΟΣ";
 if(x.role==="admin"){document.getElementById("admin").classList.remove("hidden");renderAdmin()}
 else {document.getElementById("worker").classList.remove("hidden");document.getElementById("workerName").textContent=x.name;renderWorker()}
}
function logout(){location.reload()}
function action(type){
 let label={attendance:"Παρουσία",overtime:"Υπερωρία",dayoff:"Ρεπό",leave:"Άδεια"}[type];
 let value=type==="overtime"?prompt("Πόσες ώρες υπερωρία;","1"):prompt(type==="attendance"?"Ημερομηνία (π.χ. 04/09/2026):":"Ημερομηνία (π.χ. 04/09/2026):",new Date().toLocaleDateString("el-GR"));
 if(!value)return;
 data.requests.push({id:Date.now(),user:current.username,name:current.name,type,label,value,status:"pending"});
 save(); renderWorker(); alert("Καταχωρήθηκε και είναι Σε αναμονή για έγκριση.");
}
function renderWorker(){
 const mine=data.requests.filter(r=>r.user===current.username).slice().reverse();
 document.getElementById("myHistory").innerHTML=mine.length?mine.map(r=>`<div class="row"><div><b>${r.label}</b><br><small>${r.value}</small></div><span class="pill ${r.status==="approved"?"ok":r.status==="rejected"?"no":""}">${r.status==="approved"?"Εγκεκριμένο":r.status==="rejected"?"Απορρίφθηκε":"Σε αναμονή"}</span></div>`).join(""):"Δεν υπάρχουν καταχωρήσεις.";
}
function renderAdmin(){
 const pending=data.requests.filter(r=>r.status==="pending");
 document.getElementById("pending").textContent=pending.length;
 document.getElementById("workersCount").textContent=Object.keys(demoUsers).filter(k=>demoUsers[k].role==="worker").length;
 document.getElementById("days").textContent=data.requests.filter(r=>r.type==="attendance"&&r.status==="approved").length;
 document.getElementById("requests").innerHTML=pending.length?pending.map(r=>`<div class="row"><div><b>${r.name}</b><br>${r.label}: ${r.value}</div><div><button onclick="approve(${r.id})">✅</button> <button onclick="reject(${r.id})">❌</button></div></div>`).join(""):"Δεν υπάρχουν εκκρεμή αιτήματα.";
 document.getElementById("workers").innerHTML=`<div class="row"><b>Εργαζόμενος 1</b><span class="pill">worker1</span></div>`;
}
function approve(id){let r=data.requests.find(x=>x.id===id);r.status="approved";save();renderAdmin()}
function reject(id){let r=data.requests.find(x=>x.id===id);r.status="rejected";save();renderAdmin()}
