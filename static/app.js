const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const USER_ID = document.body.dataset.userId || "guest";
const memStore = {};
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return k in memStore ? memStore[k] : null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { memStore[k] = v; } },
  remove(k) { try { localStorage.removeItem(k); } catch (e) { delete memStore[k]; } },
  keys() { try { return Object.keys(localStorage); } catch (e) { return Object.keys(memStore); } }
};
const STORE = `ft.${USER_ID}.`;
const SAMPLES = [
  "Priya: Can you send the revised budget to Rahul by Friday?\nMe: Sure, I’ll send it tomorrow morning. I also need to book the venue for the offsite.\nPriya: Don’t forget to renew the team domain this week.\nMe: Right. Remind me to call Meera on Monday about the vendor contract.\nPriya: The weather is lovely today.",
  "Mom: Can you pick up groceries on the way back today?\nMe: Yes, I’ll buy milk and vegetables tonight.\nMom: Also make sure to pay the electricity bill before Saturday.\nMe: Okay. I need to call Dad about his doctor visit tomorrow.",
  "Alex: We need a clean demo flow for the Amazon hackathon.\nMe: I’ll tighten the capture screen tonight and send the recording tomorrow.\nAlex: Can you also ask Nisha to review the launch notes?\nMe: Yes, remind me to book a rehearsal for Friday."
];
const GROUPS = ["Overdue", "Today", "Tomorrow", "This week", "Later", "No date", "Done"];

