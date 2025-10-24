/* Investment Tracker PWA (v4) */
const LS_KEY = 'investments_v2'; // bump key to avoid stale structures

function loadAll(){ const raw = localStorage.getItem(LS_KEY); if(!raw) return []; try{ return JSON.parse(raw); }catch(e){ return []; } }
function saveAll(arr){ localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-6); }
function fmtMoney(n){ if (isNaN(n) || n === "" || n === null) return "£0"; return "£"+Number(n).toLocaleString(undefined,{minimumFractionDigits:0, maximumFractionDigits:2}); }
function fmtDate(d){ if(!d) return ""; const dt = new Date(d); if(isNaN(dt)) return ""; return dt.toLocaleDateString(); }
function daysBetween(a,b){ const A=new Date(a), B=new Date(b); if(isNaN(A)||isNaN(B)) return null; return Math.round((B-A)/(1000*60*60*24)); }
function spanToMwd(totalDays){
  if (totalDays == null) return "";
  let months = Math.floor(totalDays / 28);
  let rem = totalDays % 28;
  let weeks = Math.floor(rem / 7);
  let days = rem % 7;
  const parts = [];
  if(months) parts.push(`${months} month${months>1?'s':''}`);
  if(weeks) parts.push(`${weeks} week${weeks>1?'s':''}`);
  if(days || parts.length===0) parts.push(`${days} day${days!==1?'':''}`);
  return parts.join(", ");
}

// Elements
const nameEl = document.getElementById('name');
const amountEl = document.getElementById('amount');
const returnEl = document.getElementById('returnAmt');
const dueEl = document.getElementById('due');
const startEl = document.getElementById('startDate');
const searchEl = document.getElementById('search');

