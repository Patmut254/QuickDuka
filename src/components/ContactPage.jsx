import { useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import {
  faEnvelope,
  faHeadset,
  faClock,
  faMapMarkerAlt,
  faPaperPlane,
  faCheckCircle,
  faUser,
  faCommentDots,
  faTag,
  faPhone,
} from "@fortawesome/free-solid-svg-icons";
import emailjs from "@emailjs/browser";

// EmailJS config
// HOW TO SET UP:
// 1. Install emailjs:  npm install @emailjs/browser
// 2. Go to https://www.emailjs.com → Account → API Keys → copy "Public Key"
// 3. Create a Service (Gmail / Outlook) → copy Service ID
// 4. Create an Email Template → copy Template ID
//    Template variables used: from_name, from_email, phone, subject, message, reply_to
const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID"; // ← replace
const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID"; // ← replace
const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY"; // ← replace
//

export default function ContactPage() {
  const formRef = useRef(null);

  const [form, setForm] = useState({
    from_name: "",
    from_email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setErrorMsg("");
    try {
      await emailjs.sendForm(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        formRef.current,
        EMAILJS_PUBLIC_KEY,
      );
      setStatus("success");
      setForm({
        from_name: "",
        from_email: "",
        phone: "",
        subject: "",
        message: "",
      });
    } catch (err) {
      console.error("EmailJS error:", err);
      setErrorMsg("Failed to send. Please try WhatsApp instead.");
      setStatus("error");
    }
  };

  return (
    <div className="info-page">
      <h1>
        <span>
          <FontAwesomeIcon icon={faHeadset} />
        </span>{" "}
        Contact Us
      </h1>
      <p className="subtitle">
        We are here to help. Fill in the form or reach us on WhatsApp.
      </p>

      <div className="info-card">
        <h2>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faCommentDots} />
          </span>{" "}
          Send Us a Message
        </h2>

        {status === "success" ? (
          <div className="contact-success-msg">
            <FontAwesomeIcon icon={faCheckCircle} /> Message sent! We will get
            back to you shortly.
          </div>
        ) : (
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="contact-form-wrap"
            noValidate
          >
            <div className="contact-form-row">
              <div className="field-group">
                <label>Your Name</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box">
                    <FontAwesomeIcon icon={faUser} />
                  </div>
                  <input
                    type="text"
                    name="from_name"
                    placeholder="Full name"
                    value={form.from_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div className="field-group">
                <label>Email Address</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box">
                    <FontAwesomeIcon icon={faEnvelope} />
                  </div>
                  <input
                    type="email"
                    name="from_email"
                    placeholder="you@example.com"
                    value={form.from_email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="contact-form-row">
              <div className="field-group">
                <label>Phone (Optional)</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box">
                    <FontAwesomeIcon icon={faPhone} />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="07... or +254..."
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="field-group">
                <label>Subject</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box">
                    <FontAwesomeIcon icon={faTag} />
                  </div>
                  <input
                    type="text"
                    name="subject"
                    placeholder="e.g. Subscription issue"
                    value={form.subject}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="field-group">
              <label>Message</label>
              <textarea
                name="message"
                rows={4}
                placeholder="Describe your issue or question..."
                value={form.message}
                onChange={handleChange}
                required
              />
            </div>

            {status === "error" && (
              <div className="contact-error-msg">{errorMsg}</div>
            )}

            <button
              type="submit"
              className="contact-submit-btn"
              disabled={status === "sending"}
            >
              <FontAwesomeIcon icon={faPaperPlane} />
              {status === "sending" ? "Sending..." : "Send Message"}
            </button>
          </form>
        )}
      </div>

      <div className="info-card">
        <h2>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faWhatsapp} />
          </span>{" "}
          WhatsApp Support
        </h2>
        <p>Prefer a faster reply? Message us directly on WhatsApp.</p>
        <div className="contact-methods">
          <a
            href="https://wa.me/254769758819?text=Hello QuickDuka, I need help with..."
            target="_blank"
            rel="noreferrer"
            className="contact-method"
          >
            <div
              className="contact-method-icon"
              style={{ background: "#dcfce7", color: "#16a34a" }}
            >
              <FontAwesomeIcon icon={faWhatsapp} />
            </div>
            <div className="contact-method-text">
              <strong>WhatsApp</strong>
              <span>Quick responses, tap to chat.</span>
            </div>
          </a>
        </div>
      </div>

      <div className="info-card">
        <h2>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faClock} />
          </span>{" "}
          Support Hours
        </h2>
        <p>Monday – Friday: 8:00 AM – 8:00 PM EAT</p>
        <p>Saturday: 9:00 AM – 5:00 PM EAT</p>
        <p>Sunday: Closed (responses on Monday)</p>
      </div>

      <div className="info-card">
        <h2>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faMapMarkerAlt} />
          </span>{" "}
          About QuickDuka
        </h2>
        <p>
          QuickDuka is built for Kenyan small businesses like: dukas, boutiques,
          agro-dealers, wholesalers, and more.
        </p>
        <p>
          For subscription, billing, or account issues, send a message above
          with your registered phone or email and we will sort you out quickly.
        </p>
      </div>
    </div>
  );
}
