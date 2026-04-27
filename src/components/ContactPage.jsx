import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import { faEnvelope, faPhone, faWhatsapp } from "@fortawesome/free-brands-svg-icons";

import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import {
  faEnvelope,
  faPhone,
  faHeadset,
  faMapMarkerAlt,
  faClock,
} from "@fortawesome/free-solid-svg-icons";
// import { faHeadset, faMapMarkerAlt, faClock } from "@fortawesome/free-solid-svg-icons";

export default function ContactPage() {
  return (
    <div className="info-page">
      <h1><span><FontAwesomeIcon icon={faHeadset} /></span> Contact Us</h1>
      <p className="subtitle">We're here to help. Reach out through any of the channels below.</p>

      <div className="info-card">
        <h2><span className="fa-icon"><FontAwesomeIcon icon={faHeadset} /></span> Get In Touch</h2>
        <p>Have a question, issue, or suggestion? We'd love to hear from you. QuickDuka support is available Monday–Saturday, 8am–8pm EAT.</p>
        <div className="contact-methods">
          <a href="mailto:anitajehu13@gmail.com" className="contact-method">
            <div className="contact-method-icon"><FontAwesomeIcon icon={faEnvelope} /></div>
            <div className="contact-method-text">
              <strong>Email Support</strong>
              <span>anitajehu13@gmail.com</span>
            </div>
          </a>
          <a href="https://wa.me/254700000000?text=Hello QuickDuka, I need help with..." target="_blank" rel="noreferrer" className="contact-method">
            <div className="contact-method-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
              <FontAwesomeIcon icon={faWhatsapp} />
            </div>
            <div className="contact-method-text">
              <strong>WhatsApp</strong>
              <span>Quick responses — tap to chat</span>
            </div>
          </a>
        </div>
      </div>

      <div className="info-card">
        <h2><span className="fa-icon"><FontAwesomeIcon icon={faClock} /></span> Support Hours</h2>
        <p>Monday – Friday: 8:00 AM – 8:00 PM EAT</p>
        <p>Saturday: 9:00 AM – 5:00 PM EAT</p>
        <p>Sunday: Closed (email responses on Monday)</p>
      </div>

      <div className="info-card">
        <h2><span className="fa-icon"><FontAwesomeIcon icon={faMapMarkerAlt} /></span> About QuickDuka</h2>
        <p>QuickDuka is built for Kenyan small businesses — dukas, boutiques, agro-dealers, wholesalers, and more. We're proudly made in Kenya. 🇰🇪</p>
        <p>For subscription payments, billing queries, or account issues, email us with your registered phone number or email address and we'll sort you out quickly.</p>
      </div>
    </div>
  );
}
