// ═══════════════════════════════════════════════════════════════
// THE DODOS — Admin Panel
// ═══════════════════════════════════════════════════════════════

let currentUser = null;
let currentProfile = null;

document.addEventListener("DOMContentLoaded", async () => {
  const result = await requireAdmin();
  if (!result) return;
  currentUser = result.user;
  currentProfile = result.profile;

  document.getElementById("admin-name").textContent = currentProfile.displayName;

  // Tab navigation
  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.section;
      document.querySelectorAll(".admin-tab").forEach(t => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".admin-section").forEach(s => s.classList.toggle("active", s.id === target));
      // Load data for section
      if (target === "sec-users") loadUsers();
      if (target === "sec-math") loadMathQuestions();
      if (target === "sec-english") loadEnglishQuestions();
      if (target === "sec-events") loadEvents();
      if (target === "sec-summary") loadSummaries();
    });
  });

  // ─── Math Question Form ────────────────────────────────────
  document.getElementById("math-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = document.getElementById("math-q").value.trim();
    const optA = document.getElementById("math-a").value.trim();
    const optB = document.getElementById("math-b").value.trim();
    const optC = document.getElementById("math-c").value.trim();
    const optD = document.getElementById("math-d").value.trim();
    const correct = parseInt(document.getElementById("math-correct").value);
    const explanation = document.getElementById("math-explain").value.trim();
    const difficulty = parseInt(document.getElementById("math-difficulty").value);

    if (!question || !optA || !optB || !optC || !optD) {
      alert("נא למלא את כל השדות");
      return;
    }

    try {
      await db.collection("mathQuestions").add({
        question,
        options: [optA, optB, optC, optD],
        correct,
        explanation,
        difficulty,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.uid,
      });
      e.target.reset();
      showToast("!התרגיל נוסף בהצלחה");
      loadMathQuestions();
    } catch (err) {
      alert("שגיאה: " + err.message);
    }
  });

  // ─── English Question Form ─────────────────────────────────
  document.getElementById("english-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = document.getElementById("eng-q").value.trim();
    const optA = document.getElementById("eng-a").value.trim();
    const optB = document.getElementById("eng-b").value.trim();
    const optC = document.getElementById("eng-c").value.trim();
    const optD = document.getElementById("eng-d").value.trim();
    const correct = parseInt(document.getElementById("eng-correct").value);
    const explanation = document.getElementById("eng-explain").value.trim();
    const topic = document.getElementById("eng-topic").value.trim();

    if (!question || !optA || !optB || !optC || !optD) {
      alert("נא למלא את כל השדות");
      return;
    }

    try {
      await db.collection("englishQuestions").add({
        question,
        options: [optA, optB, optC, optD],
        correct,
        explanation,
        topic,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.uid,
      });
      e.target.reset();
      showToast("!התרגיל נוסף בהצלחה");
      loadEnglishQuestions();
    } catch (err) {
      alert("שגיאה: " + err.message);
    }
  });

  // ─── Event Form ────────────────────────────────────────────
  document.getElementById("event-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("event-title").value.trim();
    const date = document.getElementById("event-date").value;

    if (!title || !date) {
      alert("נא למלא תאריך וכותרת");
      return;
    }

    try {
      await db.collection("events").add({
        title,
        date,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      e.target.reset();
      showToast("!האירוע נוסף");
      loadEvents();
    } catch (err) {
      alert("שגיאה: " + err.message);
    }
  });

  // ─── Summary Upload ────────────────────────────────────────
  document.getElementById("summary-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.getElementById("summary-file").files[0];
    const title = document.getElementById("summary-title").value.trim() || "סיכום שבועי";

    if (!file) {
      alert("נא לבחור קובץ");
      return;
    }

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "...מעלה";

    try {
      const ref = storage.ref(`summaries/${Date.now()}_${file.name}`);
      await ref.put(file);
      const fileUrl = await ref.getDownloadURL();

      await db.collection("summaries").add({
        title,
        fileUrl,
        fileName: file.name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.uid,
      });

      e.target.reset();
      showToast("!הסיכום הועלה");
      btn.disabled = false;
      btn.textContent = "העלאה";
      loadSummaries();
    } catch (err) {
      alert("שגיאה: " + err.message);
      btn.disabled = false;
      btn.textContent = "העלאה";
    }
  });

  // ─── Reset Leaderboard ────────────────────────────────────
  document.getElementById("btn-reset-math-lb")?.addEventListener("click", async () => {
    if (!confirm("לאפס את טבלת המובילים בחשבון? כל התוצאות יתאפסו!")) return;
    await resetLeaderboard("math");
    showToast("!טבלת חשבון אופסה");
  });

  document.getElementById("btn-reset-eng-lb")?.addEventListener("click", async () => {
    if (!confirm("לאפס את טבלת המובילים באנגלית? כל התוצאות יתאפסו!")) return;
    await resetLeaderboard("english");
    showToast("!טבלת אנגלית אופסה");
  });

  // Load initial section
  loadUsers();
});

// ═══════════════════════════════════════════════════════════════
// DATA LOADERS
// ═══════════════════════════════════════════════════════════════

