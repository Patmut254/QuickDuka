import { useState, useRef } from "react";
import { FontAwesomeIcon } from "./Icon";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import {
  faEnvelope, faHeadset, faClock, faMapMarkerAlt, faPaperPlane,
  faCheckCircle, faUser, faCommentDots, faTag, faPhone,
} from "@fortawesome/free-solid-svg-icons";
import emailjs from "@emailjs/browser";
import { useLang } from "../LangContext";

// Same EmailJS project used by src/emailService.js — see that file for
// full setup steps. This form needs its own template (contact-form fields
// differ from the notification emails), so it gets its own env var.
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || "";
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_CONTACT || "";
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "";

export default function ContactPage() {
  const { t } = useLang();
  const formRef = useRef(null);
  const [form, setForm] = useState({ from_name: "", from_email: "", phone: "", subject: "", message: "" });
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setErrorMsg("");
    try {
      await emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, formRef.current, EMAILJS_PUBLIC_KEY);
      setStatus("success");
      setForm({ from_name: "", from_email: "", phone: "", subject: "", message: "" });
    } catch (err) {
      console.error("EmailJS error:", err);
      setErrorMsg(t.failedSendContact);
      setStatus("error");
    }
  };

  return (
    <div className="info-page">
      <h1><span><FontAwesomeIcon icon={faHeadset} /></span>{" "}{t.contactTitle}</h1>
      <p className="subtitle">{t.contactSubtitle}</p>

      <div className="info-card">
        <h2><span className="fa-icon"><FontAwesomeIcon icon={faCommentDots} /></span>{" "}{t.sendMessage}</h2>
        {status === "success" ? (
          <div className="contact-success-msg"><FontAwesomeIcon icon={faCheckCircle} /> {t.messageSent}</div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="contact-form-wrap" noValidate>
            <div className="contact-form-row">
              <div className="field-group">
                <label>{t.yourName}</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box"><FontAwesomeIcon icon={faUser} /></div>
                  <input type="text" name="from_name" placeholder={t.fullNamePh} value={form.from_name} onChange={handleChange} required />
                </div>
              </div>
              <div className="field-group">
                <label>{t.emailAddress}</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box"><FontAwesomeIcon icon={faEnvelope} /></div>
                  <input type="email" name="from_email" placeholder="you@example.com" value={form.from_email} onChange={handleChange} required />
                </div>
              </div>
            </div>
            <div className="contact-form-row">
              <div className="field-group">
                <label>{t.phoneOptional}</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box"><FontAwesomeIcon icon={faPhone} /></div>
                  <input type="tel" name="phone" placeholder="07... or +254..." value={form.phone} onChange={handleChange} />
                </div>
              </div>
              <div className="field-group">
                <label>{t.subject}</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box"><FontAwesomeIcon icon={faTag} /></div>
                  <input type="text" name="subject" placeholder={t.subjectPh} value={form.subject} onChange={handleChange} required />
                </div>
              </div>
            </div>
            <div className="field-group">
              <label>{t.message}</label>
              <textarea name="message" rows={4} placeholder={t.messagePh} value={form.message} onChange={handleChange} required />
            </div>
            {status === "error" && <div className="contact-error-msg">{errorMsg}</div>}
            <button type="submit" className="contact-submit-btn" disabled={status === "sending"}>
              <FontAwesomeIcon icon={faPaperPlane} />
              {status === "sending" ? t.sending2 : t.sendMessageBtn}
            </button>
          </form>
        )}
      </div>

      <div className="info-card">
        <h2><span className="fa-icon"><FontAwesomeIcon icon={faWhatsapp} /></span>{" "}{t.whatsappSupport}</h2>
        <p>{t.whatsappDesc}</p>
        <div className="contact-methods">
          <a href="https://wa.me/254769758819?text=Hello QuickDuka, I need help with..." target="_blank" rel="noreferrer" className="contact-method">
            <div className="contact-method-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
              <FontAwesomeIcon icon={faWhatsapp} />
            </div>
            <div className="contact-method-text">
              <strong>WhatsApp</strong>
              <span>{t.whatsappLabel}</span>
            </div>
          </a>
        </div>
      </div>

      <div className="info-card">
        <h2><span className="fa-icon"><FontAwesomeIcon icon={faClock} /></span>{" "}{t.supportHours}</h2>
        <p>{t.supportHoursDetail1}</p>
        <p>{t.supportHoursDetail2}</p>
        <p>{t.supportHoursDetail3}</p>
      </div>

      <div className="info-card">
        <h2><span className="fa-icon"><FontAwesomeIcon icon={faMapMarkerAlt} /></span>{" "}{t.aboutQuickDuka}</h2>
        <p>{t.aboutDesc1}</p>
        <p>{t.aboutDesc2}</p>
      </div>
    </div>
  );
}
