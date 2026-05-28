// ═══════════════════════════════════════════════════════════════
// CLASSQUAD — Profile Page
// ═══════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", async () => {
  const result = await requireAuth();
  if (!result) return;

  const { user, profile } = result;

  document.getElementById("profile-page-name").textContent = profile.displayName;
  document.getElementById("btn-back").addEventListener("click", () => {
    window.location.href = profile.role === "admin" ? "admin.html" : "app.html";
  });

  document.getElementById("btn-delete-account").addEventListener("click", async () => {
    if (profile.role === "admin" && profile.classId) {
      const studentsSnap = await db.collection("users")
        .where("classId", "==", profile.classId)
        .where("role", "==", "student")
        .get();
      if (!studentsSnap.empty) {
        document.getElementById("delete-teacher-name").textContent = profile.displayName;
        document.getElementById("modal-delete-teacher").hidden = false;
        return;
      }
    }
    document.getElementById("modal-delete").hidden = false;
  });

  // Student simple modal
  document.getElementById("btn-cancel-delete").addEventListener("click", () => {
    document.getElementById("modal-delete").hidden = true;
  });
  document.getElementById("btn-confirm-delete").addEventListener("click", async () => {
    const btn = document.getElementById("btn-confirm-delete");
    btn.disabled = true; btn.textContent = "...מוחק";
    try {
      await deleteAccount({ user, profile });
    } catch (err) {
      btn.disabled = false; btn.textContent = "כן, מחק";
      document.getElementById("modal-delete").hidden = true;
      alert("שגיאה במחיקת החשבון: " + err.message);
    }
  });

  // Teacher modal
  document.getElementById("btn-cancel-delete-teacher").addEventListener("click", () => {
    document.getElementById("modal-delete-teacher").hidden = true;
  });
  document.getElementById("btn-delete-class").addEventListener("click", async () => {
    const btn = document.getElementById("btn-delete-class");
    btn.disabled = true;
    try {
      await db.collection("classes").doc(profile.classId).delete();
      await deleteAccount({ user, profile });
    } catch (err) {
      btn.disabled = false;
      document.getElementById("modal-delete-teacher").hidden = true;
      alert("שגיאה במחיקת החשבון: " + err.message);
    }
  });
  document.getElementById("btn-vacation-mode").addEventListener("click", async () => {
    const btn = document.getElementById("btn-vacation-mode");
    btn.disabled = true;
    try {
      await db.collection("classes").doc(profile.classId).update({
        vacationMode: true,
        teacherDeletedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await deleteAccount({ user, profile });
    } catch (err) {
      btn.disabled = false;
      document.getElementById("modal-delete-teacher").hidden = true;
      alert("שגיאה במחיקת החשבון: " + err.message);
    }
  });

  const mathCorrect  = profile.mathCorrect    || 0;
  const mathTotal    = profile.mathTotal      || 0;
  const engCorrect   = profile.englishCorrect || 0;
  const engTotal     = profile.englishTotal   || 0;
  document.getElementById("profile-stats").innerHTML =
    `<span class="stat-badge stat-math">חשבון: ${mathCorrect}/${mathTotal} ✓</span>` +
    `<span class="stat-badge stat-english">אנגלית: ${engCorrect}/${engTotal} ✓</span>`;

  await loadHistory(user.uid);
});

async function deleteAccount({ user, profile }) {
  const answersSnap = await db.collection("users").doc(user.uid).collection("answers").get();
  const batch = db.batch();
  answersSnap.forEach(doc => batch.delete(doc.ref));
  batch.delete(db.collection("users").doc(user.uid));
  await batch.commit();
  await user.delete();
  window.location.href = "index.html";
}

async function loadHistory(uid) {
  const container = document.getElementById("profile-content");
  try {
    const snap = await db.collection("users").doc(uid)
      .collection("answers")
      .orderBy("answeredAt", "desc")
      .limit(100)
      .get();

    if (snap.empty) {
      container.innerHTML = '<p class="profile-empty">עוד לא ענית על שאלות — תתחיל לתרגל!</p>';
      return;
    }

    container.innerHTML = "";
    snap.forEach(doc => {
      const a = doc.data();
      const labels = ["א", "ב", "ג", "ד"];
      const subjectLabel = a.subject === "math" ? "חשבון" : "אנגלית";
      const subjectClass = a.subject === "math" ? "subject-math" : "subject-english";

      const card = document.createElement("div");
      card.className = `history-card ${a.isCorrect ? "history-correct" : "history-wrong"}`;
      card.innerHTML = `
        <div class="history-card-top">
          <span class="subject-badge ${subjectClass}">${subjectLabel}</span>
          <span class="result-badge">${a.isCorrect ? "✓ נכון" : "✗ לא נכון"}</span>
        </div>
        <div class="history-question">${a.question}</div>
        <div class="history-answers">
          ${a.options.map((opt, i) => `
            <div class="history-opt
              ${i === a.correct ? " opt-correct" : ""}
              ${i === a.userAnswer && !a.isCorrect ? " opt-wrong" : ""}">
              <span class="opt-lbl">${labels[i]}</span> ${opt}
            </div>`).join("")}
        </div>
        ${a.explanation ? `<div class="history-explain">💡 ${a.explanation}</div>` : ""}
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<p class="profile-empty">שגיאה בטעינת ההיסטוריה</p>';
    console.error(err);
  }
}
