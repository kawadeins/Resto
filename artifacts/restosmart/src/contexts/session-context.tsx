/**
 * SessionContext — server-side session integration.
 *
 * On mount, fetches GET /api/auth/session to determine whether a valid
 * server session exists. If authenticated, the user email is also written
 * to localStorage under `restosmart_owner_email` so that existing components
 * that read that key continue to work without modification.
 *
 * Login / logout actions talk to /api/auth/* endpoints and keep the
 * React context and localStorage in sync.
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

interface SessionContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => ({ success: false }),
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

  const login = useCallback(
    async (email: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json() as SessionUser & { error?: string };
        if (!res.ok) {
          return { success: false, error: data.error ?? "Login fehlgeschlagen" };
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
        login,
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
