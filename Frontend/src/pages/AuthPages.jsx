import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ArrowRight, ShieldCheck, KeyRound, Mail, User, AlertCircle, CheckCircle, FolderKanban, ClipboardCheck, Users, LockKeyhole } from 'lucide-react';
import { authApi } from '../services/api';

export function AuthPages() {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup' | 'verify' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devTokenNotice, setDevTokenNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const { login, signup, verifyEmail, error } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('reset_token')) {
      setResetToken(params.get('reset_token') || '');
      setAuthMode('reset');
    } else if (params.has('verify_token')) {
      setVerificationToken(params.get('verify_token') || '');
      setAuthMode('verify');
    }
  }, []);

  // Quick Demo Login helpers
  async function handleDemoLogin(demoEmail) {
    setLoading(true);
    setStatusMessage(null);
    try {
      await login(demoEmail, 'Password123!');
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);
    try {
      await login(email, password);
    } catch (err) {
      if (err.data?.code === 'EMAIL_NOT_VERIFIED') {
        setStatusMessage({
          type: 'warning',
          text: 'Account email is not verified yet. Please enter your verification token below.',
        });
        setAuthMode('verify');
      } else {
        setStatusMessage({ type: 'error', text: err.message });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await signup(name, email, password);
      setStatusMessage({
        type: 'success',
        text: res.data?.emailDeliveryProblem ? 'Account created, but email delivery failed. Use the resend option below.' : 'Account created. Check your email for a verification link.',
      });
      if (res.data?.devVerificationToken) {
        setDevTokenNotice(res.data.devVerificationToken);
        setVerificationToken(res.data.devVerificationToken);
      }
      setAuthMode('verify');
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifySubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);
    try {
      await verifyEmail(verificationToken);
      setStatusMessage({
        type: 'success',
        text: 'Email verified successfully! You may now sign in.',
      });
      setAuthMode('login');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <div className="brand-mark" aria-hidden="true"><span>c</span><span className="brand-dot">.</span></div>
          <div className="auth-brand-name">creator<span>desk</span></div>
        </div>
        <div className="auth-intro">
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR CREATIVE WORKSPACE</div>
          <h1>Welcome back.</h1>
          <p>Sign in to manage campaigns, collaborate on creative, and keep production moving.</p>
        </div>

        {import.meta.env.DEV && (
        <>
        {/* Demo Fast Login Buttons */}
        <div className="auth-demo-card">
          <div className="auth-demo-card-title">
            <ShieldCheck size={14} /> Development demo accounts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            <button
              id="btn-demo-producer"
              className="btn btn-secondary btn-sm"
              onClick={() => handleDemoLogin('producer@demo.com')}
              disabled={loading}
              style={{ fontSize: '0.75rem', padding: '0.4rem' }}
            >
              Producer
            </button>
            <button
              id="btn-demo-editor"
              className="btn btn-secondary btn-sm"
              onClick={() => handleDemoLogin('editor@demo.com')}
              disabled={loading}
              style={{ fontSize: '0.75rem', padding: '0.4rem' }}
            >
              Editor
            </button>
            <button
              id="btn-demo-reviewer"
              className="btn btn-secondary btn-sm"
              onClick={() => handleDemoLogin('reviewer@demo.com')}
              disabled={loading}
              style={{ fontSize: '0.75rem', padding: '0.4rem' }}
            >
              Reviewer
            </button>
          </div>
        </div>
        </>
        )}

        {/* Status Alerts */}
        {statusMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              background: statusMessage.type === 'error' ? 'var(--color-danger-bg)' : statusMessage.type === 'warning' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
              color: statusMessage.type === 'error' ? 'var(--color-danger)' : statusMessage.type === 'warning' ? 'var(--color-warning)' : 'var(--color-success)',
              border: `1px solid ${statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            }}
          >
            {statusMessage.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Main Card */}
        <div className="glass-card">
          {/* LOGIN VIEW */}
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit}>
              <h3 style={{ marginBottom: '1.25rem' }}>Sign In to Workspace</h3>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="input-login-email"
                    type="email"
                    className="form-control"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={() => setAuthMode('forgot')}
                    style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="input-login-password"
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button id="btn-submit-login" type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
                {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight size={16} />
              </button>

              <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Create one now
                </button>
              </div>
            </form>
          )}

          {/* SIGNUP VIEW */}
          {authMode === 'signup' && (
            <form onSubmit={handleSignupSubmit}>
              <h3 style={{ marginBottom: '1.25rem' }}>Create Account</h3>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  id="input-signup-name"
                  type="text"
                  className="form-control"
                  placeholder="Alex Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  id="input-signup-email"
                  type="email"
                  className="form-control"
                  placeholder="alex@producer.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  id="input-signup-password"
                  type="password"
                  className="form-control"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <button id="btn-submit-signup" type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
                {loading ? 'Creating Account...' : 'Register'} <ArrowRight size={16} />
              </button>

              <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: '600', cursor: 'pointer' }}
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* VERIFY EMAIL VIEW */}
          {authMode === 'verify' && (
            <form onSubmit={handleVerifySubmit}>
              <h3 style={{ marginBottom: '0.75rem' }}>Verify Your Email</h3>
              <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Enter the verification token sent to your email to activate normal application access.
              </p>

              {devTokenNotice && (
                <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px dashed var(--brand-primary)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.75rem' }}>
                  <strong>Development Helper Token:</strong> <code style={{ wordBreak: 'break-all' }}>{devTokenNotice}</code>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Verification Token</label>
                <input
                  id="input-verify-token"
                  type="text"
                  className="form-control"
                  placeholder="Paste token here"
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value)}
                  required
                />
              </div>

              <button id="btn-submit-verify" type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Email & Continue'}
              </button>

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <label className="form-label" htmlFor="input-resend-email">Didn't receive the verification email?</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input id="input-resend-email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" required />
                  <button type="button" className="btn btn-secondary" disabled={loading || !email.includes('@')} onClick={async () => {
                    setLoading(true);
                    try {
                      const response = await authApi.resendVerification({ email });
                      if (response.data?.devVerificationToken) {
                        setDevTokenNotice(response.data.devVerificationToken);
                        setVerificationToken(response.data.devVerificationToken);
                      }
                      setStatusMessage({ type: 'success', text: response.message });
                    } catch (error) { setStatusMessage({ type: 'error', text: error.message }); }
                    finally { setLoading(false); }
                  }}>Resend</button>
                </div>
              </div>
              <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer' }}
                >
                  Return to Sign In
                </button>
              </div>
            </form>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {authMode === 'forgot' && (
            <div>
              <h3 style={{ marginBottom: '0.75rem' }}>Password Recovery</h3>
              <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Enter your registered email address to receive a secure, single-use password reset token.
              </p>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  id="input-forgot-email"
                  type="email"
                  className="form-control"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button
                id="btn-submit-forgot"
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await authApi.forgotPassword({ email });
                    setStatusMessage({ type: 'success', text: res.message });
                    if (res.data?.devResetToken) setResetToken(res.data.devResetToken);
                    setAuthMode('reset');
                  } catch (err) {
                    setStatusMessage({ type: 'error', text: err.message });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Send Reset Link
              </button>

              <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer' }}
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          )}

          {/* RESET PASSWORD VIEW */}
          {authMode === 'reset' && (
            <div>
              <h3 style={{ marginBottom: '0.75rem' }}>Set New Password</h3>
              <div className="form-group">
                <label className="form-label">Reset Token</label>
                <input
                  type="text"
                  className="form-control"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await authApi.resetPassword({ token: resetToken, newPassword });
                    setStatusMessage({ type: 'success', text: res.message });
                    setAuthMode('login');
                    window.history.replaceState({}, '', window.location.pathname);
                  } catch (err) {
                    setStatusMessage({ type: 'error', text: err.message });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Reset Password
              </button>
            </div>
          )}
        </div>
      </div>
      <aside className="auth-side" aria-label="About Creator Desk">
        <div className="auth-side-overline">CREATIVE OPERATIONS, SIMPLIFIED</div>
        <div>
          <h2 className="auth-side-title">Great work takes a <em>great workflow.</em></h2>
          <p className="auth-side-description">From the first brief to the final sign-off, give every campaign a clear path forward.</p>
          <div className="auth-feature-list">
            <div className="auth-feature"><FolderKanban size={22} /> All campaign work in one place</div>
            <div className="auth-feature"><ClipboardCheck size={22} /> Reviews and approvals without the chaos</div>
            <div className="auth-feature"><Users size={22} /> Collaboration with the right permissions</div>
            <div className="auth-feature"><LockKeyhole size={22} /> Private briefs and protected assets</div>
          </div>
        </div>
        <div className="auth-side-foot">Creator Desk · Your production, more organized.</div>
      </aside>
    </div>
  );
}
