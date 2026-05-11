import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShieldHalved, faDatabase, faCookieBite, faUserShield, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { useLang } from "../LangContext";

export default function PrivacyPage() {
  const { t } = useLang();

  return (
    <div className="info-page">
      <h1>
        <span>
          <FontAwesomeIcon icon={faShieldHalved} />
        </span>{" "}
        {t.privacyTitle}
      </h1>
      <p className="subtitle">{t.privacySubtitle}</p>

      <div className="info-card privacy-section">
        <h2>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faDatabase} />
          </span>{" "}
          {t.whatWeCollect}
        </h2>
        <p>{t.whenYouRegister}</p>
        <ul>
          <li>{t.collectItem1}</li>
          <li>{t.collectItem2}</li>
          <li>{t.collectItem3}</li>
          <li>{t.collectItem4}</li>
        </ul>

        <h3>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faUserShield} />
          </span>{" "}
          {t.howWeUseData}
        </h3>
        <p>{t.useDataIntro}</p>
        <ul>
          <li>{t.useItem1}</li>
          <li>{t.useItem2}</li>
          <li>{t.useItem3}</li>
        </ul>
        <p>{t.noSellData}</p>

        <h3>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faDatabase} />
          </span>{" "}
          {t.dataStorage}
        </h3>
        <p>{t.dataStorageDesc}</p>

        <h3>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faCookieBite} />
          </span>{" "}
          {t.cookiesTitle}
        </h3>
        <p>{t.cookiesDesc}</p>

        <h3>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faUserShield} />
          </span>{" "}
          {t.yourRights}
        </h3>
        <ul>
          <li>
            <strong>{t.rightAccess}</strong>
          </li>
          <li>
            <strong>{t.rightDeletion}</strong>
          </li>
          <li>
            <strong>{t.rightCorrection}</strong>
          </li>
        </ul>

        <h3>
          <span className="fa-icon">
            <FontAwesomeIcon icon={faEnvelope} />
          </span>{" "}
          {t.privacyContact}
        </h3>
        <p>
          {t.privacyContactDesc}{" "}
          <a href="mailto:support@quickduka.com">support@quickduka.com</a>.
        </p>
      </div>
    </div>
  );
}
