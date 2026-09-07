// emailService.js — sends transactional emails from the browser via EmailJS.
//
// QuickDuka has no email backend (VITE_BACKEND_URL only handles M-Pesa /
// admin actions), so every notification email goes out client-side through
// EmailJS — the same library already wired into ContactPage.jsx.
//
// SETUP (one-time):
// 1. Create a free account at https://www.emailjs.com/
// 2. Add an Email Service (Gmail, Outlook, etc.) → copy its Service ID.
// 3. Create ONE template — Subject: {{title}}, Body uses {{to_name}} and
//    {{message}}, To: {{to_email}}. All six notifications below share this
//    exact same shape, so one template covers every one of them (the
//    ContactPage.jsx form uses a second, separately-shaped template since
//    its fields — from_name/from_email/subject/message — are different).
// 4. Copy your Public Key from Account → API Keys.
// 5. Add these to your .env file:
//
//    VITE_EMAILJS_PUBLIC_KEY=
//    VITE_EMAILJS_SERVICE_ID=
//    VITE_EMAILJS_TEMPLATE_NOTIFY=
//
// Until these are set, every call below just logs a warning and does
// nothing — it will never crash the app or block the action it's attached
// to (login, suspend, delete, referrer approval, etc. all still work).

import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || "";
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "";

// One shared template ID for all six notification types below — they all
// send the identical {{to_email}}/{{to_name}}/{{title}}/{{message}} shape,
// so there's no need for one template per event.
const NOTIFY_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_NOTIFY || "";
const TEMPLATES = {
  referrerAccepted: NOTIFY_TEMPLATE_ID,
  referrerRejected: NOTIFY_TEMPLATE_ID,
  referrerPaid: NOTIFY_TEMPLATE_ID,
  loginSuccess: NOTIFY_TEMPLATE_ID,
  accountSuspended: NOTIFY_TEMPLATE_ID,
  accountDeleted: NOTIFY_TEMPLATE_ID,
};

let initialized = false;
function ensureInit() {
  if (!initialized && PUBLIC_KEY) {
    emailjs.init({ publicKey: PUBLIC_KEY });
    initialized = true;
  }
}

async function sendEmail(templateKey, params) {
  const templateId = TEMPLATES[templateKey];
  if (!SERVICE_ID || !PUBLIC_KEY || !templateId) {
    console.warn(
      `[emailService] "${templateKey}" email skipped — EmailJS isn't configured yet (see src/emailService.js for setup steps).`,
    );
    return { skipped: true };
  }
  ensureInit();
  try {
    return await emailjs.send(SERVICE_ID, templateId, params);
  } catch (err) {
    // Notification failures must never block the action that triggered them
    // (login, suspend, delete, referrer approval all already happened).
    console.error(`[emailService] "${templateKey}" email failed:`, err?.text || err?.message || err);
    return { error: err };
  }
}

export function sendReferrerAcceptedEmail({ toEmail, toName }) {
  if (!toEmail) return;
  return sendEmail("referrerAccepted", {
    to_email: toEmail,
    to_name: toName || "there",
    title: "Your referrer application was accepted 🎉",
    message: `Hi ${toName || "there"}, great news — your QuickDuka referrer application has been approved. You can now start referring businesses and earning commission.`,
  });
}

export function sendReferrerRejectedEmail({ toEmail, toName }) {
  if (!toEmail) return;
  return sendEmail("referrerRejected", {
    to_email: toEmail,
    to_name: toName || "there",
    title: "Update on your QuickDuka referrer application",
    message: `Hi ${toName || "there"}, thanks for applying to become a QuickDuka referrer. After review, we're not able to approve your application at this time.`,
  });
}

export function sendReferrerPaidEmail({ toEmail, toName, amount }) {
  if (!toEmail) return;
  return sendEmail("referrerPaid", {
    to_email: toEmail,
    to_name: toName || "there",
    title: "You've been paid — QuickDuka referrals",
    message: `Hi ${toName || "there"}, KES ${Number(amount || 0).toLocaleString()} has just been paid out to you for your referrals. Thanks for partnering with QuickDuka!`,
  });
}

export function sendLoginSuccessEmail({ toEmail, toName }) {
  if (!toEmail) return;
  const when = new Date().toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return sendEmail("loginSuccess", {
    to_email: toEmail,
    to_name: toName || "there",
    title: "New login to your QuickDuka account",
    message: `Hi ${toName || "there"}, we noticed a successful login to your QuickDuka account on ${when}. If this wasn't you, please change your password right away.`,
  });
}

export function sendAccountSuspendedEmail({ toEmail, toName }) {
  if (!toEmail) return;
  return sendEmail("accountSuspended", {
    to_email: toEmail,
    to_name: toName || "there",
    title: "Your QuickDuka account has been suspended",
    message: `Hi ${toName || "there"}, your QuickDuka account has been suspended by an admin. Contact support if you believe this is a mistake.`,
  });
}

export function sendAccountDeletedEmail({ toEmail, toName }) {
  if (!toEmail) return;
  return sendEmail("accountDeleted", {
    to_email: toEmail,
    to_name: toName || "there",
    title: "Your QuickDuka account has been deleted",
    message: `Hi ${toName || "there"}, your QuickDuka account and all its data have been permanently deleted by an admin.`,
  });
}
