import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { CLUB_NAME } from '../config.js';

export default function Landing() {
  const { user, emailVerified } = useAuth();
  const signedIn = Boolean(user && emailVerified);
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">{CLUB_NAME}</div>
          <h1>
            A happy place for <em>Northhill kids</em> to learn, play and grow.
          </h1>
          <p className="lead">
            Register your children online, keep their details up to date, and always know whether their club subscription is
            paid — the moment staff record it.
          </p>
          <div className="row" style={{ marginTop: '1.5rem' }}>
            {signedIn ? (
              <Link to="/dashboard" className="btn btn-primary btn-lg">
                Go to my dashboard
              </Link>
            ) : (
              <>
                <Link to="/signup" className="btn btn-primary btn-lg">
                  Create a parent account
                </Link>
                <Link to="/login" className="btn btn-secondary btn-lg">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
        <HeroArt />
      </section>

      <section className="grid grid-3">
        <div className="card feature">
          <div className="icon" aria-hidden="true">
            🧒
          </div>
          <h3>Enroll in minutes</h3>
          <p className="muted" style={{ margin: 0 }}>
            Add each child with allergies, medical notes, emergency contacts and who may pick them up.
          </p>
        </div>
        <div className="card feature">
          <div className="icon" aria-hidden="true">
            💳
          </div>
          <h3>See every payment</h3>
          <p className="muted" style={{ margin: 0 }}>
            Check which months are paid, until when, and the full payment history — updated live.
          </p>
        </div>
        <div className="card feature">
          <div className="icon" aria-hidden="true">
            📅
          </div>
          <h3>Attendance at a glance</h3>
          <p className="muted" style={{ margin: 0 }}>
            A calendar shows the days your child attended, with any notes from the teachers.
          </p>
        </div>
      </section>

      <section className="section">
        <h2>How it works</h2>
        <ol className="steps" style={{ padding: 0 }}>
          <li>
            <h3>Create your account</h3>
            <p className="muted" style={{ margin: 0 }}>
              Sign up with your email (or Google) and confirm your address.
            </p>
          </li>
          <li>
            <h3>Add your children</h3>
            <p className="muted" style={{ margin: 0 }}>
              Fill in their details once. You can update them anytime.
            </p>
          </li>
          <li>
            <h3>Pay at the club</h3>
            <p className="muted" style={{ margin: 0 }}>
              Staff record your payment and you’ll see it on your dashboard straight away.
            </p>
          </li>
        </ol>
      </section>
    </>
  );
}

function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 400 360" role="img" aria-label="Illustration of a sun, a house and children playing">
      <circle cx="300" cy="80" r="46" fill="#fdba74" />
      <circle cx="300" cy="80" r="32" fill="#f97316" />
      <path d="M20 300 Q200 220 380 300 L380 360 L20 360 Z" fill="#ffedd5" />
      <rect x="70" y="170" width="140" height="120" rx="10" fill="#fff" stroke="#f97316" strokeWidth="6" />
      <path d="M55 180 L140 105 L225 180" fill="none" stroke="#ea580c" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" />
      <rect x="120" y="225" width="40" height="65" rx="6" fill="#fed7aa" />
      <rect x="88" y="195" width="28" height="24" rx="4" fill="#fed7aa" />
      <rect x="164" y="195" width="28" height="24" rx="4" fill="#fed7aa" />
      <g>
        <circle cx="270" cy="215" r="14" fill="#fb923c" />
        <path d="M270 230 L270 265 M270 240 L252 255 M270 240 L292 228 M270 265 L258 290 M270 265 L284 290" stroke="#1f2937" strokeWidth="6" strokeLinecap="round" />
      </g>
      <g>
        <circle cx="330" cy="230" r="12" fill="#fdba74" />
        <path d="M330 243 L330 272 M330 252 L314 240 M330 252 L346 262 M330 272 L320 293 M330 272 L340 293" stroke="#1f2937" strokeWidth="6" strokeLinecap="round" />
      </g>
      <circle cx="300" cy="300" r="12" fill="#f97316" />
    </svg>
  );
}
