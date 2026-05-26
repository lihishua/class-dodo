// ═══════════════════════════════════════════════════════════════
// CLASSQUAD — Admin Panel
// ═══════════════════════════════════════════════════════════════

let currentUser = null;
let currentProfile = null;
let generatedResult = null;  // full AI result {type, questions/events/...}
let selectedFile = null;

// ─── AI Prompts ───────────────────────────────────────────────

// Call 1: classify the content and extract events/summary immediately,
// or return just the topic list for math/english (no questions yet).
function buildClassifyPrompt() {
  const year = new Date().getFullYear();
  return `You are a classifier for a Hebrew 4th-grade classroom app.

Analyze the content and return ONE of these JSON structures — nothing else.

EVENTS (dates, test dates, trips, deadlines, any calendar item):
{"type":"events","events":[{"title":"...","date":"YYYY-MM-DD"}]}
Use year ${year} when no year is given. Extract ALL dates found.

SUMMARY (weekly newsletter, class update, general notes):
{"type":"summary","title":"...","content":"..."}

MATH (worksheets, exercises, arithmetic problems to practice):
{"type":"math","topics":["topic1","topic2"]}
List the specific math topics — do NOT generate questions yet.

ENGLISH (vocabulary lists, grammar exercises, reading comprehension):
{"type":"english","topics":["topic1","topic2"]}
List the specific English topics — do NOT generate questions yet.

Return ONLY valid JSON. No explanation, no markdown.`;
}

// Call 2 / 3: generate one batch of 100 questions for a given type + topics.
function buildQuestionsPrompt(type, topics, batch) {
  const topicList = topics.join(", ");
  const noRepeat  = batch === 2 ? "Do NOT repeat any question from the first batch. " : "";
  if (type === "math") {
    return `Generate 100 unique Hebrew 4th-grade math questions on: ${topicList}.
${noRepeat}Return ONLY valid JSON:
{"type":"math","topics":[...],"questions":[{"question":"...","options":["...","...","...","..."],"correct":0,"explanation":"...","difficulty":2}]}
Exactly 100 questions. ~30 easy (1), ~40 medium (2), ~30 hard (3). Plausible but clearly wrong distractors.`;
  }
  return `Generate 100 unique English questions for Israeli 4th-grade EFL students on: ${topicList}.
${noRepeat}Return ONLY valid JSON:
{"type":"english","topics":[...],"questions":[{"question":"...","options":["...","...","...","..."],"correct":0,"explanation":"...","topic":"..."}]}
Exactly 100 questions.`;
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", async () => {
  const result = await requireAdmin();
  if (!result) return;
  currentUser = result.user;
  currentProfile = result.profile;

  setupAIModal();
  setupPanels();
  loadEventsPreview();
  loadHallOfFame();
  setupProfileDropdown(currentProfile.displayName);

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await auth.signOut();
    window.location.href = "index.html";
  });

  document.getElementById("btn-upload").addEventListener("click", openAIModal);

  document.getElementById("btn-open-events").addEventListener("click", () => {
    openPanel("modal-events");
    loadEvents();
  });

  document.getElementById("btn-reset-lb").addEventListener("click", async () => {
    if (!confirm("לאפס את כל הלידרבורדים? (חשבון ואנגלית יחד)")) return;
    await resetLeaderboard("math");
    await resetLeaderboard("english");
    showToast("!כל הלידרבורדים אופסו");
    loadHallOfFame();
  });

  document.getElementById("btn-summary").addEventListener("click", () => {
    openPanel("modal-summary");
    loadSummaries();
  });
});

// ═══════════════════════════════════════════════════════════════
// PANELS
// ═══════════════════════════════════════════════════════════════

function openPanel(id) { document.getElementById(id).hidden = false; }
function closePanel(id) { document.getElementById(id).hidden = true; }

