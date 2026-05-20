// ═══════════════════════════════════════════════════════════════
// THE DODOS — Firebase Configuration
// ═══════════════════════════════════════════════════════════════
// Fill in your Firebase project credentials below.
// Get them from: https://console.firebase.google.com → Project Settings → Web App

// ANTHROPIC_KEY is loaded from js/api-keys.js (gitignored — not in repo)
const ADMIN_CODE = 'dodo2026'; // change this to whatever code you give your teachers

const firebaseConfig = {
  apiKey: "AIzaSyDAgO7ir8mZLsCZSbB4Iw6z30yt3xJ190M",
  authDomain: "class-dodo-4f249.firebaseapp.com",
  projectId: "class-dodo-4f249",
  storageBucket: "class-dodo-4f249.firebasestorage.app",
  messagingSenderId: "519410221662",
  appId: "1:519410221662:web:1f9d5105d89ea68807eacf",
  measurementId: "G-CX4MEG8HBV"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ─── Auth State Helper ───────────────────────────────────────
// Returns a promise that resolves with the current user (or null)
function getCurrentUser() {
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged(user => {
      unsub();
      resolve(user);
    });
  });
}

// ─── User Profile Helper ────────────────────────────────────
// Gets user profile from Firestore (includes role, displayName, etc.)
async function getUserProfile(uid) {
  const doc = await db.collection("users").doc(uid).get();
  return doc.exists ? doc.data() : null;
}

// ─── Auth Guard ─────────────────────────────────────────────
// Redirect to login if not authenticated
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "index.html";
    return null;
  }
  const profile = await getUserProfile(user.uid);
  return { user, profile };
}

// ─── Admin Guard ────────────────────────────────────────────
async function requireAdmin() {
  const result = await requireAuth();
  if (!result) return null;
  if (result.profile?.role !== "admin") {
    window.location.href = "app.html";
    return null;
  }
  return result;
}