async function loadUsers() {
  const container = document.getElementById("users-list");
  try {
    const snap = await db.collection("users").orderBy("displayName").get();
    container.innerHTML = "";

    snap.forEach(doc => {
      const u = doc.data();
      const div = document.createElement("div");
      div.className = "admin-list-item";

      let roleTag = '';
      if (u.role === "admin") roleTag = '<span class="role-tag admin">מנהל</span>';
      else if (u.role === "pending_admin") roleTag = '<span class="role-tag pending">ממתין לאישור</span>';
      else roleTag = '<span class="role-tag student">תלמיד</span>';

      let actions = '';
      if (u.role === "pending_admin") {
        actions = `<button class="btn-sm btn-approve" onclick="approveAdmin('${doc.id}')">אשר מנהל</button>`;
      } else if (u.role === "student") {
        actions = `<button class="btn-sm" onclick="makeAdmin('${doc.id}')">הפוך למנהל</button>`;
      }

      div.innerHTML = `
        <div class="item-main">
          <strong>${u.displayName}</strong> ${roleTag}
          <div class="item-sub">${u.email}</div>
          <div class="item-stats">חשבון: ${u.mathCorrect || 0}/${u.mathTotal || 0} · אנגלית: ${u.englishCorrect || 0}/${u.englishTotal || 0}</div>
        </div>
        <div class="item-actions">${actions}</div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = "<p>שגיאה בטעינת משתמשים</p>";
  }
}

async function loadMathQuestions() {
  const container = document.getElementById("math-list");
  try {
    const snap = await db.collection("mathQuestions").orderBy("createdAt", "desc").get();
    container.innerHTML = "";

    if (snap.empty) {
      container.innerHTML = '<p class="empty-state">אין תרגילים עדיין</p>';
      return;
    }

    snap.forEach(doc => {
      const q = doc.data();
      const div = document.createElement("div");
      div.className = "admin-list-item";
      div.innerHTML = `
        <div class="item-main">
          <strong>${q.question}</strong>
          <div class="item-sub">${q.options.join(" · ")} (תשובה: ${q.options[q.correct]})</div>
        </div>
        <div class="item-actions">
          <button class="btn-sm btn-danger" onclick="deleteQuestion('mathQuestions','${doc.id}')">מחק</button>
        </div>
      `;
      container.appendChild(div);
    });

    document.getElementById("math-count").textContent = snap.size + " תרגילים";
  } catch (err) {
    container.innerHTML = "<p>שגיאה בטעינה</p>";
  }
}

async function loadEnglishQuestions() {
  const container = document.getElementById("english-list");
  try {
    const snap = await db.collection("englishQuestions").orderBy("createdAt", "desc").get();
    container.innerHTML = "";

    if (snap.empty) {
      container.innerHTML = '<p class="empty-state">אין תרגילים עדיין</p>';
      return;
    }

    snap.forEach(doc => {
      const q = doc.data();
      const div = document.createElement("div");
      div.className = "admin-list-item";
      div.innerHTML = `
        <div class="item-main">
          <strong>${q.question}</strong>
          <div class="item-sub">${q.options.join(" · ")} (answer: ${q.options[q.correct]})</div>
          ${q.topic ? '<div class="item-tag">' + q.topic + '</div>' : ''}
        </div>
        <div class="item-actions">
          <button class="btn-sm btn-danger" onclick="deleteQuestion('englishQuestions','${doc.id}')">מחק</button>
        </div>
      `;
      container.appendChild(div);
    });

    document.getElementById("english-count").textContent = snap.size + " תרגילים";
  } catch (err) {
    container.innerHTML = "<p>שגיאה בטעינה</p>";
  }
}

async function loadEvents() {
  const container = document.getElementById("events-list");
  try {
    const snap = await db.collection("events").orderBy("date", "asc").get();
    container.innerHTML = "";

    snap.forEach(doc => {
      const ev = doc.data();
      const div = document.createElement("div");
      div.className = "admin-list-item";
      div.innerHTML = `
        <div class="item-main">
          <strong>${ev.date}</strong> — ${ev.title}
        </div>
        <div class="item-actions">
          <button class="btn-sm btn-danger" onclick="deleteDoc('events','${doc.id}')">מחק</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = "<p>שגיאה בטעינה</p>";
  }
}

async function loadSummaries() {
  const container = document.getElementById("summaries-list");
  try {
    const snap = await db.collection("summaries").orderBy("createdAt", "desc").get();
    container.innerHTML = "";

    snap.forEach(doc => {
      const s = doc.data();
      const div = document.createElement("div");
      div.className = "admin-list-item";
      div.innerHTML = `
        <div class="item-main">
          <strong>${s.title}</strong>
          <div class="item-sub">${s.fileName}</div>
        </div>
        <div class="item-actions">
          <a href="${s.fileUrl}" target="_blank" class="btn-sm">צפה</a>
          <button class="btn-sm btn-danger" onclick="deleteDoc('summaries','${doc.id}')">מחק</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = "<p>שגיאה בטעינה</p>";
  }
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

async function deleteQuestion(collection, id) {
  if (!confirm("למחוק את התרגיל?")) return;
  await db.collection(collection).doc(id).delete();
  showToast("נמחק");
  if (collection === "mathQuestions") loadMathQuestions();
  else loadEnglishQuestions();
}

async function deleteDoc(collection, id) {
  if (!confirm("למחוק?")) return;
  await db.collection(collection).doc(id).delete();
  showToast("נמחק");
  if (collection === "events") loadEvents();
  else loadSummaries();
}

async function resetLeaderboard(type) {
  const snap = await db.collection("users").get();
  const batch = db.batch();
  snap.forEach(doc => {
    if (type === "math") {
      batch.update(doc.ref, {
        mathCorrect: 0,
        mathTotal: 0,
        seenMathQuestions: [],
      });
    } else {
      batch.update(doc.ref, {
        englishCorrect: 0,
        englishTotal: 0,
        seenEnglishQuestions: [],
      });
    }
  });
  await batch.commit();
}

// ─── Toast ──────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ─── Back ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-back")?.addEventListener("click", () => {
    window.location.href = "app.html";
  });
  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    await auth.signOut();
    window.location.href = "index.html";
  });
});