function encodeEntity(data) { const params = new URLSearchParams(); Object.entries(data).forEach(([key, value]) => params.set(key, value ?? "")); return params.toString(); }
function decodeEntity(value) { const data = {}; new URLSearchParams(value || "").forEach((v, k) => { data[k] = v; }); return data; }
function saveEntity(prefix, id, data) { ls.set(STORE + prefix + "." + id, encodeEntity(data)); }
function getIndex(prefix) { return (ls.get(STORE + prefix + ".index") || "").split(",").filter(Boolean); }
function addIndex(prefix, id) { const ids = getIndex(prefix); if (!ids.includes(id)) { ids.push(id); ls.set(STORE + prefix + ".index", ids.join(",")); } }
function readEntities(prefix) { return getIndex(prefix).map(id => ({ id, ...decodeEntity(ls.get(STORE + prefix + "." + id)) })).filter(item => item.title || item.text); }
function dateISO(offset = 0) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function escapeHTML(value = "") { return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[char])); }
function displayDate(iso) { if (!iso) return "No date"; const d = new Date(iso + "T12:00:00"); return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function showToast(message) { const toast = $("#toast"); if (!toast) return; toast.textContent = message; toast.classList.add("is-visible"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600); }

function seedDemo() {
  if (ls.get(STORE + "seeded")) return;
  const seedTasks = [
    { id: "seed-1", title: "Send the revised budget to Rahul", due: "Tomorrow", due_date: dateISO(1), who: "Rahul", priority: "high", source: "I’ll send the revised budget to Rahul tomorrow morning.", done: "0" },
    { id: "seed-2", title: "Book the venue for the offsite", due: "No date", due_date: "", who: "", priority: "normal", source: "I also need to book the venue for the offsite.", done: "0" },
    { id: "seed-3", title: "Renew the team domain", due: "This week", due_date: dateISO(4), who: "", priority: "normal", source: "Don’t forget to renew the team domain this week.", done: "0" },
    { id: "seed-4", title: "Call Meera about vendor contract", due: "Monday", due_date: dateISO(3), who: "Meera", priority: "high", source: "Remind me to call Meera on Monday about the vendor contract.", done: "0" },
    { id: "seed-5", title: "Archive last quarter research", due: "Later", due_date: dateISO(10), who: "", priority: "normal", source: "I’ll archive last quarter’s research when the launch is clear.", done: "0" },
    { id: "seed-6", title: "Send the vendor comparison", due: "Overdue", due_date: dateISO(-2), who: "Nisha", priority: "high", source: "I was meant to send the vendor comparison earlier.", done: "0" },
    { id: "seed-7", title: "Upload the demo recording", due: "Today", due_date: dateISO(0), who: "", priority: "high", source: "I’ll upload the demo recording today.", done: "1" }
  ];
  seedTasks.forEach(task => { saveEntity("task", task.id, task); addIndex("task", task.id); });
  const conversations = [
    { id: "conv-1", text: "Priya: Can you send the revised budget to Rahul by Friday? Me: Sure, I’ll send it tomorrow morning...", engine: "rules", created: new Date(Date.now() - 86400000 * 2).toISOString(), count: "4" },
    { id: "conv-2", text: "Alex: We need a clean demo flow for the Amazon hackathon. Me: I’ll tighten the capture screen tonight...", engine: "rules", created: new Date(Date.now() - 86400000).toISOString(), count: "3" }
  ];
  conversations.forEach(conv => { saveEntity("conversation", conv.id, conv); addIndex("conversation", conv.id); });
  ls.set(STORE + "seeded", "1");
}
function tasks() { return readEntities("task"); }
function conversations() { return readEntities("conversation"); }
function saveTask(task) { saveEntity("task", task.id, task); addIndex("task", task.id); }
function isDone(task) { return task.done === "1" || task.done === "true"; }
function daysUntil(iso) { const [y, m, d] = iso.split("-").map(Number); const now = new Date(); return Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000); }
function bucket(task) {
  if (isDone(task)) return "Done";
  if (task.due_date) { const diff = daysUntil(task.due_date); if (diff < 0) return "Overdue"; if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow"; return diff <= 7 ? "This week" : "Later"; }
  if (task.due === "Today") return "Today"; if (task.due === "Tomorrow") return "Tomorrow"; if (task.due === "Overdue") return "Overdue";
  return "No date";
}
function confetti() { const root = $("#confetti"); if (!root) return; for (let i = 0; i < 22; i++) { const piece = document.createElement("i"); piece.className = "confetti-piece"; piece.style.setProperty("--x", `${(Math.random() - .5) * 420}px`); piece.style.setProperty("--y", `${-80 - Math.random() * 260}px`); piece.style.setProperty("--r", `${Math.random() * 560 - 280}deg`); piece.style.left = `${45 + Math.random() * 10}%`; piece.style.top = `${45 + Math.random() * 12}%`; root.appendChild(piece); setTimeout(() => piece.remove(), 950); } }
let audioCtx = null;
function soundCue(kind = "complete") { try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; audioCtx = audioCtx || new AC(); if (audioCtx.state === "suspended") audioCtx.resume(); const ctx = audioCtx; const oscillator = ctx.createOscillator(); const gain = ctx.createGain(); oscillator.type = "sine"; oscillator.frequency.value = kind === "capture" ? 520 : 680; gain.gain.setValueAtTime(.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.045, ctx.currentTime + .015); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .16); oscillator.connect(gain).connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + .18); } catch (error) { /* Audio is an enhancement, not a dependency. */ } }

