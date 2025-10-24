/* Investment Tracker PWA (v2 with optional Start Date)
   - Optional Start Date (can be in the past). If empty, defaults to today.
   - All other features as before.
*/
const LS_KEY = 'investments_v1';

function loadAll(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return [];
  try{ return JSON.parse(raw); }catch(e){ return []; }
}
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
  if(days || parts.length===0) parts.push(`${days} day${days!==1?'s':''}`);
  return parts.join(", ");
}

// Elements
const nameEl = document.getElementById('name');
const amountEl = document.getElementById('amount');
const returnEl = document.getElementById('returnAmt');
const dueEl = document.getElementById('due');
const startEl = document.getElementById('startDate');

const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const deletePrevBtn = document.getElementById('deletePrevBtn');
const clearBtn = document.getElementById('clearBtn');

const listEl = document.getElementById('list');
const historyEl = document.getElementById('history');
const activeCountEl = document.getElementById('activeCount');
const historyCountEl = document.getElementById('historyCount');
const totalsBadgeEl = document.getElementById('totalsBadge');

function computeCycle(entry){
  const all = loadAll().filter(e => e.name.trim().toLowerCase() === entry.name.trim().toLowerCase());
  all.sort((a,b)=> new Date(a.createdAt) - new Date(b.createdAt));
  const idx = all.findIndex(e => e.id === entry.id);
  return idx >= 0 ? (idx+1) : 1;
}

function render(){
  const all = loadAll();
  const active = all.filter(e => !e.cleared);
  active.sort((a,b)=> new Date(a.dueDate) - new Date(b.dueDate));

  const tInvested = active.reduce((s,e)=> s + Number(e.principal||0), 0);
  const tProfit   = active.reduce((s,e)=> s + Number(e.returnAmount||0), 0);
  const tToReturn = active.reduce((s,e)=> s + Number((e.principal||0) + (e.returnAmount||0)), 0);
  totalsBadgeEl.textContent = `Totals: ${fmtMoney(tInvested)} invested • ${fmtMoney(tProfit)} profit • ${fmtMoney(tToReturn)} to return`;
  activeCountEl.textContent = `${active.length} active`;

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
        <div><strong>${e.name}</strong> <small>• Cycle ${e.cycle || computeCycle(e)}</small></div>
        <div><small>Principal</small><div>${fmtMoney(e.principal)}</div></div>
        <div><small>Profit</small><div>${fmtMoney(e.returnAmount)}</div></div>
        <div><small>Total to return</small><div>${fmtMoney((e.principal||0)+(e.returnAmount||0))}</div></div>
        <div><small>Start</small><div>${fmtDate(e.startDate)}</div></div>
        <div><small>Due</small><div>${fmtDate(e.dueDate)}</div></div>
        <div><small>Status</small><div>${overdue?'Overdue':(soon?'Due soon':'Active')}</div></div>
      </div>
      <div class="entry-actions">
        <button class="mark" data-id="${e.id}">Mark Cleared</button>
        <button class="reinvest" data-id="${e.id}">Reinvest</button>
      </div>
    `;
    listEl.appendChild(div);
  });

  const hist = loadAll().filter(e => e.cleared);
  historyCountEl.textContent = `${hist.length} records`;
  historyEl.innerHTML = "";
  hist.sort((a,b)=> new Date(b.clearedDate || b.dueDate) - new Date(a.clearedDate || a.dueDate));
  hist.forEach(e => {
    const days = daysBetween(e.startDate, e.dueDate);
    const pretty = spanToMwd(days);
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <div class="row">
        <div><strong>${e.name}</strong> <small>• Cycle ${e.cycle || computeCycle(e)}</small></div>
        <div><small>Principal</small><div>${fmtMoney(e.principal)}</div></div>
        <div><small>Profit</small><div>${fmtMoney(e.returnAmount)}</div></div>
        <div><small>Total returned</small><div>${fmtMoney((e.principal||0)+(e.returnAmount||0))}</div></div>
        <div><small>Start</small><div>${fmtDate(e.startDate)}</div></div>
        <div><small>Due</small><div>${fmtDate(e.dueDate)}</div></div>
        <div><small>Cleared</small><div>${fmtDate(e.clearedDate)}</div></div>
        <div><small>Cycle length</small><div>${pretty}</div></div>
      </div>
    `;
    historyEl.appendChild(div);
  });

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
    cleared: false
  };
  entry.cycle = computeCycle({...entry, id:entry.id});

  all.push(entry);
  saveAll(all);
  resetFields(false);
  render();
}

function resetFields(clearFocus=true){
  nameEl.value = "";
  amountEl.value = "";
  returnEl.value = "";
  dueEl.value = "";
  if (startEl) startEl.value = "";
  if(clearFocus) nameEl.focus();
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

function onClear(){
  if(!confirm("Clear ALL entries (active + history)? This cannot be undone.")) return;
  saveAll([]);
  render();
}

function onMarkCleared(evt){
  const id = evt.currentTarget.getAttribute('data-id');
  const all = loadAll();
  const idx = all.findIndex(e => e.id === id);
  if(idx<0) return;
  all[idx].cleared = true;
  all[idx].clearedDate = new Date().toISOString().slice(0,10);
  saveAll(all);
  render();
}

function onReinvest(evt){
  const id = evt.currentTarget.getAttribute('data-id');
  const all = loadAll();
  const e = all.find(x => x.id === id);
  if(!e) return;
  nameEl.value = e.name;
  amountEl.value = (Number(e.principal||0) + Number(e.returnAmount||0)).toString();
  returnEl.value = "";
  dueEl.value = "";
  if (startEl) startEl.value = ""; // new cycle start date left empty so you can choose past/today
  dueEl.focus();
}

function onExportCsv(){
  const all = loadAll();
  if(!all.length){ alert("No data to export."); return; }

  const data = all.slice().sort((a,b)=>{
    const n = a.name.localeCompare(b.name, undefined, {sensitivity:'base'});
    if(n!==0) return n;
    const ca = a.cycle || 0, cb = b.cycle || 0;
    if(ca && cb) return ca - cb;
    return new Date(a.createdAt) - new Date(b.createdAt);
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
      e.name, (e.cycle||""), (e.cleared?"Cleared":"Active"),
      Number(e.principal||0).toFixed(2),
      Number(e.returnAmount||0).toFixed(2),
      total.toFixed(2),
      e.startDate || "", e.dueDate || "", e.clearedDate || "", pretty, (days==null?"":days)
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

saveBtn.addEventListener('click', onSave);
resetBtn.addEventListener('click', ()=>resetFields(true));
exportBtn.addEventListener('click', onExportCsv);
deletePrevBtn.addEventListener('click', onDeletePrevious);
clearBtn.addEventListener('click', onClear);

render();