const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const deletePrevBtn = document.getElementById('deletePrevBtn');
const clearActiveBtn = document.getElementById('clearActiveBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

const listEl = document.getElementById('list');
const historyEl = document.getElementById('history');

function nextCycleForName(name){
  const all = loadAll().filter(e => (e.name||'').trim().toLowerCase() === name.trim().toLowerCase());
  if (!all.length) return 1;
  const max = Math.max(...all.map(e => Number(e.cycle||1)));
  return isFinite(max) ? max+1 : (all.length+1);
}

function filteredData(){
  const q = (searchEl.value||"").trim().toLowerCase();
  const all = loadAll();
  if(!q) return all;
  return all.filter(e => {
    const status = (e.status||"Active").toLowerCase();
    return (e.name||"").toLowerCase().includes(q) || status.includes(q);
  });
}

function render(){
  const allFiltered = filteredData();
  // Active if status === "Active"
  const active = allFiltered.filter(e => (e.status||"Active")==="Active").sort((a,b)=> new Date(a.dueDate) - new Date(b.dueDate));
  const hist = allFiltered.filter(e => (e.status||"Active")!=="Active").sort((a,b)=> new Date(b.updatedAt || b.reinvestedDate || b.clearedDate || b.dueDate) - new Date(a.updatedAt || a.reinvestedDate || a.clearedDate || a.dueDate));

  // Render active
  listEl.innerHTML = "";
  const now = new Date();
  active.forEach(e => {
    const due = new Date(e.dueDate);
    const daysLeft = daysBetween(now, due);
    const overdue = daysLeft != null && daysLeft < 0;
    const soon = !overdue && daysLeft != null && daysLeft <= 3;

    const div = document.createElement('div');
    div.className = 'entry' + (overdue ? ' overdue' : (soon ? ' due-soon' : ''));
    div.innerHTML = `
      <div class="row">
        <div><strong>${e.name}</strong> <small>• Cycle ${e.cycle || 1}</small></div>
        <div><small>Principal</small><div>${fmtMoney(e.principal)}</div></div>
        <div><small>Profit</small><div>${fmtMoney(e.returnAmount)}</div></div>
        <div><small>Total to return</small><div>${fmtMoney((e.principal||0)+(e.returnAmount||0))}</div></div>
        <div><small>Start</small><div>${fmtDate(e.startDate)}</div></div>
        <div><small>Due</small><div>${fmtDate(e.dueDate)}</div></div>
        <div><small>Status</small><div>${e.status||'Active'}</div></div>
      </div>
      <div class="entry-actions">
        <button class="mark" data-id="${e.id}">Mark Cleared</button>
        <button class="reinvest" data-id="${e.id}">Reinvest</button>
      </div>
    `;
    listEl.appendChild(div);
  });

  // Render history (cleared + reinvested)
  historyEl.innerHTML = "";
  hist.forEach(e => {
    const days = daysBetween(e.startDate, e.dueDate);
    const pretty = spanToMwd(days);
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <div class="row">
        <div><strong>${e.name}</strong> <small>• Cycle ${e.cycle || 1}</small></div>
        <div><small>Principal</small><div>${fmtMoney(e.principal)}</div></div>
        <div><small>Profit</small><div>${fmtMoney(e.returnAmount)}</div></div>
        <div><small>${e.status==='Cleared'?'Total returned':'Total to return was'}</small><div>${fmtMoney((e.principal||0)+(e.returnAmount||0))}</div></div>
        <div><small>Start</small><div>${fmtDate(e.startDate)}</div></div>
        <div><small>Due</small><div>${fmtDate(e.dueDate)}</div></div>
        <div><small>Status</small><div>${e.status||'Active'}</div></div>
        <div><small>${e.status==='Cleared'?'Cleared':'Reinvested'} Date</small><div>${fmtDate(e.clearedDate||e.reinvestedDate)}</div></div>
        <div><small>Cycle length</small><div>${pretty}</div></div>
      </div>
    `;
    historyEl.appendChild(div);
  });

  // Wire buttons
  document.querySelectorAll('.mark').forEach(btn=>btn.addEventListener('click', onMarkCleared));
  document.querySelectorAll('.reinvest').forEach(btn=>btn.addEventListener('click', onReinvest));
}

function onSave(){
  const name = (nameEl.value||"").trim();
  const principal = Number(amountEl.value||0);
  const ret = Number(returnEl.value||0);
  const due = dueEl.value;
  const startOpt = (startEl && startEl.value) ? startEl.value : "";

  if(!name || !principal || !ret || !due){
    alert("Please complete all required fields (Name, Amount, Return, Due Date).");
    return;
  }
  if(startOpt){
    const s = new Date(startOpt);
    const d = new Date(due);
    if (!isNaN(s) && !isNaN(d) && s > d){
      alert("Start Date cannot be after the Due Date.");
      return;
    }
  }
  const startISO = startOpt ? startOpt : new Date().toISOString().slice(0,10);

  const all = loadAll();
  const entry = {
    id: uid(),
    name,
    principal,
    returnAmount: ret,
    startDate: startISO,
    dueDate: due,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "Active"
  };
  entry.cycle = nextCycleForName(name);

  all.push(entry);
  saveAll(all);

  // Clear fields after save
  nameEl.value = ""; amountEl.value = ""; returnEl.value = ""; dueEl.value = ""; if(startEl) startEl.value="";
  nameEl.focus();
  render();
}

function onDeletePrevious(){
  const all = loadAll();
  if(!all.length){ alert("No entries to delete."); return; }
  const last = all[all.length-1];
  if(!confirm(`Delete the last entry?\n${last.name} • £${last.principal}+£${last.returnAmount} due ${fmtDate(last.dueDate)}`)) return;
  all.pop();
  saveAll(all);
  render();
}

function onClearActive(){
  if(!confirm("Clear ALL ACTIVE entries? This cannot be undone.")) return;
  const kept = loadAll().filter(e => (e.status||"Active")!=="Active");
  saveAll(kept);
  render();
}

function onClearHistory(){
  if(!confirm("Clear ALL HISTORY entries (Cleared + Reinvested)? This cannot be undone.")) return;
  const kept = loadAll().filter(e => (e.status||"Active")==="Active");
  saveAll(kept);
  render();
}

function onMarkCleared(evt){
  const id = evt.currentTarget.getAttribute('data-id');
  const all = loadAll();
  const idx = all.findIndex(e => e.id === id);
  if(idx<0) return;
  all[idx].status = "Cleared";
  all[idx].clearedDate = new Date().toISOString().slice(0,10);
  all[idx].updatedAt = new Date().toISOString();
  saveAll(all);
  render();
}

function onReinvest(evt){
  const id = evt.currentTarget.getAttribute('data-id');
  const all = loadAll();
  const idx = all.findIndex(x => x.id === id);
  if(idx<0) return;
  const e = all[idx];

  // Mark current as "Reinvested" and move to history
  all[idx].status = "Reinvested";
  all[idx].reinvestedDate = new Date().toISOString().slice(0,10);
  all[idx].updatedAt = new Date().toISOString();
  saveAll(all);

  // Prefill new entry with same name & next cycle, principal = last total-to-return
  nameEl.value = e.name;
  amountEl.value = (Number(e.principal||0) + Number(e.returnAmount||0)).toString();
  returnEl.value = "";
  dueEl.value = "";
  if (startEl) startEl.value = ""; // optional start date for new cycle
  dueEl.focus();

  render();
}

function onExportCsv(){
  const all = loadAll();
  if(!all.length){ alert("No data to export."); return; }

  // Sort by investor (alpha), then cycle asc
  const data = all.slice().sort((a,b)=>{
    const n = a.name.localeCompare(b.name, undefined, {sensitivity:'base'});
    if(n!==0) return n;
    const ca = Number(a.cycle||0), cb = Number(b.cycle||0);
    return ca - cb;
  });

  const rows = [];
  rows.push([
    "Investor","Cycle","Status","Principal (£)","Profit this cycle (£)","Total to return (£)",
    "Start Date","Due Date","Cleared Date","Cycle Length (m/w/d)","Total Days"
  ]);

  data.forEach(e=>{
    const total = Number(e.principal||0) + Number(e.returnAmount||0);
    const days = daysBetween(e.startDate, e.dueDate);
    const pretty = spanToMwd(days);
    rows.push([
      e.name, (e.cycle||""), (e.status||"Active"),
      Number(e.principal||0).toFixed(2),
      Number(e.returnAmount||0).toFixed(2),
      total.toFixed(2),
      e.startDate || "", e.dueDate || "",
      (e.status==="Cleared" ? (e.clearedDate||"") : ""),
      pretty, (days==null?"":days)
    ]);
  });

  const csv = rows.map(r=>r.map(cell=>{
    const s = String(cell);
    if (s.includes(",") || s.includes("\"") || s.includes("\n")){
      return `"${s.replace(/"/g,'""')}"`;
    }
    return s;
  }).join(",")).join("\n");

  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  a.href = url; a.download = `investment_tracker_${date}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// Event wiring
document.getElementById('saveBtn').addEventListener('click', onSave);
document.getElementById('exportBtn').addEventListener('click', onExportCsv);
document.getElementById('deletePrevBtn').addEventListener('click', onDeletePrevious);
document.getElementById('clearActiveBtn').addEventListener('click', onClearActive);
document.getElementById('clearHistoryBtn').addEventListener('click', onClearHistory);
document.getElementById('search').addEventListener('input', render);

render();
