/**
 * Login page — shown when no valid server session exists.
 *
 * The user enters their business email. The API validates it against
 * the restaurant owner / team_members table and returns a signed session
 * cookie. No passwords are used; team members are invited by the owner
 * and their emails are stored in the database.
 */

import { useState } from "react";
import { useSession } from "@/contexts/session-context";

export default function Login() {
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await login(email.trim().toLowerCase());
    if (!result.success) {
      setError(result.error ?? "Login fehlgeschlagen");
    }
    setLoading(false);
  }

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
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "0 24px",
        }}
      >
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
            }}
          >
            R
          </div>
          <h1
            style={{
              color: "#f9fafb",
              fontSize: 24,
              fontWeight: 700,
              margin: "0 0 6px",
            }}
          >
            RestoSmart
          </h1>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
            Anmelden mit Ihrer Geschäfts-E-Mail
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                color: "#9ca3af",
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 6,
              }}
            >
              E-Mail-Adresse
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ihre@email.at"
              required
              autoFocus
              style={{
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
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "rgba(139,92,246,0.6)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(255,255,255,0.1)";
              }}
            />
          </div>

          {error && (
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
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 10,
              border: "none",
              background:
                loading || !email
                  ? "rgba(139,92,246,0.3)"
                  : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
              color: loading || !email ? "#6b7280" : "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading || !email ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {loading ? "Wird angemeldet …" : "Anmelden"}
          </button>
        </form>

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
