import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faQuestionCircle,
  faChevronDown,
  faChevronUp,
  faChartLine,
  faHandHoldingDollar,
  faCartPlus,
  faReceipt,
  faTriangleExclamation,
  faBox,
  faSquareCheck,
  faClockRotateLeft,
  faMobileScreen,
  faLock,
  faMoneyBill,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import { faSquareCheck as faSquareCheckR } from "@fortawesome/free-regular-svg-icons";

const HOW_TO_STEPS = [
  {
    icon: faChartLine,
    title: "Dashboard",
    color: "var(--green)",
    desc: "Your dashboard is the first thing you see when you log in. It shows your sales, purchases, expenses, losses and profit for the current month at a glance. You also see your recent activity and a 6-month performance chart. Use it to know how your business is doing every day.",
  },
  {
    icon: faMoneyBill,
    title: "Recording Sales",
    color: "#22c55e",
    desc: "Go to Sales and tap New Sale. Enter the date, what you sold, the customer name (optional), phone number (optional), and the amount. Save it. That sale now shows up in your reports and dashboard. Every shilling you earn should be entered here.",
  },
  {
    icon: faSquareCheckR,
    title: "Tracking Debts with Credits",
    color: "var(--orange)",
    desc: "When a customer takes goods on credit, go to Credits and tap New Credit. Enter their name, phone, what they took, the amount, and a due date. The app will track how much they owe. When they pay, tap Pay on their card and enter the amount. Once fully paid, it automatically moves to Sales. If someone never pays, mark them as Bad Debt.",
  },
  {
    icon: faCartPlus,
    title: "Recording Purchases",
    color: "#3b82f6",
    desc: "Go to Purchases and tap New Purchase. Record every item you buy for your business including stock, raw materials and supplies. Enter the date, item, supplier name, and cost. This helps you know exactly how much you are spending on stock.",
  },
  {
    icon: faReceipt,
    title: "Logging Expenses",
    color: "#a855f7",
    desc: "Expenses are costs that are not stock purchases. Things like rent, electricity, transport, airtime, and salaries go here. Go to Expenses and tap New Expense. Choose a category, enter the amount and date. This helps you see where your money is going outside of buying stock.",
  },
  {
    icon: faTriangleExclamation,
    title: "Recording Losses",
    color: "var(--red)",
    desc: "Things go wrong in business. When stock expires, gets stolen, is damaged or goes to waste, record it in Losses. Go to Losses and tap New Loss. Enter what was lost and its value. This keeps your profit calculations accurate and honest.",
  },
  {
    icon: faBox,
    title: "stock",
    color: "#14b8a6",
    desc: "Use stock to keep a list of all the items you sell along with their prices. This makes it faster to fill in sales and purchases because you can refer to your own price list. Go to stock and add your items with their names and prices.",
  },
  {
    icon: faChartLine,
    title: "Reports",
    color: "var(--green)",
    desc: "Reports show you a full financial summary for any month you choose. You can see your total sales, purchases, expenses, losses, net profit and profit margin. There are also charts showing trends over 6 months. Use this at the end of every month to review your business performance.",
  },
  {
    icon: faClockRotateLeft,
    title: "History",
    color: "#6366f1",
    desc: "History keeps a record of every change made in the app. Every time you add, edit or delete a record, it is logged here. If you accidentally delete something, you can restore it from History. You can also filter by Added, Edited, Deleted or Restored.",
  },
];

const faqs = [
  {
    q: "How much does QuickDuka cost?",
    a: "QuickDuka costs KES 100 per month. You pay via M-Pesa STK push and you will receive a prompt on your phone to enter your PIN. No card is required.",
  },
  {
    q: "How do I pay for my subscription?",
    a: "On the payment screen, enter your M-Pesa number and tap Pay Now. You will get a pop-up on your phone. Enter your M-Pesa PIN then tap Verify Payment. If you have trouble, use the manual option and WhatsApp us your M-Pesa confirmation SMS.",
  },
  {
    q: "Can I log in with my phone number?",
    a: "Yes. You can register and log in using your phone number (+254...) or your email address. Both are supported.",
  },
  {
    q: "Is my data safe?",
    a: "Your data is stored securely in Google Firebase which is the same infrastructure used by millions of apps worldwide. Each user's data is separate and only accessible by you.",
  },
  {
    q: "Can multiple people use the same account?",
    a: "QuickDuka is a single-user account. Each business owner gets their own login. If you need team access, contact us and we will advise you.",
  },
  {
    q: "How do I track who owes me money?",
    a: "Use the Credits section. Record the customer's name, phone, item and amount. You can record partial payments and the app tracks outstanding balances automatically.",
  },
  {
    q: "Can I follow up on buyers or suppliers?",
    a: "Yes. Phone numbers saved in Sales, Purchases, Expenses and Credits appear as clickable links. Tap to call directly from the app.",
  },
  {
    q: "What happens when my subscription expires?",
    a: "Your account is locked until you renew. Your data is not deleted. Pay KES 100 to resume access. You get a 2-day grace period after expiry.",
  },
  {
    q: "How do I reset my password?",
    a: "On the login screen, tap Forgot password and enter your email or phone number. We will email a reset link to your registered email address.",
  },
  {
    q: "Can I use QuickDuka offline?",
    a: "QuickDuka requires an internet connection to save and sync data. We recommend using it with mobile data or WiFi.",
  },
  {
    q: "Is there a free trial?",
    a: "There is a free 1-month trial when you first register. After that, you pay KES 100 per month to continue.",
  },
  {
    q: "What is the Credits section for?",
    a: "Credits is where you track customers who have taken goods on credit and owe you money. You can record partial payments and monitor outstanding balances. Once a customer pays in full, the record automatically moves to Sales.",
  },
  {
    q: "What is the difference between Expenses and Losses?",
    a: "Expenses are planned business costs like rent, transport and salaries. Losses are unexpected events like stolen or expired stock. Both reduce your profit but they are tracked separately so you can see what is causing your costs.",
  },
];

