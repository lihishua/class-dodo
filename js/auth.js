// ═══════════════════════════════════════════════════════════════
// CLASSQUAD — Authentication
// ═══════════════════════════════════════════════════════════════

const USERNAME_DOMAIN = "@classdodo.app";
let regType = "join"; // "join" | "create"

function toEmail(username) {
  return username.toLowerCase() + USERNAME_DOMAIN;
}

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const profile = await getUserProfile(user.uid);
      if (profile) window.location.href = "app.html";
    }
  });

  // Tab switching
  document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      document.querySelectorAll(".auth-tab").forEach(t => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".auth-form").forEach(f => f.classList.toggle("active", f.id === target + "-form"));
      clearMessages();
      if (target === "register") loadClasses();
    });
  });

  // Register type toggle (join / create)
  document.querySelectorAll(".reg-type-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".reg-type-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      regType = btn.dataset.type;
      document.getElementById("panel-join").hidden = regType !== "join";
      document.getElementById("panel-create").hidden = regType !== "create";
      clearMessages();
    });
  });

  // Login
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "...מתחבר";
    clearMessages();
    try {
      await auth.signInWithEmailAndPassword(toEmail(username), password);
      // onAuthStateChanged handles redirect
    } catch (err) {
      showError("login", translateError(err.code));
      btn.disabled = false;
      btn.textContent = "כניסה";
    }
  });

  // Register
  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const displayName = document.getElementById("reg-name").value.trim();
    const username    = document.getElementById("reg-username").value.trim();
    const password    = document.getElementById("reg-password").value;
    const passwordConfirm = document.getElementById("reg-password-confirm").value;
    const btn = e.target.querySelector("button[type=submit]");

    clearMessages();

    if (!displayName) { showError("register", "נא להזין שם"); return; }
    if (!username)    { showError("register", "נא להזין שם משתמש"); return; }
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      showError("register", "שם משתמש יכול להכיל רק אותיות באנגלית, מספרים ו- . _ -");
      return;
    }
    if (password.length < 4) { showError("register", "הסיסמה חייבת להכיל לפחות 4 תווים"); return; }
    if (password !== passwordConfirm) { showError("register", "הסיסמאות לא תואמות"); return; }

    let classId   = null;
    let className = null;

    if (regType === "join") {
      const select = document.getElementById("reg-class-select");
      if (!select.value) { showError("register", "נא לבחור כיתה"); return; }
      classId   = select.value;
      className = select.options[select.selectedIndex].text;
    } else {
      className        = document.getElementById("reg-class-name").value.trim();
      const adminCode  = document.getElementById("reg-admin-code").value.trim();
      if (!className)           { showError("register", "נא להזין שם לכיתה"); return; }
      if (adminCode !== ADMIN_CODE) { showError("register", "קוד מורה שגוי"); return; }
    }

    btn.disabled = true;
    btn.textContent = "...נרשם";

    try {
      const cred = await auth.createUserWithEmailAndPassword(toEmail(username), password);
      await cred.user.updateProfile({ displayName });

      if (regType === "create") {
        const classDoc = await db.collection("classes").add({
          name: className,
          createdBy: cred.user.uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        classId = classDoc.id;
      }

      await db.collection("users").doc(cred.user.uid).set({
        displayName,
        username: username.toLowerCase(),
        role: regType === "create" ? "admin" : "student",
        classId,
        className,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        mathScore: 0,
        mathCorrect: 0,
        mathTotal: 0,
        englishScore: 0,
        englishCorrect: 0,
        englishTotal: 0,
        seenMathQuestions: [],
        seenEnglishQuestions: [],
      });

      window.location.href = "app.html";
    } catch (err) {
      showError("register", translateError(err.code));
      btn.disabled = false;
      btn.textContent = "הרשמה";
    }
  });
});

async function loadClasses() {
  const select = document.getElementById("reg-class-select");
  const hint   = document.getElementById("no-classes-hint");
  select.innerHTML = '<option value="">...טוען</option>';
  hint.style.display = "none";
  try {
    const snap = await db.collection("classes").orderBy("name").get();
    if (snap.empty) {
      select.innerHTML = '<option value="">אין כיתות זמינות</option>';
      hint.style.display = "block";
    } else {
      select.innerHTML = '<option value="">— בחר כיתה —</option>';
      snap.forEach(doc => {
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = doc.data().name;
        select.appendChild(opt);
      });
    }
  } catch {
    select.innerHTML = '<option value="">שגיאה בטעינה</option>';
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function translateError(code) {
  const map = {
    "auth/email-already-in-use": "שם המשתמש כבר תפוס",
    "auth/invalid-email":        "שם משתמש לא תקין",
    "auth/user-not-found":       "שם המשתמש לא נמצא",
    "auth/wrong-password":       "סיסמה שגויה",
    "auth/weak-password":        "הסיסמה חלשה מדי (לפחות 4 תווים)",
    "auth/too-many-requests":    "יותר מדי ניסיונות, נסה שוב מאוחר יותר",
    "auth/invalid-credential":   "שם משתמש או סיסמה שגויים",
  };
  return map[code] || "שגיאה: " + code;
}

function showError(form, msg) {
  const el = document.getElementById(form + "-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}

function showSuccess(form, msg) {
  const el = document.getElementById(form + "-success");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}

function clearMessages() {
  document.querySelectorAll(".auth-error, .auth-success").forEach(el => {
    el.style.display = "none";
    el.textContent = "";
  });
}