function setupPanels() {
  document.getElementById("events-close").addEventListener("click", () => {
    closePanel("modal-events");
    loadEventsPreview();
  });
  document.getElementById("users-close").addEventListener("click", () => closePanel("modal-users"));
  document.getElementById("summary-close").addEventListener("click", () => closePanel("modal-summary"));

  ["modal-events", "modal-users", "modal-summary"].forEach(id => {
    document.getElementById(id).addEventListener("click", e => {
      if (e.target === e.currentTarget) {
        closePanel(id);
        if (id === "modal-events") loadEventsPreview();
      }
    });
  });

  document.getElementById("event-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("event-title").value.trim();
    const date = document.getElementById("event-date").value;
    if (!title || !date) return;
    try {
      await db.collection("events").add({
        title, date,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      e.target.reset();
      showToast("!האירוע נוסף");
      loadEvents();
      loadEventsPreview();
    } catch (err) { alert("שגיאה: " + err.message); }
  });

  document.getElementById("summary-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.getElementById("summary-file").files[0];
    const title = document.getElementById("summary-title").value.trim() || "סיכום שבועי";
    if (!file) { alert("נא לבחור קובץ"); return; }
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "...מעלה";
    try {
      const ref = storage.ref(`summaries/${Date.now()}_${file.name}`);
      await ref.put(file);
      const fileUrl = await ref.getDownloadURL();
      await db.collection("summaries").add({
        title, fileUrl, fileName: file.name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.uid,
      });
      e.target.reset();
      showToast("!הסיכום הועלה");
      loadSummaries();
    } catch (err) { alert("שגיאה: " + err.message); }
    finally { btn.disabled = false; btn.textContent = "העלאה"; }
  });
}

// ─── Load Users ───────────────────────────────────────────────
async function loadUsers() {
  const container = document.getElementById("users-list");
  container.innerHTML = '<p class="empty-state">...טוען</p>';
  try {
    const snap = await db.collection("users").orderBy("displayName").get();
    container.innerHTML = "";
    if (snap.empty) { container.innerHTML = '<p class="empty-state">אין משתמשים</p>'; return; }
    snap.forEach(doc => {
      const u = doc.data();
      const div = document.createElement("div");
      div.className = "admin-list-item";
      let roleTag = u.role === "admin"
        ? '<span class="role-tag admin">מנהל</span>'
        : u.role === "pending_admin"
          ? '<span class="role-tag pending">ממתין</span>'
          : '<span class="role-tag student">תלמיד</span>';
      let actions = u.role === "pending_admin"
        ? `<button class="btn-sm btn-approve" onclick="approveAdmin('${doc.id}')">אשר</button>`
        : u.role === "student"
          ? `<button class="btn-sm" onclick="makeAdmin('${doc.id}')">הפוך למנהל</button>`
          : "";
      div.innerHTML = `
        <div class="item-main">
          <strong>${u.displayName}</strong> ${roleTag}
          <div class="item-sub">${u.username || ""}</div>
          <div class="item-stats">חשבון: ${u.mathCorrect || 0}/${u.mathTotal || 0} · אנגלית: ${u.englishCorrect || 0}/${u.englishTotal || 0}</div>
        </div>
        <div class="item-actions">${actions}</div>`;
      container.appendChild(div);
    });
  } catch (err) { container.innerHTML = "<p>שגיאה</p>"; }
}

// ─── Load Events (panel) ──────────────────────────────────────
async function loadEvents() {
  const container = document.getElementById("events-list");
  container.innerHTML = "";
  try {
    const snap = await db.collection("events").orderBy("date", "asc").get();
    if (snap.empty) { container.innerHTML = '<p class="empty-state">אין אירועים עדיין</p>'; return; }
    snap.forEach(doc => {
      const ev = doc.data();
      const div = document.createElement("div");
      div.className = "admin-list-item";
      div.innerHTML = `
        <div class="item-main"><strong>${ev.date}</strong> — ${ev.title}</div>
        <div class="item-actions">
          <button class="btn-sm btn-danger" onclick="deleteEvent('${doc.id}')">מחק</button>
        </div>`;
      container.appendChild(div);
    });
  } catch (err) { container.innerHTML = "<p>שגיאה</p>"; }
}

