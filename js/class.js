// ═══════════════════════════════════════════════════════════════
// CLASSQUAD — Class Management Page
// ═══════════════════════════════════════════════════════════════

let currentUser    = null;
let currentProfile = null;

document.addEventListener("DOMContentLoaded", async () => {
  const result = await requireAdmin();
  if (!result) return;
  currentUser    = result.user;
  currentProfile = result.profile;

  document.getElementById("btn-back").addEventListener("click", () => {
    window.location.href = "admin.html";
  });

  await loadClassName();
  setupRename();
  await loadStudents();
});

// ─── Class name + rename ──────────────────────────────────────

async function loadClassName() {
  const nameEl = document.getElementById("class-page-name");
  if (!currentProfile.classId) { nameEl.textContent = "אין כיתה משויכת"; return; }
  try {
    const doc = await db.collection("classes").doc(currentProfile.classId).get();
    nameEl.textContent = doc.exists ? doc.data().name : "כיתה לא נמצאה";
    document.getElementById("rename-input").value = doc.exists ? doc.data().name : "";
  } catch { nameEl.textContent = "שגיאה"; }
}

function setupRename() {
  document.getElementById("btn-rename").addEventListener("click", () => {
    document.getElementById("rename-bar").hidden = false;
    document.getElementById("rename-input").focus();
  });
  document.getElementById("btn-rename-cancel").addEventListener("click", () => {
    document.getElementById("rename-bar").hidden = true;
  });
  document.getElementById("btn-rename-save").addEventListener("click", async () => {
    const newName = document.getElementById("rename-input").value.trim();
    if (!newName || !currentProfile.classId) return;
    const btn = document.getElementById("btn-rename-save");
    btn.disabled = true;
    try {
      await db.collection("classes").doc(currentProfile.classId).update({ name: newName });
      // Propagate new name to all users in the class
      const snap = await db.collection("users").where("classId", "==", currentProfile.classId).get();
      const batch = db.batch();
      snap.forEach(doc => batch.update(doc.ref, { className: newName }));
      await batch.commit();
      document.getElementById("class-page-name").textContent = newName;
      document.getElementById("rename-bar").hidden = true;
    } catch (err) {
      alert("שגיאה בשמירה: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

// ─── Students list ────────────────────────────────────────────

async function loadStudents() {
  const container = document.getElementById("class-students");
  if (!currentProfile.classId) {
    container.innerHTML = '<p class="profile-empty">אין כיתה משויכת לחשבון שלך</p>';
    return;
  }
  try {
    const snap = await db.collection("users")
      .where("classId", "==", currentProfile.classId)
      .where("role", "==", "student")
      .get();

    if (snap.empty) {
      container.innerHTML = '<p class="profile-empty">עוד אין תלמידים בכיתה</p>';
      return;
    }

    // Sort by name client-side (avoids needing a composite Firestore index)
    const students = [];
    snap.forEach(doc => students.push({ id: doc.id, ...doc.data() }));
    students.sort((a, b) => a.displayName.localeCompare(b.displayName, "he"));

    document.getElementById("class-meta").innerHTML =
      `<span class="stat-badge">${students.length} תלמידים</span>`;

    container.innerHTML = "";
    students.forEach(s => container.appendChild(buildStudentCard(s)));
  } catch (err) {
    container.innerHTML = '<p class="profile-empty">שגיאה בטעינה</p>';
    console.error(err);
  }
}

function buildStudentCard(s) {
  const mathAcc = s.mathTotal    ? Math.round(s.mathCorrect    / s.mathTotal    * 100) : null;
  const engAcc  = s.englishTotal ? Math.round(s.englishCorrect / s.englishTotal * 100) : null;

  const div = document.createElement("div");
  div.className = "student-card";
  div.innerHTML = `
    <div class="student-card-top">
      <div class="student-name">${s.displayName}</div>
      <div class="student-badges">
        <span class="stat-badge stat-math">
          חשבון: ${s.mathCorrect || 0}/${s.mathTotal || 0}${mathAcc !== null ? ` · ${mathAcc}%` : ""}
        </span>
        <span class="stat-badge stat-english">
          אנגלית: ${s.englishCorrect || 0}/${s.englishTotal || 0}${engAcc !== null ? ` · ${engAcc}%` : ""}
        </span>
      </div>
      <button class="btn-show-errors" data-uid="${s.id}">טעויות ▼</button>
    </div>
    <div class="student-errors" id="errors-${s.id}" hidden></div>
  `;

  div.querySelector(".btn-show-errors").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const errorsDiv = document.getElementById(`errors-${s.id}`);
    if (!errorsDiv.hidden) {
      errorsDiv.hidden = true;
      btn.textContent = "טעויות ▼";
      return;
    }
    btn.textContent = "...טוען";
    await loadStudentErrors(s.id, errorsDiv);
    errorsDiv.hidden = false;
    btn.textContent = "סגור ▲";
  });

  return div;
}

async function loadStudentErrors(uid, container) {
  if (container.dataset.loaded) return;
  try {
    const snap = await db.collection("users").doc(uid)
      .collection("answers")
      .where("isCorrect", "==", false)
      .orderBy("answeredAt", "desc")
      .limit(30)
      .get();

    if (snap.empty) {
      container.innerHTML = '<p class="no-errors">אין טעויות — כל הכבוד! 🎉</p>';
    } else {
      const mathLabels    = ["א", "ב", "ג", "ד"];
      const englishLabels = ["A", "B", "C", "D"];
      snap.forEach(doc => {
        const a   = doc.data();
        const lbl = a.subject === "english" ? englishLabels : mathLabels;
        const el  = document.createElement("div");
        el.className = "error-card";
        el.innerHTML = `
          <div class="error-header">
            <span class="subject-badge ${a.subject === "math" ? "subject-math" : "subject-english"}">
              ${a.subject === "math" ? "חשבון" : "אנגלית"}
            </span>
          </div>
          <div class="error-question">${a.question}</div>
          <div class="error-opts">
            ${a.options.map((opt, i) => `
              <span class="error-opt
                ${i === a.correct    ? " opt-correct" : ""}
                ${i === a.userAnswer && i !== a.correct ? " opt-wrong" : ""}">
                ${lbl[i]}. ${opt}
              </span>`).join("")}
          </div>
          ${a.explanation ? `<div class="history-explain">💡 ${a.explanation}</div>` : ""}
        `;
        container.appendChild(el);
      });
    }
    container.dataset.loaded = "1";
  } catch (err) {
    container.innerHTML = '<p class="no-errors">שגיאה בטעינה</p>';
    console.error(err);
  }
}
