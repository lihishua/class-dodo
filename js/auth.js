// ═══════════════════════════════════════════════════════════════
// THE DODOS — Authentication
// ═══════════════════════════════════════════════════════════════

const USERNAME_DOMAIN = "@classdodo.app";

function toEmail(username) {
  return username.toLowerCase() + USERNAME_DOMAIN;
}

document.addEventListener("DOMContentLoaded", () => {
  // Check if already logged in
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const profile = await getUserProfile(user.uid);
      if (profile) {
        window.location.href = "app.html";
      }
    }
  });

  // Show/hide admin code field
  document.getElementById("reg-admin").addEventListener("change", function () {
    document.getElementById("admin-code-group").style.display = this.checked ? "block" : "none";
    document.getElementById("reg-admin-code").value = "";
  });

  // Tab switching
  const tabs = document.querySelectorAll(".auth-tab");
  const forms = document.querySelectorAll(".auth-form");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle("active", t === tab));
      forms.forEach(f => f.classList.toggle("active", f.id === target + "-form"));
      clearMessages();
    });
  });

  // Login form
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
      // onAuthStateChanged will redirect
    } catch (err) {
      showError("login", translateError(err.code));
      btn.disabled = false;
      btn.textContent = "כניסה";
    }
  });

  // Register form
  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const displayName = document.getElementById("reg-name").value.trim();
    const username = document.getElementById("reg-username").value.trim();
    const password = document.getElementById("reg-password").value;
    const passwordConfirm = document.getElementById("reg-password-confirm").value;
    const wantsAdmin = document.getElementById("reg-admin").checked;
    const adminCode = document.getElementById("reg-admin-code").value.trim();
    const btn = e.target.querySelector("button[type=submit]");

    clearMessages();

    if (!displayName) { showError("register", "נא להזין שם תצוגה"); return; }
    if (!username) { showError("register", "נא להזין שם משתמש"); return; }
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      showError("register", "שם משתמש יכול להכיל רק אותיות באנגלית, מספרים ו- . _ -");
      return;
    }
    if (password !== passwordConfirm) { showError("register", "הסיסמאות לא תואמות"); return; }
    if (password.length < 6) { showError("register", "הסיסמה חייבת להכיל לפחות 6 תווים"); return; }

    if (wantsAdmin && adminCode !== ADMIN_CODE) {
      showError("register", "קוד מורה שגוי");
      return;
    }

    btn.disabled = true;
    btn.textContent = "...נרשם";

    try {
      const cred = await auth.createUserWithEmailAndPassword(toEmail(username), password);
      await cred.user.updateProfile({ displayName });

      await db.collection("users").doc(cred.user.uid).set({
        displayName,
        username: username.toLowerCase(),
        role: wantsAdmin ? "admin" : "student",
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

// ─── Helpers ─────────────────────────────────────────────────

function translateError(code) {
  const map = {
    "auth/email-already-in-use": "שם המשתמש כבר תפוס",
    "auth/invalid-email": "שם משתמש לא תקין",
    "auth/user-not-found": "שם המשתמש לא נמצא",
    "auth/wrong-password": "סיסמה שגויה",
    "auth/weak-password": "הסיסמה חלשה מדי (לפחות 6 תווים)",
    "auth/too-many-requests": "יותר מדי ניסיונות, נסה שוב מאוחר יותר",
    "auth/invalid-credential": "שם משתמש או סיסמה שגויים",
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
