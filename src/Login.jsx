import { useState } from "react";
import { useApp } from "./store.js";
import { Icon } from "./icons.jsx";

export function Login() {
  const { signIn } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);

  function submit(e) {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      signIn(remember, email.trim());
    }, 650);
  }

  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="login-showcase-inner">
          <Brand light />
          <div className="login-message">
            <span className="kicker light">
              <i className="dot pulse" />
              Environmental intelligence, always on
            </span>
            <h1>
              Clarity for every
              <br />
              degree of change.
            </h1>
            <p>
              Monitor temperature and humidity in real time, identify environmental risks, and keep your
              connected spaces performing at their best.
            </p>
          </div>
          <div className="login-preview">
            <div className="preview-top">
              <div>
                <span>Live environment</span>
                <strong>No station connected</strong>
              </div>
              <span className="pill on-dark">Waiting</span>
            </div>
            <div className="preview-metrics">
              <div>
                <span className="mini-icon orange">
                  <Icon name="thermo" size={18} />
                </span>
                <div>
                  <small>Temperature</small>
                  <strong>—</strong>
                </div>
              </div>
              <div>
                <span className="mini-icon blue">
                  <Icon name="drop" size={18} />
                </span>
                <div>
                  <small>Humidity</small>
                  <strong>—</strong>
                </div>
              </div>
            </div>
            <p className="preview-empty">Readings appear here after a sensor reports in.</p>
          </div>
          <div className="login-proof">
            <span>
              <Icon name="check" size={14} /> Real-time monitoring
            </span>
            <span>
              <Icon name="check" size={14} /> Smart alerts
            </span>
            <span>
              <Icon name="check" size={14} /> Predictive insights
            </span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <form className="login-form" onSubmit={submit}>
          <div className="login-heading">
            <span>Welcome back</span>
            <h2>Sign in to your account</h2>
            <p>Enter your details to access the monitoring dashboard.</p>
          </div>
          <label className="field">
            <span>Email address</span>
            <div>
              <Icon name="user" size={18} />
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>
          <label className="field">
            <span>Password</span>
            <div>
              <Icon name="gear" size={18} />
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="ghost-inline" onClick={() => setShow((v) => !v)}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="login-options">
            <label className="check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <i />
              <span>Keep me signed in</span>
            </label>
            <button type="button" className="link" onClick={() => { setForgot(true); setSent(false); }}>
              Forgot password?
            </button>
          </div>
          <button className="btn primary wide" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            {!busy && <Icon name="chevron" size={17} />}
          </button>
        </form>
        <div className="login-footer">
          <span>© 2026 TEMPTRACK IoT</span>
          <span>Privacy · Support</span>
        </div>
      </section>

      {forgot && (
        <div className="modal-scrim" onClick={() => setForgot(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="reset-title">
            <h3 id="reset-title">Reset your password</h3>
            <p>We’ll prepare a reset note for the address on this form. This demo does not send email.</p>
            {sent ? (
              <p className="success-copy">Reset instructions are ready for {email || "your email"}.</p>
            ) : (
              <label className="field">
                <span>Email address</span>
                <div>
                  <Icon name="mail" size={18} />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                </div>
              </label>
            )}
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => setForgot(false)}>
                Close
              </button>
              {!sent && (
                <button className="btn primary" type="button" onClick={() => setSent(true)}>
                  Send reset link
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export function Brand({ light = false }) {
  return (
    <div className={`brand ${light ? "on-dark" : ""}`}>
      <div className="brand-mark">
        <Icon name="thermo" size={22} />
        <i />
      </div>
      <div>
        <strong>TEMPTRACK</strong>
        <span>IoT PLATFORM</span>
      </div>
    </div>
  );
}