function initCapture() {
  const form = $("#capture-form"); if (!form) return;
  const textarea = $("#txt"); const counter = $("#char-count"); const out = $("#out"); const message = $("#result-message"); const next = $("#next"); const badge = $("#engine-badge");
  textarea.value = SAMPLES[0]; counter.textContent = `${textarea.value.length} characters`;
  textarea.addEventListener("input", () => counter.textContent = `${textarea.value.length} characters`);
  $$('[data-sample]').forEach(button => button.addEventListener("click", () => { textarea.value = SAMPLES[Number(button.dataset.sample)]; textarea.dispatchEvent(new Event("input")); textarea.focus(); }));
  form.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") form.requestSubmit(); });
  form.addEventListener("submit", async event => {
    event.preventDefault(); const submit = $("#go"); submit.disabled = true; submit.innerHTML = "Reading the thread <span>…</span>"; badge.textContent = "Working"; badge.classList.add("is-live");
    try {
      const response = await fetch("/api/analyze", { method: "POST", body: new FormData(form) }); if (response.status === 401) { location.href = "/login?next=/capture"; return; } const html = await response.text(); if (!response.ok) throw new Error(response.status === 400 ? "Paste a conversation first." : "Something went wrong. Please try again.");
      const wrap = document.createElement("div"); wrap.innerHTML = html; const result = $(".server-result", wrap); out.innerHTML = html; const items = $$(".result-item", out); const engine = result?.dataset.engine || "rules";
      badge.textContent = "Rules engine"; message.textContent = items.length ? "Each signal keeps the exact sentence it came from." : "No clear follow-up yet. Try one of the sample conversations.";
      if (items.length) { const existing = tasks(); const ids = []; items.forEach(item => { const task = { id: `task-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`, title: item.dataset.taskTitle, due: item.dataset.taskDue, due_date: item.dataset.taskDate, who: item.dataset.taskWho, priority: item.dataset.taskPriority, source: item.dataset.taskSource, done: "0" }; if (existing.some(t => t.title === task.title && t.source === task.source)) return; saveTask(task); ids.push(task.id); }); next.hidden = false; if (ids.length) { recordConversation(textarea.value, engine, ids); soundCue("capture"); showToast(`${ids.length} follow-up${ids.length === 1 ? "" : "s"} added to your private dashboard`); } else { showToast("Those follow-ups are already on your dashboard."); } }
    } catch (error) { message.textContent = error.message; badge.textContent = "Try again"; }
    submit.disabled = false; submit.innerHTML = "Find follow-ups <span>↗</span>"; badge.classList.remove("is-live");
  });
}
function recordConversation(text, engine, taskIds) { const id = `conversation-${Date.now()}`; saveEntity("conversation", id, { id, text, engine, created: new Date().toISOString(), count: String(taskIds.length) }); addIndex("conversation", id); }

let dashboardRefresh = null;
function renderDashboard() {
  if (!$("#task-groups")) return;
  if (dashboardRefresh) { dashboardRefresh(); return; }
  let activePerson = "all"; const filterHost = $("#person-filters");
  const draw = () => {
    const all = tasks(); const people = [...new Set(all.map(task => task.who).filter(Boolean))].sort();
    if (activePerson !== "all" && !people.includes(activePerson)) activePerson = "all";
    filterHost.innerHTML = [`<button type="button" class="filter-chip" data-person="all">Everyone</button>`, ...people.map(person => `<button type="button" class="filter-chip" data-person="${escapeHTML(person)}">${escapeHTML(person)}</button>`)].join("");
    $$(".filter-chip", filterHost).forEach(chip => chip.classList.toggle("is-active", chip.dataset.person === activePerson));
    const visible = activePerson === "all" ? all : all.filter(task => task.who === activePerson); const groups = Object.fromEntries(GROUPS.map(group => [group, []])); visible.forEach(task => groups[bucket(task)].push(task));
    $("#task-groups").innerHTML = GROUPS.filter(group => groups[group].length).map((group, groupIndex) => `<section class="task-group" data-bucket="${group}" style="animation-delay:${groupIndex * 45}ms"><div class="task-group-head ${group === "Overdue" ? "is-hot" : ""}"><h3>${group}</h3><span class="group-count">${String(groups[group].length).padStart(2, "0")}</span></div><div class="task-list">${groups[group].map(taskCard).join("")}</div></section>`).join("");
    $("#dashboard-empty").hidden = visible.length > 0; updateMetrics(all); updateMatrix(all); bindTaskChecks(draw);
  };
  filterHost.addEventListener("click", event => { const button = event.target.closest("[data-person]"); if (!button) return; activePerson = button.dataset.person; draw(); });
  dashboardRefresh = draw; draw();
}
function taskCard(task) { const done = task.done === "1" || task.done === "true"; return `<article class="task-card ${done ? "is-done" : ""}"><input class="task-check" type="checkbox" data-complete="${task.id}" ${done ? "checked" : ""} aria-label="Mark ${escapeHTML(task.title)} complete"><div><span class="task-title">${escapeHTML(task.title)}</span><div class="task-meta"><span class="task-tag">${escapeHTML(task.due || "No date")}</span>${task.who ? `<span class="task-tag">${escapeHTML(task.who)}</span>` : ""}<span class="task-tag ${task.priority === "high" ? "high" : ""}">${task.priority === "high" ? "High signal" : "Normal"}</span></div><span class="task-source">“${escapeHTML(task.source || "Added from quick add")}”</span></div><div class="task-side"><strong>${escapeHTML(task.due_date ? displayDate(task.due_date) : "Open")}</strong>${done ? "Closed" : "Open"}</div></article>`; }
function bindTaskChecks(draw) { $$('[data-complete]').forEach(input => input.addEventListener("change", () => { const task = tasks().find(item => item.id === input.dataset.complete); if (!task) return; task.done = input.checked ? "1" : "0"; saveTask(task); if (input.checked) { confetti(); soundCue(); showToast("Closed loop. Nice work."); } draw(); })); }
function updateMetrics(all) { const open = all.filter(task => task.done !== "1" && task.done !== "true").length; const today = all.filter(task => bucket(task) === "Today").length; const closed = all.filter(task => task.done === "1" || task.done === "true").length; const rate = all.length ? Math.round(closed / all.length * 100) : 0; $("#dashboard-metrics").innerHTML = metric("Open loops", open, "to carry forward") + metric("Due today", today, today ? "needs a look" : "clear runway") + metric("Closed rate", `${rate}%`, `${closed} commitments done`); }
function metric(label, value, signal) { return `<div class="metric-card"><span class="metric-signal">${escapeHTML(signal)}</span><span class="metric-value">${escapeHTML(value)}</span><span class="metric-label">${escapeHTML(label)}</span></div>`; }
function updateMatrix(all) { const open = all.filter(task => task.done !== "1" && task.done !== "true"); const counts = { now: 0, schedule: 0, delegate: 0, park: 0 }; open.forEach(task => { const urgent = ["Overdue", "Today", "Tomorrow"].includes(bucket(task)); if (task.priority === "high" && urgent) counts.now++; else if (task.priority === "high") counts.schedule++; else if (urgent) counts.delegate++; else counts.park++; }); Object.entries(counts).forEach(([key, value]) => { const node = $(`#matrix-${key}`); if (node) node.textContent = `${value} task${value === 1 ? "" : "s"}`; }); }

