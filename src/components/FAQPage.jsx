import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQuestionCircle, faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";

const faqs = [
  { q: "How much does QuickDuka cost?", a: "QuickDuka costs KES 100 per month. Pay via M-Pesa STK push — you'll receive a prompt on your phone to enter your PIN. No card required." },
  { q: "How do I pay for my subscription?", a: "On the payment screen, enter your M-Pesa number and tap 'Pay Now'. You'll get a pop-up on your phone. Enter your M-Pesa PIN, then tap 'Verify Payment'. If you have trouble, use the manual option and WhatsApp us your M-Pesa confirmation SMS." },
  { q: "Can I log in with my phone number?", a: "Yes! You can register and log in using your phone number (+254...) or your email address. Both are supported." },
  { q: "Is my data safe?", a: "Your data is stored securely in Google Firebase — the same infrastructure used by millions of apps worldwide. Each user's data is separate and only accessible by you." },
  { q: "Can multiple people use the same account?", a: "QuickDuka is a single-user account. Each business owner gets their own login. If you need team access, contact us and we'll advise you." },
  { q: "How do I track who owes me money?", a: "Use the Credits section. Record the customer's name, phone, item, and amount. You can record partial payments and the app tracks outstanding balances automatically." },
  { q: "Can I follow up on buyers or suppliers?", a: "Yes. Phone numbers are stored in Sales, Purchases, Expenses, and Credits. They appear as clickable links — tap to call directly from the app." },
  { q: "What happens when my subscription expires?", a: "Your account is locked until you renew. Your data is not deleted — pay KES 100 to resume access. You get a 2-day grace period after expiry." },
  { q: "How do I reset my password?", a: "On the login screen, tap 'Forgot password?' and enter your email or phone number. We'll email a reset link to your registered email address." },
  { q: "Can I use QuickDuka offline?", a: "QuickDuka requires an internet connection to save and sync data. We recommend using it with mobile data or WiFi." },
  { q: "Is there a free trial?", a: "There is no free trial — the subscription starts at KES 100 for your first month." },
];

export default function FAQPage() {
  const [open, setOpen] = useState(null);
  return (
    <div className="info-page">
      <h1><span><FontAwesomeIcon icon={faQuestionCircle} /></span> Frequently Asked Questions</h1>
      <p className="subtitle">Answers to the most common questions about QuickDuka.</p>
      <div className="info-card">
        {faqs.map((f, i) => (
          <div className="faq-item" key={i}>
            <div className="faq-q" onClick={() => setOpen(open === i ? null : i)}>
              {f.q}
              <FontAwesomeIcon icon={open === i ? faChevronUp : faChevronDown} style={{ fontSize: 12, color: "var(--muted)" }} />
            </div>
            {open === i && <div className="faq-a">{f.a}</div>}
          </div>
        ))}
      </div>
      <div className="info-card">
        <h2>Still have questions?</h2>
        <p>Email us at <a href="mailto:anitajehu13@gmail.com">anitajehu13@gmail.com</a> or WhatsApp us and we'll respond within 24 hours.</p>
      </div>
    </div>
  );
}
