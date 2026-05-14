// ═══════════════════════════════════════════════════════════════
// THE DODOS — Authentication
// ═══════════════════════════════════════════════════════════════

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
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const btn = e.target.querySelector("button[type=submit]");

    btn.disabled = true;
    btn.textContent = "...מתחבר";
    clearMessages();

    try {
      await auth.signInWithEmailAndPassword(email, password);
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
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const passwordConfirm = document.getElementById("reg-password-confirm").value;
    const wantsAdmin = document.getElementById("reg-admin").checked;
    const btn = e.target.querySelector("button[type=submit]");

    clearMessages();

    if (password !== passwordConfirm) {
      showError("register", "הסיסמאות לא תואמות");
      return;
    }
    if (password.length < 6) {
      showError("register", "הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    if (!displayName) {
      showError("register", "נא להזין שם תצוגה");
      return;
    }

    btn.disabled = true;
    btn.textContent = "...נרשם";

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName });

      // Create user profile in Firestore
      await db.collection("users").doc(cred.user.uid).set({
        displayName,
        email,
        role: wantsAdmin ? "pending_admin" : "student",
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

      if (wantsAdmin) {
        showSuccess("register", "!נרשמת בהצלחה! בקשת מנהל נשלחה לאישור");
      }

      window.location.href = "app.html";
    } catch (err) {
      showError("register", translateError(err.code));
      btn.disabled = false;
      btn.textContent = "הרשמה";
    }
  });

  // Forgot password
  const forgotLink = document.getElementById("forgot-password");
  if (forgotLink) {
    forgotLink.addEventListener("click", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      if (!email) {
        showError("login", "הזן אימייל קודם");
        return;
      }
      try {
        await auth.sendPasswordResetEmail(email);
        showSuccess("login", "!נשלח מייל לאיפוס סיסמה");
      } catch (err) {
        showError("login", translateError(err.code));
      }
    });
  }
});

// ─── Helpers ─────────────────────────────────────────────────

function translateError(code) {
  const map = {
    "auth/email-already-in-use": "האימייל הזה כבר רשום",
    "auth/invalid-email": "כתובת אימייל לא תקינה",
    "auth/user-not-found": "משתמש לא נמצא",
    "auth/wrong-password": "סיסמה שגויה",
    "auth/weak-password": "הסיסמה חלשה מדי (לפחות 6 תווים)",
    "auth/too-many-requests": "יותר מדי ניסיונות, נסה שוב מאוחר יותר",
    "auth/invalid-credential": "פרטים שגויים",
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
