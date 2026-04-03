import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface AuthUser {
  name: string;
  email: string;
  avatar?: string;
  provider: "google" | "apple" | "demo";
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signInWithGoogle: () => void;
  signInWithApple: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "rs_auth_user";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID ?? "";
const REDIRECT_URI = typeof window !== "undefined" ? `${window.location.origin}${import.meta.env.BASE_URL}` : "";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          prompt: () => void;
        };
        oauth2: {
          initCodeClient: (cfg: object) => { requestCode: () => void };
        };
      };
    };
    AppleID?: {
      auth: {
        init: (cfg: object) => void;
        signIn: () => Promise<{ authorization: { id_token: string } }>;
      };
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIsLoading(false);
  }, []);

  const persistUser = useCallback((u: AuthUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const signInWithGoogle = useCallback(() => {
    if (GOOGLE_CLIENT_ID) {
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "token",
        scope: "openid email profile",
        state: "google_oauth",
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } else {
      persistUser({
        name: "Demo Manager",
        email: "manager@restosmart.app",
        provider: "demo",
      });
    }
  }, [persistUser]);

  const signInWithApple = useCallback(async () => {
    if (APPLE_CLIENT_ID && window.AppleID) {
      try {
        window.AppleID.auth.init({
          clientId: APPLE_CLIENT_ID,
          scope: "name email",
          redirectURI: REDIRECT_URI,
          usePopup: true,
        });
        const response = await window.AppleID.auth.signIn();
        if (response?.authorization?.id_token) {
          persistUser({
            name: "Apple-Nutzer",
            email: "",
            provider: "apple",
          });
        }
      } catch {
        /* cancelled */
      }
    } else {
      persistUser({
        name: "Demo Manager",
        email: "manager@restosmart.app",
        provider: "demo",
      });
    }
  }, [persistUser]);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signInWithGoogle, signInWithApple, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
