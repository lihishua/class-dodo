// ═══════════════════════════════════════════════════════════════
// THE DODOS — Dashboard App
// ═══════════════════════════════════════════════════════════════

let currentUser = null;
let currentProfile = null;

document.addEventListener("DOMContentLoaded", async () => {
  const result = await requireAuth();
  if (!result) return;

  currentUser = result.user;
  currentProfile = result.profile;

  // Set greeting
  document.getElementById("user-greeting").textContent =
    `!${currentProfile.displayName || "דודו"} ,היי`;

  // Show admin button if admin
  if (currentProfile.role === "admin") {
    document.getElementById("admin-link").style.display = "flex";
  }

  // Load events
  loadEvents();

  // Load weekly summary
  loadWeeklySummary();

  // Logout
  document.getElementById("btn-logout").addEventListener("click", async () => {
    await auth.signOut();
    window.location.href = "index.html";
  });
});

// ─── Load Events ("מה קורה מתי?") ───────────────────────────
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

// ─── Load Weekly Summary ────────────────────────────────────
async function loadWeeklySummary() {
  const container = document.getElementById("summary-area");
  const btn = document.getElementById("btn-summary");
  try {
    const snap = await db.collection("summaries")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      btn.disabled = true;
      btn.textContent = "אין סיכום עדיין";
      return;
    }

    const summary = snap.docs[0].data();
    btn.addEventListener("click", () => {
      if (summary.fileUrl) {
        window.open(summary.fileUrl, "_blank");
      }
    });
  } catch (err) {
    btn.disabled = true;
    btn.textContent = "שגיאה בטעינה";
  }
}

// ─── Helpers ─────────────────────────────────────────────────
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}
