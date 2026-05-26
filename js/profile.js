// ═══════════════════════════════════════════════════════════════
// CLASS DODO — Profile Page
// ═══════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", async () => {
  const result = await requireAuth();
  if (!result) return;

  const { user, profile } = result;

  document.getElementById("profile-page-name").textContent = profile.displayName;
  document.getElementById("btn-back").addEventListener("click", () => {
    window.location.href = profile.role === "admin" ? "admin.html" : "app.html";
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
