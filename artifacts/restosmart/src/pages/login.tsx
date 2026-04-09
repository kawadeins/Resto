/**
 * Login page — two-step OTP login.
 *
 * Step 1: Enter business email → API validates against DB, sends 6-digit code
 * Step 2: Enter the 6-digit code → API validates, creates server session
 *
 * In development (no RESEND_API_KEY configured), the code is displayed
 * directly in the UI so developers can test without email delivery.
 */

import { useState } from "react";
import { useSession } from "@/contexts/session-context";

type Step = "email" | "otp";

export default function Login() {
  const { requestOtp, verifyOtp } = useSession();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    // On success, SessionContext updates and App re-renders with AuthenticatedApp
  }

  function handleBack() {
    setStep("email");
    setCode("");
    setDevCode(null);
    setError(null);
  }

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

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: "none",
    background: disabled
      ? "rgba(139,92,246,0.3)"
      : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    color: disabled ? "#6b7280" : "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.15s",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>

        {/* Logo + title */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 24,
              color: "#fff",
              fontWeight: 700,
            }}
          >
            R
          </div>
          <h1 style={{ color: "#f9fafb", fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>
            RestoSmart
          </h1>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
            {step === "email"
              ? "Anmelden mit Ihrer Geschäfts-E-Mail"
              : "Einmalcode eingeben"}
          </p>
        </div>

        {/* ── Step 1: Email ── */}
        {step === "email" && (
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
                autoFocus
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "rgba(139,92,246,0.6)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
              />
            </div>

            {error && <ErrorBox message={error} />}

            <button type="submit" disabled={loading || !email} style={btnStyle(loading || !email)}>
              {loading ? "Wird geprüft …" : "Code anfordern"}
            </button>
          </form>
        )}

        {/* ── Step 2: OTP code ── */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp}>
            <div
              style={{
                background: "rgba(139,92,246,0.08)",
                border: "1px solid rgba(139,92,246,0.25)",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 20,
                fontSize: 13,
                color: "#a78bfa",
              }}
            >
              Ein 6-stelliger Code wurde an <strong>{email}</strong> gesendet.
              Er ist 10 Minuten gültig.
            </div>

            {/* Dev-mode code hint */}
            {devCode && (
              <div
                style={{
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.35)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#fbbf24",
                }}
              >
                <strong>Entwicklungsmodus</strong> — kein E-Mail-Versand konfiguriert.
                <br />
                Ihr Code:{" "}
                <strong
                  style={{
                    letterSpacing: 4,
                    fontSize: 20,
                    display: "inline-block",
                    marginTop: 4,
                    color: "#fcd34d",
                  }}
                >
                  {devCode}
                </strong>
              </div>
            )}

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
                style={{ ...inputStyle, letterSpacing: 8, fontSize: 22, textAlign: "center" }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(139,92,246,0.6)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
              />
            </div>

            {error && <ErrorBox message={error} />}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              style={btnStyle(loading || code.length !== 6)}
            >
              {loading ? "Wird geprüft …" : "Anmelden"}
            </button>

            <button
              type="button"
              onClick={handleBack}
              style={{
                width: "100%",
                marginTop: 10,
                padding: "10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "#6b7280",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {"← Zurück"}
            </button>
          </form>
        )}

        <p
          style={{
            color: "#374151",
            fontSize: 12,
            textAlign: "center",
            marginTop: 24,
            lineHeight: 1.5,
          }}
        >
          Nur registrierte Inhaber und Teammitglieder
          <br />
          haben Zugang zum Dashboard.
        </p>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: 8,
        padding: "10px 14px",
        color: "#f87171",
        fontSize: 13,
        marginBottom: 16,
      }}
    >
      {message}
    </div>
  );
}
