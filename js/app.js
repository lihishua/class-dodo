// ═══════════════════════════════════════════════════════════════
// CLASSQUAD — Dashboard App
// ═══════════════════════════════════════════════════════════════

let currentUser = null;
let currentProfile = null;

document.addEventListener("DOMContentLoaded", async () => {
  const result = await requireAuth();
  if (!result) return;

  currentUser = result.user;
  currentProfile = result.profile;

  // Show admin button if admin
  if (currentProfile.role === "admin") {
    document.getElementById("admin-link").style.display = "flex";
  }

  loadEvents();
  loadWeeklySummary();
  loadHallOfFame();
  setupProfileDropdown(currentProfile.displayName);

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await auth.signOut();
    window.location.href = "index.html";
  });
});

// ─── Load Events ─────────────────────────────────────────────
async function loadEvents() {
  const container = document.getElementById("events-list");
  try {
    const snap = await db.collection("events")
      .orderBy("date", "asc")
      .where("date", ">=", new Date().toISOString().split("T")[0])
      .limit(10)
      .get();

    if (snap.empty) {
      container.innerHTML = '<p class="empty-state">אין אירועים קרובים 🎉</p>';
      return;
    }

    container.innerHTML = "";
    snap.forEach(doc => {
      const ev = doc.data();
      const div = document.createElement("div");
      div.className = "event-item";
      div.innerHTML = `
        <span class="event-date">${formatDate(ev.date)}</span>
        <span class="event-text">${ev.title}</span>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = '<p class="empty-state">לא הצלחתי לטעון אירועים</p>';
  }
}

// ─── Load Weekly Summary ─────────────────────────────────────
async function loadWeeklySummary() {
  const btn = document.getElementById("btn-summary");
  try {
    const snap = await db.collection("summaries")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    if (snap.empty) return;
    const summary = snap.docs[0].data();
    btn.addEventListener("click", () => {
      if (summary.fileUrl) window.open(summary.fileUrl, "_blank");
    });
  } catch (_) {}
}

// ─── Load Hall of Fame ────────────────────────────────────────
async function loadHallOfFame() {
  const container = document.getElementById("hof-list");
  try {
    const snap = await db.collection("users")
      .where("role", "in", ["student", "pending_admin"])
      .get();

    const users = [];
    snap.forEach(doc => {
      const u = doc.data();
      const score = (u.mathCorrect || 0) + (u.englishCorrect || 0);
      if (score > 0) users.push({ name: u.displayName, score });
    });

    users.sort((a, b) => b.score - a.score);

    if (users.length === 0) {
      container.innerHTML = '<p class="hof-empty">...עוד אין מובילים</p>';
      return;
    }

    const rankLabels = ["מקום ראשון", "מקום שני", "מקום שלישי"];
    container.innerHTML = "";
    users.slice(0, 3).forEach((u, i) => {
      const div = document.createElement("div");
      div.className = "hof-row";
      div.textContent = `${rankLabels[i]} — ${u.name}`;
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = '<p class="hof-empty">שגיאה בטעינה</p>';
  }
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

// ─── Helpers ─────────────────────────────────────────────────
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}
