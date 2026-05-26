// ═══════════════════════════════════════════════════════════════
// THE DODOS — אנגליתוש (English Practice)
// ═══════════════════════════════════════════════════════════════

let currentUser = null;
let currentProfile = null;
let currentQuestion = null;
let questionStartTime = 0;
let sessionCorrect = 0;
let sessionTotal = 0;
let allQuestions = [];
let seenIds = [];

document.addEventListener("DOMContentLoaded", async () => {
  const result = await requireAuth();
  if (!result) return;
  currentUser = result.user;
  currentProfile = result.profile;
  seenIds = currentProfile.seenEnglishQuestions || [];

  document.getElementById("player-name").textContent = currentProfile.displayName;

  await loadQuestions();
  await loadLeaderboard();

  document.getElementById("btn-start").addEventListener("click", startPractice);
  document.getElementById("btn-back").addEventListener("click", () => {
    window.location.href = "app.html";
  });
});

// ─── Load Questions ─────────────────────────────────────────
async function loadQuestions() {
  try {
    const snap = await db.collection("englishQuestions")
      .orderBy("createdAt", "desc")
      .get();

    allQuestions = [];
    snap.forEach(doc => {
      allQuestions.push({ id: doc.id, ...doc.data() });
    });

    if (allQuestions.length === 0) {
      document.getElementById("status-msg").textContent = "אין תרגילים עדיין — המורה צריכה להעלות!";
      document.getElementById("btn-start").disabled = true;
    }
  } catch (err) {
    console.error("Error loading questions:", err);
  }
}

// ─── Load Leaderboard ───────────────────────────────────────
async function loadLeaderboard() {
  const container = document.getElementById("leaderboard");
  try {
    const snap = await db.collection("users")
      .where("role", "in", ["student", "pending_admin"])
      .orderBy("englishCorrect", "desc")
      .limit(3)
      .get();

    container.innerHTML = "";
    let rank = 0;
    snap.forEach(doc => {
      const u = doc.data();
      if (u.englishCorrect <= 0) return;
      rank++;
      const div = document.createElement("div");
      div.className = "lb-row" + (rank === 1 ? " lb-first" : "");
      div.innerHTML = `
        <span class="lb-rank">${rank === 1 ? "👑" : rank}</span>
        <span class="lb-name">${u.displayName}</span>
        <span class="lb-score">${u.englishCorrect} ✓</span>
      `;
      container.appendChild(div);
    });

    if (rank === 0) {
      container.innerHTML = '<p class="empty-state">עדיין אין תוצאות — היה הראשון!</p>';
    }
  } catch (err) {
    console.error("Leaderboard error:", err);
  }
}

// ─── Start Practice ─────────────────────────────────────────
function startPractice() {
  document.getElementById("home-view").style.display = "none";
  document.getElementById("quiz-view").style.display = "block";
  sessionCorrect = 0;
  sessionTotal = 0;
  updateSessionStats();
  nextQuestion();
}

function nextQuestion() {
  const unseen = allQuestions.filter(q => !seenIds.includes(q.id));
  const pool = unseen.length > 0 ? unseen : allQuestions;

  if (pool.length === 0) {
    showFinished();
    return;
  }

  currentQuestion = pool[Math.floor(Math.random() * pool.length)];
  questionStartTime = Date.now();
  renderQuestion();
}

function renderQuestion() {
  const q = currentQuestion;
  document.getElementById("q-text").textContent = q.question;
  document.getElementById("feedback-area").innerHTML = "";
  document.getElementById("btn-next-q").style.display = "none";

  const optsContainer = document.getElementById("options-area");
  optsContainer.innerHTML = "";

  const labels = ["A", "B", "C", "D"];
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "opt-btn";
    btn.innerHTML = `<span class="opt-label">${labels[i]}</span><span class="opt-text">${opt}</span>`;
    btn.addEventListener("click", () => handleAnswer(i));
    optsContainer.appendChild(btn);
  });
}

async function handleAnswer(idx) {
  const q = currentQuestion;
  const isCorrect = idx === q.correct;

  const btns = document.querySelectorAll("#options-area .opt-btn");
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct) btn.classList.add("correct");
    else if (i === idx && !isCorrect) btn.classList.add("wrong");
    else btn.classList.add("dimmed");
  });

  sessionTotal++;
  if (isCorrect) sessionCorrect++;
  updateSessionStats();

  if (!seenIds.includes(q.id)) seenIds.push(q.id);

  const fb = document.getElementById("feedback-area");
  fb.innerHTML = `
    <div class="fb-card ${isCorrect ? 'fb-ok' : 'fb-no'}">
      <div class="fb-header">${isCorrect
        ? '🎉 !Correct'
        : '😔 Wrong — The answer: ' + q.options[q.correct]
      }</div>
      ${q.explanation ? '<div class="fb-explain">💡 ' + q.explanation + '</div>' : ''}
    </div>
  `;

  if (isCorrect) fireConfetti();
  document.getElementById("btn-next-q").style.display = "block";

  try {
    const batch = db.batch();
    const userRef = db.collection("users").doc(currentUser.uid);
    batch.update(userRef, {
      englishCorrect: firebase.firestore.FieldValue.increment(isCorrect ? 1 : 0),
      englishTotal: firebase.firestore.FieldValue.increment(1),
      seenEnglishQuestions: seenIds,
    });
    const answerRef = userRef.collection("answers").doc();
    batch.set(answerRef, {
      subject: "english",
      questionId: q.id,
      question: q.question,
      options: q.options,
      userAnswer: idx,
      correct: q.correct,
      isCorrect,
      explanation: q.explanation || "",
      answeredAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    console.error("Save error:", err);
  }
}

function updateSessionStats() {
  document.getElementById("session-correct").textContent = sessionCorrect;
  document.getElementById("session-total").textContent = sessionTotal;
}

function showFinished() {
  document.getElementById("question-area").innerHTML = `
    <div class="finished-msg">
      <div class="finished-emoji">🏆</div>
      <h2>!Amazing</h2>
      <p>!עשית את כל התרגילים</p>
      <p>חכה שהמורה תעלה עוד 😉</p>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-next-q")?.addEventListener("click", nextQuestion);
  document.getElementById("btn-stop")?.addEventListener("click", () => {
    window.location.href = "app.html";
  });
});

function fireConfetti() {
  const container = document.getElementById("confetti-container");
  const colors = ["#FF6B00", "#FFD600", "#FF3D00", "#00C853", "#2979FF", "#E85D75"];
  for (let i = 0; i < 25; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.left = Math.random() * 100 + "%";
    p.style.width = (6 + Math.random() * 8) + "px";
    p.style.height = p.style.width;
    p.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDuration = (1.5 + Math.random() * 2) + "s";
    p.style.animationDelay = (Math.random() * 0.4) + "s";
    container.appendChild(p);
    setTimeout(() => p.remove(), 4000);
  }
}
