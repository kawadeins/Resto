import { useState, useEffect, useCallback } from "react";
import { getCustomerEmail, saveCustomerEmail, clearCustomerEmail } from "@/lib/storage";
import { getCustomerSession, logoutCustomer } from "@/lib/api";

interface AuthState {
  email: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    email: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const email = await getCustomerEmail();
        if (email) {
          setState({ email, isLoading: false, isAuthenticated: true });
        } else {
          setState({ email: null, isLoading: false, isAuthenticated: false });
        }
      } catch {
        setState({ email: null, isLoading: false, isAuthenticated: false });
      }
    })();
  }, []);

  const login = useCallback(async (email: string) => {
    await saveCustomerEmail(email);
    setState({ email, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    try { await logoutCustomer(); } catch {}
    await clearCustomerEmail();
    setState({ email: null, isLoading: false, isAuthenticated: false });
  }, []);

  return { ...state, login, logout };
}
