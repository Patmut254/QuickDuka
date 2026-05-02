import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faQuestionCircle, faChevronDown, faChevronUp, faChartLine,
  faCartPlus, faReceipt, faTriangleExclamation, faBox,
  faClockRotateLeft, faMobileScreen, faLock, faMoneyBill, faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import { faSquareCheck as faSquareCheckR } from "@fortawesome/free-regular-svg-icons";
import { useLang } from "../LangContext";

const STEP_ICONS = [
  faChartLine, faMoneyBill, faSquareCheckR, faCartPlus, faReceipt,
  faTriangleExclamation, faBox, faChartLine, faClockRotateLeft,
];
const STEP_COLORS = [
  "var(--green)", "#22c55e", "var(--orange)", "#3b82f6",
  "#a855f7", "var(--red)", "#14b8a6", "var(--green)", "#6366f1",
];

function FaqItem({ f, i, open, setOpen }) {
  return (
    <div className="faq-item">
      <div className="faq-q" onClick={() => setOpen(open === i ? null : i)}>
        {f.q}
        <FontAwesomeIcon icon={open === i ? faChevronUp : faChevronDown} style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }} />
      </div>
      {open === i && <div className="faq-a">{f.a}</div>}
    </div>
  );
}

export default function FAQPage() {
  const { t } = useLang();
  const [openFaq, setOpenFaq] = useState(null);
  const [activeTab, setActiveTab] = useState("how");

  const steps = t.howToSteps || [];
  const faqs = t.faqList || [];

  return (
    <div className="info-page">
      <h1>
        <span style={{ color: "var(--green)" }}><FontAwesomeIcon icon={faInfoCircle} /></span>{" "}
        {t.helpCentre}
      </h1>
      <p className="subtitle">{t.helpSubtitle}</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "how", label: t.howToUse },
          { id: "faq", label: t.faqsTab, icon: faQuestionCircle },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "9px 18px", borderRadius: 0, border: "none",
              borderBottom: activeTab === tab.id ? "3px solid var(--green)" : "3px solid transparent",
              background: "transparent",
              color: activeTab === tab.id ? "var(--green)" : "var(--muted)",
              fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            {tab.icon && <FontAwesomeIcon icon={tab.icon} style={{ marginRight: 6 }} />}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "how" && (
        <div>
          <div className="info-card" style={{ marginBottom: 14, borderLeft: "4px solid var(--green)" }}>
            <h2 style={{ marginBottom: 8 }}>
              <FontAwesomeIcon icon={faMobileScreen} style={{ color: "var(--green)", marginRight: 8 }} />
              {t.welcomeTitle}
            </h2>
            <p>{t.welcomeDesc}</p>
            <p style={{ marginTop: 8, background: "var(--green-bg)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--green-lt)" }}>
              <strong style={{ color: "var(--green)" }}>Tip:</strong> {t.welcomeTip}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {steps.map((step, i) => (
              <div key={i} className="info-card" style={{ borderLeft: `4px solid ${STEP_COLORS[i] || "var(--green)"}` }}>
                <h2>
                  <span style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: (STEP_COLORS[i] || "var(--green)") + "22",
                    color: STEP_COLORS[i] || "var(--green)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, marginRight: 10, flexShrink: 0,
                  }}>
                    <FontAwesomeIcon icon={STEP_ICONS[i] || faChartLine} />
                  </span>
                  {step.title}
                </h2>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="info-card" style={{ marginTop: 14, textAlign: "center" }}>
            <h2 style={{ justifyContent: "center" }}>
              <FontAwesomeIcon icon={faLock} style={{ color: "var(--green)", marginRight: 8 }} />
              {t.yourDataPrivate}
            </h2>
            <p>{t.yourDataDesc}</p>
          </div>
        </div>
      )}

      {activeTab === "faq" && (
        <div>
          <div className="info-card">
            {faqs.map((f, i) => (
              <FaqItem key={i} f={f} i={i} open={openFaq} setOpen={setOpenFaq} />
            ))}
          </div>
          <div className="info-card" style={{ marginTop: 14 }}>
            <h2>{t.stillQuestions}</h2>
            <p>
              {t.stillQuestionsEmail}{" "}
              <a href="mailto:anitapatrick025@gmail.com">anitapatrick025@gmail.com</a>{" "}
              {t.orWhatsapp}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
