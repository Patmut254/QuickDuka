# SalesPro - Setup & Deployment Guide

## What You Need

- A Google account (for Firebase)
- A Netlify / Vercel account (free) for hosting
- Node.js installed on your computer (https://nodejs.org)

---

## STEP 1 - Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"**
3. Name it (e.g. `salespro-client`) → Continue → Disable Google Analytics (optional) → **Create project**

---

## STEP 2 - Add a Web App to Firebase

1. Inside your project, click the **</>** (Web) icon
2. Give it a nickname (e.g. `salespro`)
3. Click **Register app**
4. You'll see a `firebaseConfig` block like this - **copy it**:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "salespro-xxx.firebaseapp.com",
  projectId: "salespro-xxx",
  storageBucket: "salespro-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc123",
};
```


https://quickduka-default-rtdb.firebaseio.com/
---

## STEP 3 - Enable Firebase Auth

1. In Firebase Console → **Authentication** → **Get started**
2. Click **Email/Password** → Enable it → **Save**
3. Click **Add user** → enter the client's email and password
   - Example: `owner@mybusiness.com` / `SecurePass2024!`
   - **This is the ONE login your client will use**

---

## STEP 4 - Enable Firestore Database

1. In Firebase Console → **Firestore Database** → **Create database**
2. Choose **Start in production mode** → Next
3. Pick a region (choose closest, e.g. `europe-west1` for Kenya)
4. Click **Enable**

### Set Firestore Rules (allow authenticated users only):

Go to **Firestore → Rules** and paste this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **Publish**.

> **Note:** The app also uses an `auditLog` collection automatically. No extra setup needed - it is covered by the same security rules above.

---

## STEP 5 - Add Firebase Config to the App

Open the project folder, then open this file:

```
src/firebase.js
```

Replace the placeholder config with your real Firebase config from Step 2.

---

## STEP 6 - Build the App

Open a terminal in the project folder and run:

```bash
npm install
npm run build
```

This creates a `dist/` folder - this is what you deploy.

---

## STEP 7 - Deploy to Netlify (Free)

### Option A - Drag & Drop (Easiest)

1. Go to https://netlify.com → Sign up/log in
2. Click **"Add new site"** → **"Deploy manually"**
3. Drag and drop the **`dist`** folder onto the page
4. Netlify gives you a URL like: `https://cool-name-123.netlify.app`
5. (Optional) Go to **Site settings → Change site name** to something like `mybusiness-sales`

### Option B - Connect GitHub (Auto-deploys on changes)

1. Push the project to GitHub
2. In Netlify: **Add new site → Import from Git**
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Deploy

---

## STEP 8 - Give Client Their Login

Send them:

- **URL**: `https://your-site.netlify.app`
- **Email**: the email you created in Step 3
- **Password**: the password you set in Step 3

---

## Client Features

| Feature       | What It Does                              |
| ------------- | ----------------------------------------- |
| **Dashboard** | Summary of this month + 6-month chart     |
| **Sales**     | Record and search all sales               |
| **Purchases** | Record stock/inventory purchases          |
| **Expenses**  | Record miscellaneous costs by category    |
| **Reports**   | Monthly P&L, bar chart, expense pie chart |

---

## Resetting / Changing the Password

1. Go to Firebase Console → Authentication → Users
2. Click the three dots next to the user → **Reset password** or **Edit**

---

## That's it! 🎉

The app auto-saves all data to Firebase in real-time. No data is lost if the browser closes.
