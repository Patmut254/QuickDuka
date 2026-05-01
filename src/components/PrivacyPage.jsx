import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShieldHalved,
  faDatabase,
  faCookieBite,
  faUserShield,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";

export default function PrivacyPage() {
  return (
    <div className="info-page">
      <h1>
        <span>
          <FontAwesomeIcon icon={faShieldHalved} />
        </span>{" "}
        Privacy Policy
      </h1>
      <p className="subtitle">
        Last updated: April 2026. QuickDuka is committed to protecting your
        privacy.
      </p>

      <div className="info-card privacy-section">
        <h2>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faDatabase} />
          </span>{" "}
          What We Collect
        </h2>
        <p>When you register, we collect:</p>
        <ul>
          <li>Your name, business name, email address, and phone number</li>
          <li>Your county and sub-county (for regional analytics)</li>
          <li>
            Business records you enter: sales, purchases, expenses, credits, and
            stock items
          </li>
          <li>
            Subscription and payment status (not your M-Pesa PIN — we never see
            that)
          </li>
        </ul>

        <h3>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faUserShield} />
          </span>{" "}
          How We Use Your Data
        </h3>
        <p>Your data is used exclusively to:</p>
        <ul>
          <li>
            Power your QuickDuka account and show you your own business reports
          </li>
          <li>
            Send you account notifications (subscription reminders, password
            resets)
          </li>
          <li>Verify M-Pesa payments to activate your subscription</li>
        </ul>
        <p>
          We do <strong>not</strong> sell your data to third parties. We do not
          use your data for advertising.
        </p>

        <h3>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faDatabase} />
          </span>{" "}
          Data Storage
        </h3>
        <p>
          All data is stored in Google Firebase (Firestore), hosted in Google's
          secure cloud infrastructure. Your business data is private to your
          account and cannot be accessed by other QuickDuka users.
        </p>

        <h3>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faCookieBite} />
          </span>{" "}
          Cookies & Local Storage
        </h3>
        <p>
          QuickDuka uses browser local storage only to remember your dark/light
          mode preference. We do not use tracking cookies or third-party
          advertising cookies.
        </p>

        <h3>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faUserShield} />
          </span>{" "}
          Your Rights
        </h3>
        <ul>
          <li>
            <strong>Access:</strong> You can view all your data within the app
            at any time.
          </li>
          <li>
            <strong>Deletion:</strong> Email us to request deletion of your
            account and all associated data.
          </li>
          <li>
            <strong>Correction:</strong> Update your business info via your
            account settings.
          </li>
        </ul>

        <h3>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faEnvelope} />
          </span>{" "}
          Contact
        </h3>
        <p>
          For privacy questions or data requests, contact us at{" "}
          <a href="mailto:anitapatrick025@gmail.com">
            anitapatrick025@gmail.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
