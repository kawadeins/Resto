/**
 * SessionContext — server-side session integration with two-step OTP login.
 *
 * Auth flow:
 *   1. requestOtp(email) → POST /api/auth/request-otp
 *      - validates email exists in DB
 *      - generates 6-digit code (sent by email in prod, returned in devCode in dev)
 *   2. verifyOtp(email, code) → POST /api/auth/verify-otp
 *      - validates code, creates server session
 *      - returns session user on success
 *
 * On mount, fetchSession() checks GET /api/auth/session to restore an
 * existing session. The user email is also mirrored to localStorage under
 * `restosmart_owner_email` so existing components' x-user-email header
 * patterns continue to work without modification.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const LS_KEY = "restosmart_owner_email";

export interface SessionUser {
  email: string;
  role: string;
  restaurantId: number;
}

interface OtpRequestResult {
  success: boolean;
  devCode?: string;
  error?: string;
}

interface OtpVerifyResult {
  success: boolean;
  error?: string;
}

interface SessionContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requestOtp: (email: string) => Promise<OtpRequestResult>;
  verifyOtp: (email: string, code: string) => Promise<OtpVerifyResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  requestOtp: async () => ({ success: false }),
  verifyOtp: async () => ({ success: false }),
  logout: async () => {},
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncToStorage = useCallback((u: SessionUser | null) => {
    if (u) {
      localStorage.setItem(LS_KEY, u.email);
    } else {
      localStorage.removeItem(LS_KEY);
    }
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/session`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json() as SessionUser & { authenticated: boolean };
        if (data.authenticated) {
          const u: SessionUser = {
            email: data.email,
            role: data.role,
            restaurantId: data.restaurantId,
          };
          setUser(u);
          syncToStorage(u);
          return;
        }
      }
      setUser(null);
      syncToStorage(null);
    } catch {
      setUser(null);
      syncToStorage(null);
    } finally {
      setIsLoading(false);
    }
  }, [syncToStorage]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Step 1: Request OTP for the given email
  const requestOtp = useCallback(
    async (email: string): Promise<OtpRequestResult> => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json() as { sent?: boolean; devCode?: string; error?: string };
        if (!res.ok) {
          return { success: false, error: data.error ?? "Anfrage fehlgeschlagen" };
        }
        return { success: true, devCode: data.devCode };
      } catch {
        return { success: false, error: "Netzwerkfehler — bitte erneut versuchen" };
      }
    },
    [],
  );

  // Step 2: Verify OTP and create session
  const verifyOtp = useCallback(
    async (email: string, code: string): Promise<OtpVerifyResult> => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        });
        const data = await res.json() as SessionUser & { error?: string };
        if (!res.ok) {
          return { success: false, error: data.error ?? "Anmeldung fehlgeschlagen" };
        }
        const u: SessionUser = {
          email: data.email,
          role: data.role,
          restaurantId: data.restaurantId,
        };
        setUser(u);
        syncToStorage(u);
        return { success: true };
      } catch {
        return { success: false, error: "Netzwerkfehler — bitte erneut versuchen" };
      }
    },
    [syncToStorage],
  );

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setUser(null);
    syncToStorage(null);
  }, [syncToStorage]);

  return (
    <SessionContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        requestOtp,
        verifyOtp,
        logout,
        refresh: fetchSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