// ─── Events Preview (main card) ───────────────────────────────
async function loadEventsPreview() {
  const container = document.getElementById("events-preview");
  try {
    const snap = await db.collection("events")
      .where("date", ">=", new Date().toISOString().split("T")[0])
      .orderBy("date", "asc")
      .limit(5).get();
    if (snap.empty) { container.innerHTML = '<p class="empty-state">לחץ להוספת אירועים</p>'; return; }
    container.innerHTML = "";
    snap.forEach(doc => {
      const ev = doc.data();
      const div = document.createElement("div");
      div.className = "event-item";
      div.innerHTML = `<span class="event-date">${formatDate(ev.date)}</span><span class="event-text">${ev.title}</span>`;
      container.appendChild(div);
    });
  } catch (err) { container.innerHTML = '<p class="empty-state">שגיאה</p>'; }
}

// ─── Hall of Fame ─────────────────────────────────────────────
async function loadHallOfFame() {
  const container = document.getElementById("hof-list");
  try {
    const snap = await db.collection("users")
      .where("role", "in", ["student", "pending_admin"]).get();
    const users = [];
    snap.forEach(doc => {
      const u = doc.data();
      const score = (u.mathCorrect || 0) + (u.englishCorrect || 0);
      if (score > 0) users.push({ name: u.displayName, score });
    });
    users.sort((a, b) => b.score - a.score);
    if (!users.length) { container.innerHTML = '<p class="hof-empty">...עוד אין מובילים</p>'; return; }
    const labels = ["מקום ראשון", "מקום שני", "מקום שלישי"];
    container.innerHTML = "";
    users.slice(0, 3).forEach((u, i) => {
      const div = document.createElement("div");
      div.className = "hof-row";
      div.textContent = `${labels[i]} — ${u.name}`;
      container.appendChild(div);
    });
  } catch (err) { container.innerHTML = '<p class="hof-empty">שגיאה</p>'; }
}

// ─── Summaries ────────────────────────────────────────────────
async function loadSummaries() {
  const container = document.getElementById("summaries-list");
  container.innerHTML = "";
  try {
    const snap = await db.collection("summaries").orderBy("createdAt", "desc").get();
    if (snap.empty) { container.innerHTML = '<p class="empty-state">אין סיכומים עדיין</p>'; return; }
    snap.forEach(doc => {
      const s = doc.data();
      const div = document.createElement("div");
      div.className = "admin-list-item";
      const viewBtn = s.fileUrl
        ? `<a href="${s.fileUrl}" target="_blank" class="btn-sm">צפה</a>`
        : "";
      div.innerHTML = `
        <div class="item-main">
          <strong>${s.title}</strong>
          ${s.fileName ? `<div class="item-sub">${s.fileName}</div>` : ""}
        </div>
        <div class="item-actions">
          ${viewBtn}
          <button class="btn-sm btn-danger" onclick="deleteSummary('${doc.id}')">מחק</button>
        </div>`;
      container.appendChild(div);
    });
  } catch (err) { container.innerHTML = "<p>שגיאה</p>"; }
}

// ═══════════════════════════════════════════════════════════════
// AI UPLOAD MODAL
// ═══════════════════════════════════════════════════════════════

function setupAIModal() {
  const overlay = document.getElementById("modal-ai");

  document.getElementById("upload-close").addEventListener("click", closeAIModal);
  document.getElementById("preview-close").addEventListener("click", closeAIModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeAIModal(); });

  document.querySelectorAll(".modal-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".modal-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".modal-panel").forEach(p => { p.hidden = p.id !== tab.dataset.panel; });
    });
  });

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("drag-over"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
  dropzone.addEventListener("drop", e => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) handleFileChosen(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) handleFileChosen(fileInput.files[0]); });

  document.getElementById("btn-process").addEventListener("click", handleProcess);
  document.getElementById("btn-approve").addEventListener("click", handleApprove);
  document.getElementById("btn-cancel-ai").addEventListener("click", closeAIModal);
}

