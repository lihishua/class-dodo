# CLASSQUAD

A Hebrew-language classroom practice web app. Students compete in math and English quizzes, track their scores on a live leaderboard, and stay up to date with class events and weekly summaries.

## Features

**For students**
- Math quiz ("חשבוניאדה") — multiple-choice questions with confetti on correct answers
- English quiz ("אנגליתוש") — same format for English vocabulary/grammar
- Live podium leaderboard on the dashboard
- Upcoming events calendar
- Downloadable weekly summary files

**For teachers (admins)**
- Add / delete math and English questions
- Manage user accounts and approve pending admins
- Post upcoming events
- Upload weekly summary files to Firebase Storage
- Reset leaderboards

## Tech stack

- Vanilla JS, HTML, CSS — no build tool
- Firebase compat SDK v10.12.2 (Auth, Firestore, Storage) via CDN
- RTL Hebrew UI

## Project structure

```
index.html          Login & registration
app.html            Student dashboard
math.html           Math quiz
english.html        English quiz
admin.html          Admin panel
profile.html        User profile
js/
  firebase-config.js  Firebase init, auth/db/storage globals, requireAuth/requireAdmin guards
  auth.js             Login & registration logic
  app.js              Dashboard: events, leaderboard, summary link
  math.js             Math quiz engine
  english.js          English quiz engine
  admin.js            Admin panel logic
  profile.js          Profile page logic
  api-keys.js         API keys (gitignored)
css/styles.css      All styles
assets/             Images and fonts
```

## Firestore collections

| Collection | Contents |
|---|---|
| `users` | User profiles, roles (`student` / `pending_admin` / `admin`), scores |
| `mathQuestions` | Math question bank |
| `englishQuestions` | English question bank |
| `events` | Upcoming class events |
| `summaries` | Weekly summary file metadata |

## Setup

1. Create a Firebase project with Auth (email/password), Firestore, and Storage enabled.
2. Copy your Firebase config into `js/api-keys.js` (this file is gitignored):

```js
// js/api-keys.js
const FIREBASE_API_KEY = "...";
const FIREBASE_AUTH_DOMAIN = "...";
const FIREBASE_PROJECT_ID = "...";
const FIREBASE_STORAGE_BUCKET = "...";
const FIREBASE_MESSAGING_SENDER_ID = "...";
const FIREBASE_APP_ID = "...";
```

3. Set a teacher registration code in `js/firebase-config.js` (`ADMIN_CODE`).
4. Open `index.html` in a browser (or deploy as a static site — no server required).

## User roles

| Role | Access |
|---|---|
| `student` | Quizzes, dashboard, profile |
| `pending_admin` | Same as student — awaiting admin approval |
| `admin` | Everything above + admin panel |

Teachers register with the teacher code, which sets their role to `pending_admin`. An existing admin then upgrades them to `admin` via the admin panel.