let currentUtterance = null;
function initVoice() { const play = $("#voice-play"); if (!play) return; const setState = state => { $("#voice-status").textContent = state; $("#voice-status").classList.toggle("is-playing", state === "Playing"); $("#waveform").classList.toggle("is-playing", state === "Playing"); }; const makeText = () => { const upcoming = tasks().filter(task => ["Overdue", "Today", "Tomorrow"].includes(bucket(task)) && task.done !== "1" && task.done !== "true"); return upcoming.length ? `You have ${upcoming.length} follow-up${upcoming.length === 1 ? "" : "s"} to keep in view. ${upcoming.map(task => `${task.title}${task.who ? ` for ${task.who}` : ""}`).join(". ")}.` : "Your near-term follow-ups are clear. You have room to move the important work forward."; }; play.addEventListener("click", () => { if (!("speechSynthesis" in window)) { showToast("Speech playback is not supported in this browser."); return; } speechSynthesis.cancel(); currentUtterance = new SpeechSynthesisUtterance(makeText()); currentUtterance.rate = .94; currentUtterance.onstart = () => { setState("Playing"); $("#voice-caption").textContent = "A short brief from your open loops."; }; currentUtterance.onend = () => setState("Ready"); currentUtterance.onerror = () => setState("Ready"); speechSynthesis.speak(currentUtterance); }); $("#voice-pause").addEventListener("click", () => { if (!("speechSynthesis" in window)) return; if (speechSynthesis.speaking) { speechSynthesis.paused ? speechSynthesis.resume() : speechSynthesis.pause(); setState(speechSynthesis.paused ? "Paused" : "Playing"); } }); $("#voice-stop").addEventListener("click", () => { if ("speechSynthesis" in window) speechSynthesis.cancel(); setState("Ready"); }); }
function initExport() { const button = $("#export-summary"); if (!button) return; button.addEventListener("click", () => { const open = tasks().filter(task => task.done !== "1" && task.done !== "true"); const cards = open.map(task => `<article class="card"><span class="label">${escapeHTML(task.due || "No date")}</span><h2>${escapeHTML(task.title)}</h2><p>${escapeHTML(task.who ? `With ${task.who}. ` : "")}${escapeHTML(task.source || "Added from Follow-Through.")}</p></article>`).join(""); const html = `<!doctype html><html><head><meta charset="utf-8"><title>Follow-Through summary</title><style>body{font:16px system-ui;background:#11110f;color:#f3f0e7;padding:40px;max-width:760px;margin:auto}.card{border:1px solid #444;border-radius:14px;padding:18px;margin:12px 0}.label{color:#b7f36b;font-size:12px}.card p{color:#aaa}</style></head><body><p>FOLLOW—THROUGH / PRIVATE SUMMARY</p><h1>${new Date().toLocaleDateString()}</h1>${cards || "<p>No open loops.</p>"}</body></html>`; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); link.download = `follow-through-summary-${dateISO()}.html`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1500); showToast("Summary card exported."); }); }
function renderHistory() { if (!$("#history-metrics")) return; const all = tasks(); const convs = conversations(); const closed = all.filter(task => task.done === "1" || task.done === "true").length; const rate = all.length ? Math.round(closed / all.length * 100) : 0; $("#history-metrics").innerHTML = metric("Conversations", convs.length, "private archive") + metric("Promises found", all.length, "across your threads") + metric("Completion rate", `${rate}%`, `${closed} closed loops`); $("#history-count").textContent = `${convs.length} captured thread${convs.length === 1 ? "" : "s"}`; $("#conversation-list").innerHTML = convs.length ? convs.slice().reverse().map(conv => `<article class="conversation-card"><header><span class="conv-date">${new Date(conv.created).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${conv.count || "0"} follow-ups</span><span class="conv-engine">Offline rules</span></header><p>${escapeHTML(conv.text)}</p></article>`).join("") : `<div class="empty-state"><span class="empty-mark">◌</span><h3>Your archive is quiet.</h3><p>Capture a conversation to start seeing patterns.</p></div>`; const owed = {}; all.filter(task => task.who && task.done !== "1" && task.done !== "true").forEach(task => owed[task.who] = (owed[task.who] || 0) + 1); const owedRows = Object.entries(owed).sort((a, b) => b[1] - a[1]).map(([name, count]) => `<div class="owed-row"><span>${escapeHTML(name)}</span><b>${count} open</b></div>`).join(""); $("#owed-list").innerHTML = owedRows || `<p class="muted small-copy">No open promises involving a named person.</p>`; }