function FaqItem({ f, i, open, setOpen }) {
  return (
    <div className="faq-item">
      <div className="faq-q" onClick={() => setOpen(open === i ? null : i)}>
        {f.q}
        <FontAwesomeIcon
          icon={open === i ? faChevronUp : faChevronDown}
          style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }}
        />
      </div>
      {open === i && <div className="faq-a">{f.a}</div>}
    </div>
  );
}

export default function FAQPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [activeTab, setActiveTab] = useState("how");

  return (
    <div className="info-page">
      <h1>
        <span style={{ color: "var(--green)" }}>
          <FontAwesomeIcon icon={faInfoCircle} />
        </span>{" "}
        Help Centre
      </h1>
      <p className="subtitle">
        Learn how to use QuickDuka and get answers to common questions.
      </p>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("how")}
          style={{
            padding: "9px 18px",
            borderRadius: 0,
            border: "none",
            borderBottom:
              activeTab === "how"
                ? "3px solid var(--green)"
                : "3px solid transparent",
            background: "transparent",
            color: activeTab === "how" ? "var(--green)" : "var(--muted)",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          How to Use
        </button>
        <button
          onClick={() => setActiveTab("faq")}
          style={{
            padding: "9px 18px",
            borderRadius: 0,
            border: "none",
            borderBottom:
              activeTab === "faq"
                ? "3px solid var(--green)"
                : "3px solid transparent",
            background: "transparent",
            color: activeTab === "faq" ? "var(--green)" : "var(--muted)",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <FontAwesomeIcon icon={faQuestionCircle} style={{ marginRight: 6 }} />
          FAQs
        </button>
      </div>

      {activeTab === "how" && (
        <div>
          <div
            className="info-card"
            style={{ marginBottom: 14, borderLeft: "4px solid var(--green)" }}
          >
            <h2 style={{ marginBottom: 8 }}>
              <FontAwesomeIcon
                icon={faMobileScreen}
                style={{ color: "var(--green)", marginRight: 8 }}
              />
              Welcome to QuickDuka
            </h2>
            <p>
              QuickDuka is a simple business management app built for small
              business owners in Kenya. Use it to record your daily sales, track
              expenses, manage customer debts, and see your profit every month.
              Everything is saved securely online so you can access it from any
              device.
            </p>
            <p
              style={{
                marginTop: 8,
                background: "var(--green-bg)",
                padding: "10px 14px",
                borderRadius: 6,
                border: "1px solid var(--green-lt)",
              }}
            >
              <strong style={{ color: "var(--green)" }}>Tip:</strong> Record
              every sale and expense daily for accurate reports at the end of
              the month.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {HOW_TO_STEPS.map((step, i) => (
              <div
                key={i}
                className="info-card"
                style={{ borderLeft: `4px solid ${step.color}` }}
              >
                <h2>
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: step.color + "22",
                      color: step.color,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      marginRight: 10,
                      flexShrink: 0,
                    }}
                  >
                    <FontAwesomeIcon icon={step.icon} />
                  </span>
                  {step.title}
                </h2>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>

          <div
            className="info-card"
            style={{ marginTop: 14, textAlign: "center" }}
          >
            <h2 style={{ justifyContent: "center" }}>
              <FontAwesomeIcon
                icon={faLock}
                style={{ color: "var(--green)", marginRight: 8 }}
              />
              Your Data is Private
            </h2>
            <p>
              All your business records are stored securely in your personal
              account. No one else can see your data. QuickDuka does not share
              your information with anyone.
            </p>
          </div>
        </div>
      )}

      {activeTab === "faq" && (
        <div>
          <div className="info-card">
            {faqs.map((f, i) => (
              <FaqItem
                key={i}
                f={f}
                i={i}
                open={openFaq}
                setOpen={setOpenFaq}
              />
            ))}
          </div>
          <div className="info-card" style={{ marginTop: 14 }}>
            <h2>Still have questions?</h2>
            <p>
              Email us at{" "}
              <a href="mailto:anitapatrick025@gmail.com">
                anitapatrick025@gmail.com
              </a>{" "}
              or WhatsApp us and we will respond within 24 hours.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