function openAIModal() {
  generatedResult = null;
  selectedFile = null;

  document.querySelectorAll(".modal-tab").forEach((t, i) => t.classList.toggle("active", i === 0));
  document.getElementById("panel-file").hidden = false;
  document.getElementById("panel-text").hidden = true;
  document.getElementById("file-input").value = "";
  document.getElementById("paste-text").value = "";
  document.getElementById("dropzone-inner").innerHTML = `
    <div class="dropzone-icon">📎</div>
    <p class="dropzone-text">גרור קובץ לכאן</p>
    <p class="dropzone-hint">או לחץ לבחירה · תמונה / PDF</p>`;

  showAIStep("step-upload");
  document.getElementById("modal-ai").hidden = false;
}

function closeAIModal() {
  document.getElementById("modal-ai").hidden = true;
  generatedResult = null;
  selectedFile = null;
}

function showAIStep(stepId) {
  ["step-upload", "step-processing", "step-preview"].forEach(id => {
    document.getElementById(id).hidden = id !== stepId;
  });
}

function handleFileChosen(file) {
  selectedFile = file;
  document.getElementById("dropzone-inner").innerHTML = `
    <div class="dropzone-icon">✅</div>
    <p class="dropzone-text">${file.name}</p>
    <p class="dropzone-hint">לחץ להחלפה</p>`;
}

async function handleProcess() {
  const activeTab = document.querySelector(".modal-tab.active");
  const panelId = activeTab?.dataset.panel;
  let textContent = null;
  let fileData = null;

  if (panelId === "panel-text") {
    textContent = document.getElementById("paste-text").value.trim();
    if (!textContent) { alert("נא להדביק טקסט"); return; }
  } else {
    if (!selectedFile) { alert("נא לבחור קובץ"); return; }
    fileData = await fileToBase64(selectedFile);
  }

  showAIStep("step-processing");

  try {
    const result = await callAnthropicAI(fileData, textContent);
    if (result.type === "summary" && selectedFile) {
      result._file = selectedFile;
    }
    generatedResult = result;
    renderPreview(result);
    showAIStep("step-preview");
  } catch (err) {
    showAIStep("step-upload");
    alert("שגיאה בניתוח: " + (err.message || "נסה שוב"));
  }
}

