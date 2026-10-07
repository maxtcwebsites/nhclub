import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useIntro } from '../intro/IntroContext.jsx';
import { CLUB_NAME, LOCATION_NAME } from '../config.js';
import Crest from '../components/Crest.jsx';

export default function Landing() {
  const { user, emailVerified } = useAuth();
  const { done } = useIntro();
  const signedIn = Boolean(user && emailVerified);
  const strip = `${CLUB_NAME} /// `.repeat(6);

  return (
    <section className={`landing ${done ? 'go' : ''}`}>
      <div className="landing-bg" aria-hidden="true">
        <div className="row">
          <span>{strip}</span>
          <span>{strip}</span>
        </div>
        <div className="row reverse">
          <span>{strip}</span>
          <span>{strip}</span>
        </div>
      </div>
      <div className="landing-inner">
        <div className="landing-crest-wrap">
          <Crest split className="landing-crest" label={`${CLUB_NAME} crest`} />
        </div>
        <div className="landing-copy">
          <div className="eyebrow">{LOCATION_NAME}</div>
          <h1 className="wordmark" aria-label={CLUB_NAME}>
            {[...CLUB_NAME].map((ch, i) => (
              <span key={i} className="ch" style={{ '--i': i }} aria-hidden="true">
                {ch === ' ' ? ' ' : ch}
              </span>
            ))}
            <span className="type-cursor" aria-hidden="true" />
          </h1>
          <div className="landing-actions">
            {signedIn ? (
              <Link to="/dashboard" className="btn btn-primary btn-lg">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-primary btn-lg">
                  Sign in
                </Link>
                <Link to="/signup" className="btn btn-lg">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
