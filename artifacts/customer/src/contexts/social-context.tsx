/**
 * SocialContext — provides social cues (friends-who-visited) to the whole app
 * without prop drilling. Fetched once per session when user email is known.
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getSocialCues, type SocialCue } from "@/lib/social-api";

interface SocialContextValue {
  cues: Record<string, SocialCue>;    // restaurantId → { count, names }
  refresh: () => void;
  friendCount: number;
  setFriendCount: (n: number) => void;
}

const SocialContext = createContext<SocialContextValue>({
  cues: {},
  refresh: () => {},
  friendCount: 0,
  setFriendCount: () => {},
});

export function SocialProvider({ email, children }: { email: string; children: ReactNode }) {
  const [cues, setCues] = useState<Record<string, SocialCue>>({});
  const [friendCount, setFriendCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!email) return;
    try {
      const data = await getSocialCues(email);
      setCues(data);
    } catch {}
  }, [email]);

  useEffect(() => {
    if (email) refresh();
  }, [email, refresh]);

  return (
    <SocialContext.Provider value={{ cues, refresh, friendCount, setFriendCount }}>
      {children}
    </SocialContext.Provider>
  );
}

export function useSocialCues() {
  return useContext(SocialContext);
}