async function handleApprove() {
  if (!generatedResult) return;
  const btn = document.getElementById("btn-approve");
  btn.disabled = true; btn.textContent = "...שומר";

  try {
    const msg = await saveResult(generatedResult);
    showToast("✅ " + msg);
    closeAIModal();
    loadEventsPreview();
    loadHallOfFame();
  } catch (err) {
    alert("שגיאה בשמירה: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "אשר ✓";
  }
}

function renderPreview(result) {
  const summaryEl = document.getElementById("preview-summary");
  const labelEl = document.getElementById("preview-label");
  const container = document.getElementById("preview-questions");
  container.innerHTML = "";

  const typeLabels = { math: "שאלות חשבון", english: "שאלות אנגלית", events: "אירועים", summary: "סיכום שבועי" };
  const typeLabel = typeLabels[result.type] || result.type;

  if (result.type === "math" || result.type === "english") {
    summaryEl.innerHTML = `<strong>זוהה:</strong> ${typeLabel} | <strong>${result.questions.length}</strong> שאלות נוצרו (מתוך 200) | נושאים: ${result.topics.join(", ")}`;
    labelEl.textContent = "3 שאלות לדוגמה:";
    const labels = result.type === "math" ? ["א", "ב", "ג", "ד"] : ["A", "B", "C", "D"];
    result.questions.slice(0, 3).forEach((q, i) => {
      const div = document.createElement("div");
      div.className = "preview-q-card";
      div.innerHTML = `
        <div class="preview-q-num">שאלה ${i + 1}</div>
        <div class="preview-q-text">${q.question}</div>
        <div class="preview-opts">
          ${q.options.map((opt, j) => `<span class="preview-opt ${j === q.correct ? "preview-opt-correct" : ""}">${labels[j]}. ${opt}</span>`).join("")}
        </div>`;
      container.appendChild(div);
    });

  } else if (result.type === "events") {
    summaryEl.innerHTML = `<strong>זוהה:</strong> ${typeLabel} | <strong>${result.events.length}</strong> תאריכים זוהו`;
    labelEl.textContent = "אירועים שזוהו:";
    result.events.forEach(ev => {
      const div = document.createElement("div");
      div.className = "preview-q-card";
      div.innerHTML = `
        <div class="preview-q-num">אירוע</div>
        <div class="preview-q-text">${ev.title}</div>
        <div class="preview-opts"><span class="preview-opt">${ev.date}</span></div>`;
      container.appendChild(div);
    });

  } else if (result.type === "summary") {
    summaryEl.innerHTML = `<strong>זוהה:</strong> ${typeLabel} | <strong>${result.title}</strong>`;
    labelEl.textContent = "תצוגה מקדימה:";
    const div = document.createElement("div");
    div.className = "preview-q-card";
    div.innerHTML = `<div class="preview-q-text">${result.content.substring(0, 300)}${result.content.length > 300 ? "..." : ""}</div>`;
    container.appendChild(div);
  }
}

// ─── Save result to Firestore based on type ───────────────────
async function saveResult(result) {
  switch (result.type) {
    case "math":
    case "english": {
      const col = result.type === "math" ? "mathQuestions" : "englishQuestions";
      const batch = db.batch();
      result.questions.forEach(q => {
        batch.set(db.collection(col).doc(), {
          ...q,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: currentUser.uid,
        });
      });
      await batch.commit();
      return `${result.questions.length} שאלות ${result.type === "math" ? "חשבון" : "אנגלית"} נשמרו!`;
    }
    case "events": {
      const batch = db.batch();
      result.events.forEach(ev => {
        batch.set(db.collection("events").doc(), {
          title: ev.title,
          date: ev.date,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      return `${result.events.length} אירועים נוספו ליומן!`;
    }
    case "summary": {
      let fileUrl = null;
      let fileName = null;
      if (result._file) {
        const ref = storage.ref(`summaries/${Date.now()}_${result._file.name}`);
        await ref.put(result._file);
        fileUrl = await ref.getDownloadURL();
        fileName = result._file.name;
      }
      await db.collection("summaries").add({
        title: result.title,
        content: result.content,
        fileUrl,
        fileName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.uid,
      });
      return "הסיכום נשמר!";
    }
    default:
      throw new Error("סוג לא מוכר: " + result.type);
  }
}

// ─── Anthropic API ────────────────────────────────────────────
async function callAnthropicAI(fileData, textContent) {
  const contentParts = buildUserContent(fileData, textContent);

  // Step 1: classify + extract (events/summary done here; math/english returns topics only)
  updateProcessingHint("מנתח את התוכן...");
  const classified = await makeAnthropicCall(
    [...contentParts, { type: "text", text: buildClassifyPrompt() }],
    1000
  );

  // Events and summaries are fully handled by the classify call
  if (classified.type === "events" || classified.type === "summary") {
    return classified;
  }

  const { type, topics } = classified;

  // Step 2: first 100 questions
  updateProcessingHint(`זוהה: ${type === "math" ? "חשבון" : "אנגלית"} | נושאים: ${topics.join(", ")} — יוצר שאלות 1–100...`);
  const q1 = await makeAnthropicCall(
    [{ type: "text", text: buildQuestionsPrompt(type, topics, 1) }],
    8192
  );

  // Step 3: second 100 questions
  updateProcessingHint("יוצר שאלות 101–200...");
  const q2 = await makeAnthropicCall(
    [{ type: "text", text: buildQuestionsPrompt(type, topics, 2) }],
    8192
  );

  return {
    type,
    topics,
    questions: [...(q1.questions || []), ...(q2.questions || [])],
  };
}

function buildUserContent(fileData, textContent) {
  const content = [];
  if (fileData) {
    if (fileData.type === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: fileData.base64 } });
    } else if (fileData.type.startsWith("image/")) {
      content.push({ type: "image", source: { type: "base64", media_type: fileData.type, data: fileData.base64 } });
    }
  }
  if (textContent) content.push({ type: "text", text: textContent });
  return content;
}

async function makeAnthropicCall(userContent, maxTokens = 8192) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("לא נמצא JSON בתשובת ה-AI — נסה שוב");

  try {
    return JSON.parse(match[0]);
  } catch {
    // Response was truncated (max_tokens) or contains malformed JSON.
    // Try to salvage complete objects from the partial text.
    return salvageJSON(match[0], data.stop_reason);
  }
}

// Extracts complete JSON objects from a truncated/malformed AI response.
// Uses a string-aware state machine so { } inside quoted values don't confuse it.
function salvageJSON(jsonStr, stopReason) {
  const typeMatch = jsonStr.match(/"type"\s*:\s*"(math|english|events|summary)"/);
  if (!typeMatch) throw new Error("ה-AI החזיר תשובה לא תקינה — נסה שוב");
  const type = typeMatch[1];

  if (type === "summary") throw new Error("ה-AI לא סיים לעבד את הסיכום — נסה עם קובץ קצר יותר");

  const arrayKey = type === "events" ? "events" : "questions";
  const arrayMarker = new RegExp(`"${arrayKey}"\\s*:\\s*\\[`);
  const markerMatch = jsonStr.search(arrayMarker);
  if (markerMatch === -1) throw new Error(`לא נמצאו ${arrayKey} בתשובת ה-AI`);

  const arrayStart = jsonStr.indexOf("[", markerMatch) + 1;
  const items = extractObjects(jsonStr.slice(arrayStart));

  if (items.length === 0) throw new Error("ה-AI לא הצליח לייצר תוכן — נסה שוב");

  const topicsMatch = jsonStr.match(/"topics"\s*:\s*(\[[^\]]*\])/);
  let topics = [];
  if (topicsMatch) try { topics = JSON.parse(topicsMatch[1]); } catch {}

  if (type === "events")  return { type, events: items };
  return { type, topics, questions: items };
}