function initModal() { const modal = $("#quick-add-modal"); if (!modal) return; const close = () => { modal.hidden = true; }; $$('[data-open-modal]').forEach(button => button.addEventListener("click", () => { modal.hidden = false; $("[name=title]", modal).focus(); })); $$('[data-close-modal]', modal).forEach(button => button.addEventListener("click", close)); modal.addEventListener("click", event => { if (event.target === modal) close(); }); document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) close(); }); $("#quick-add-form", modal).addEventListener("submit", event => { event.preventDefault(); const form = new FormData(event.currentTarget); const title = String(form.get("title") || "").trim(); if (!title) { showToast("Add a task title first."); return; } const dueDate = form.get("due_date") || ""; const task = { id: `task-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`, title, due_date: dueDate, due: dueDate ? displayDate(dueDate) : "No date", who: String(form.get("who") || "").trim(), priority: form.get("priority"), source: "Added with Quick add.", done: "0" }; saveTask(task); event.currentTarget.reset(); close(); if ($("#task-groups")) renderDashboard(); showToast("Commitment added to your private dashboard."); }); }
function initReset() { const button = $("#reset-demo"); if (!button) return; button.addEventListener("click", () => { if (!confirm("Reset the local Follow-Through demo data?")) return; ls.keys().filter(key => key.startsWith(STORE)).forEach(key => ls.remove(key)); seedDemo(); showToast("Demo reset. Your local archive is fresh."); setTimeout(() => location.reload(), 450); }); }

seedDemo(); initCapture(); renderDashboard(); renderHistory(); initVoice(); initExport(); initModal(); initReset();
