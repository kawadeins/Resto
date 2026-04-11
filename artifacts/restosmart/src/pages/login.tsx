/**
 * Login page — business dashboard sign-in.
 *
 * Primary:  Google Sign-In / Apple Sign-In (when configured)
 * Fallback: Two-step OTP (always available)
 *
 * Social buttons navigate to /api/auth/google or /api/auth/apple.
 * The server handles the full OAuth round-trip and redirects back here
 * with the session already established.
 *
 * OAuth errors come back as ?login_error= query params.
 */

import { useState, useEffect } from "react";
import { useSession } from "@/contexts/session-context";
import { RestoLogo } from "@/components/resto-logo";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type Step = "email" | "otp";

type OAuthProviders = { google: boolean; apple: boolean };

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  no_account: "Dieses Konto hat keinen Zugriff auf das Business-Dashboard.",
  auth_failed: "Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
  cancelled: "Anmeldung abgebrochen.",
  no_email: "Keine E-Mail-Adresse erhalten. Bitte mit E-Mail anmelden.",
  invalid: "Ungültige Sitzung. Bitte versuche es erneut.",
};

export default function Login() {
  const { requestOtp, verifyOtp } = useSession();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [providers, setProviders] = useState<OAuthProviders>({ google: false, apple: false });
  const [showOtp, setShowOtp] = useState(false);

  // Fetch which social providers are configured
  useEffect(() => {
    fetch(`${API_BASE}/api/auth/providers`)
      .then((r) => r.json())
      .then((data: OAuthProviders) => setProviders(data))
      .catch(() => {});
  }, []);

  // Handle OAuth error redirects (?login_error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginError = params.get("login_error");
    const provider = params.get("provider");
    if (loginError) {
      const msg = OAUTH_ERROR_MESSAGES[loginError] ?? "Anmeldung fehlgeschlagen.";
      const providerName = provider === "google" ? " (Google)" : provider === "apple" ? " (Apple)" : "";
      setError(msg + providerName);
      // Clean up URL so refresh doesn't re-trigger the error
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const hasSocial = providers.google || providers.apple;

  async function handleGoogleSignIn() {
    setOauthLoading("google");
    setError(null);
    window.location.href = `${API_BASE}/api/auth/google`;
  }

  async function handleAppleSignIn() {
    setOauthLoading("apple");
    setError(null);
    window.location.href = `${API_BASE}/api/auth/apple`;
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await requestOtp(email.trim().toLowerCase());
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Anfrage fehlgeschlagen");
      return;
    }

    setDevCode(result.devCode ?? null);
    setStep("otp");
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await verifyOtp(email.trim().toLowerCase(), code.trim());
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Anmeldung fehlgeschlagen");
    }
  }

  function handleBack() {
    setStep("email");
    setCode("");
    setDevCode(null);
    setError(null);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* ── Logo + Branding ── */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <RestoLogo size="lg" inverted />
          </div>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
            {step === "otp" ? "Einmalcode eingeben" : "Zum Business-Dashboard anmelden"}
          </p>
        </div>

        {/* ── OTP Step 2 ── */}
        {step === "otp" ? (
          <div>
            <div style={{
              background: "rgba(139,92,246,0.08)",
              border: "1px solid rgba(139,92,246,0.25)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 20,
              fontSize: 13,
              color: "#a78bfa",
            }}>
              Code an <strong>{email}</strong> gesendet — 10 Minuten gültig.
            </div>

            {devCode && (
              <div style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 16,
                fontSize: 13,
                color: "#fbbf24",
              }}>
                <strong>Entwicklungsmodus</strong>
                <br />
                Ihr Code:{" "}
                <strong style={{ letterSpacing: 4, fontSize: 20, display: "inline-block", marginTop: 4, color: "#fcd34d" }}>
                  {devCode}
                </strong>
              </div>
            )}

            {error && <ErrorBox message={error} />}

            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", color: "#9ca3af", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Einmalcode (6 Stellen)
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(v);
                  }}
                  placeholder="123456"
                  required
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  style={{
                    ...inputStyle,
                    letterSpacing: 8,
                    fontSize: 22,
                    textAlign: "center",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(139,92,246,0.6)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                />
              </div>

              <button type="submit" disabled={loading || code.length !== 6} style={btnStyle("primary", loading || code.length !== 6)}>
                {loading ? "Wird geprüft …" : "Anmelden"}
              </button>
            </form>

            <button
              type="button"
              onClick={handleBack}
              style={{
                width: "100%",
                marginTop: 10,
                padding: "11px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "transparent",
                color: "#6b7280",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {"← Zurück"}
            </button>
          </div>
        ) : (
          <div>
            {/* ── Error from OAuth redirect ── */}
            {error && <ErrorBox message={error} onClose={() => setError(null)} />}

            {/* ── Social sign-in buttons ── */}
            {hasSocial && (
              <div style={{ marginBottom: 20 }}>
                {providers.google && (
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={!!oauthLoading}
                    style={{
                      ...socialBtnStyle("#fff"),
                      color: "#1f2937",
                      marginBottom: 10,
                    }}
                  >
                    {oauthLoading === "google" ? (
                      <span style={{ color: "#6b7280" }}>Weiterleitung …</span>
                    ) : (
                      <>
                        <GoogleIcon />
                        <span>Mit Google fortfahren</span>
                      </>
                    )}
                  </button>
                )}

                {providers.apple && (
                  <button
                    type="button"
                    onClick={handleAppleSignIn}
                    disabled={!!oauthLoading}
                    style={{
                      ...socialBtnStyle("#111"),
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    {oauthLoading === "apple" ? (
                      <span style={{ color: "#9ca3af" }}>Weiterleitung …</span>
                    ) : (
                      <>
                        <AppleIcon />
                        <span>Mit Apple fortfahren</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* ── Divider ── */}
            {hasSocial && !showOtp ? (
              <div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                  <span style={{ color: "#4b5563", fontSize: 12 }}>oder</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                </div>

                <button
                  type="button"
                  onClick={() => setShowOtp(true)}
                  style={{
                    width: "100%",
                    padding: "11px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "transparent",
                    color: "#9ca3af",
                    fontSize: 14,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)"; e.currentTarget.style.color = "#c4b5fd"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#9ca3af"; }}
                >
                  Mit E-Mail anmelden
                </button>
              </div>
            ) : (
              /* ── OTP email form (always shown if no social providers, or after click) ── */
              <div>
                {hasSocial && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16,
                  }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                    <span style={{ color: "#4b5563", fontSize: 12 }}>oder mit E-Mail</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                  </div>
                )}

                <form onSubmit={handleRequestOtp}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", color: "#9ca3af", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                      E-Mail-Adresse
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ihre@email.at"
                      required
                      autoFocus={!hasSocial || showOtp}
                      style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = "rgba(139,92,246,0.6)"; }}
                      onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    style={btnStyle("primary", loading || !email)}
                  >
                    {loading ? "Wird geprüft …" : "Code anfordern"}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        <p style={{
          color: "#374151",
          fontSize: 12,
          textAlign: "center",
          marginTop: 28,
          lineHeight: 1.5,
        }}>
          Nur registrierte Inhaber und Teammitglieder
          <br />
          haben Zugang zum Business-Dashboard.
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function ErrorBox({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div style={{
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.25)",
      borderRadius: 10,
      padding: "10px 14px",
      color: "#f87171",
      fontSize: 13,
      marginBottom: 16,
      display: "flex",
      alignItems: "flex-start",
      gap: 8,
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0, fontSize: 16, lineHeight: 1 }}
        >
          {"×"}
        </button>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 814 1000" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-47.4-148.2-112.7C215.7 726.1 180 672 154.8 611c-32.4-79.3-50.8-160.1-50.8-236.3 0-166.5 112.8-259.5 221.5-259.5 70.6 0 131.6 48.3 172.3 48.3 38.3 0 106.7-51.3 184.9-51.3 30.4 0 105 4.7 156.4 77zm-123.5-259.5c30.7-36.1 52.6-86 52.6-135.9 0-6.9-.6-13.9-1.9-19.5-49.9 1.9-108.7 33.4-144.6 75.5-27.5 31.3-52.6 81.2-52.6 131.8 0 7.5 1.3 15.1 1.9 17.6 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 130.9-70.8z"/>
    </svg>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: "12px 14px",
  color: "#f9fafb",
  fontSize: 15,
  outline: "none",
  transition: "border-color 0.15s",
};

function btnStyle(variant: "primary", disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: "none",
    background: disabled
      ? "rgba(139,92,246,0.25)"
      : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    color: disabled ? "#6b7280" : "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.15s",
  };
}

function socialBtnStyle(background: string): React.CSSProperties {
  return {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "11px 16px",
    borderRadius: 10,
    border: "none",
    background,
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    transition: "opacity 0.15s",
  };
}