// Walks a JSON string and extracts every complete top-level {...} object,
// correctly skipping { } characters that appear inside string literals.
function extractObjects(str) {
  const items = [];
  let depth = 0, objStart = -1, inString = false, escape = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escape)            { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true;  continue; }
    if (ch === '"')        { inString = !inString;  continue; }
    if (inString)          continue;
    if (ch === "{")        { if (depth++ === 0) objStart = i; }
    else if (ch === "}") {
      if (--depth === 0 && objStart !== -1) {
        try { items.push(JSON.parse(str.slice(objStart, i + 1))); } catch {}
        objStart = -1;
      }
    }
  }
  return items;
}

function updateProcessingHint(text) {
  const el = document.getElementById("processing-hint");
  if (el) el.textContent = text;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ type: file.type, base64: reader.result.split(",")[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════

async function approveAdmin(uid) {
  await db.collection("users").doc(uid).update({ role: "admin" });
  showToast("!המשתמש אושר כמנהל");
  loadUsers();
}

async function makeAdmin(uid) {
  if (!confirm("להפוך למנהל?")) return;
  await db.collection("users").doc(uid).update({ role: "admin" });
  showToast("!הפך למנהל");
  loadUsers();
}

async function deleteEvent(id) {
  if (!confirm("למחוק את האירוע?")) return;
  await db.collection("events").doc(id).delete();
  showToast("נמחק");
  loadEvents();
}

async function deleteSummary(id) {
  if (!confirm("למחוק את הסיכום?")) return;
  await db.collection("summaries").doc(id).delete();
  showToast("נמחק");
  loadSummaries();
}

async function resetLeaderboard(type) {
  const snap = await db.collection("users").get();
  const batch = db.batch();
  snap.forEach(doc => {
    if (type === "math") {
      batch.update(doc.ref, { mathCorrect: 0, mathTotal: 0, seenMathQuestions: [] });
    } else {
      batch.update(doc.ref, { englishCorrect: 0, englishTotal: 0, seenEnglishQuestions: [] });
    }
  });
  await batch.commit();
}

// ─── Helpers ─────────────────────────────────────────────────
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

// ─── Profile Dropdown ────────────────────────────────────────
function setupProfileDropdown(displayName) {
  document.getElementById("profile-dd-name").textContent = displayName;
  const toggle = document.getElementById("btn-profile-toggle");
  const dropdown = document.getElementById("profile-dropdown");

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", () => dropdown.classList.remove("open"));
}

function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, 2500);
}
