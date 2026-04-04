/**
 * Friends page — manage friendships, view incoming requests, send invites.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Users } from "lucide-react";
import { useSeo } from "@/hooks/use-seo";
import { FriendsPanel } from "@/components/friends-panel";
import { ActivityFeedSection } from "@/components/activity-feed-section";

export default function FriendsPage() {
  useSeo({ title: "Freunde – RestoSmart" });

  const [email, setEmail] = useState("");
  const [friendCount, setFriendCount] = useState(0);

  useEffect(() => {
    const sync = () => setEmail(localStorage.getItem("restosmart_email") ?? "");
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  if (!email) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-4xl mb-6">
          👥
        </div>
        <h1 className="text-2xl font-extrabold mb-3">Freunde</h1>
        <p className="text-muted-foreground max-w-xs mb-6">
          Melde dich an, um Freunde hinzuzufügen und deren Aktivitäten zu sehen.
        </p>
        <Link href="/profile" className="bg-primary text-white font-bold px-6 py-3 rounded-2xl shadow-lg">
          Anmelden
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">

      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-violet-600 to-accent pt-safe">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />
        <div className="container mx-auto max-w-4xl px-4 pt-4 pb-10 relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-semibold">Zurück</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-3xl shadow-xl">
              👥
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Meine Freunde</h1>
              <p className="text-white/70 text-sm mt-0.5">
                {friendCount > 0
                  ? `${friendCount} ${friendCount === 1 ? "Freund" : "Freunde"} verbunden`
                  : "Lade Freunde ein und entdeckt gemeinsam"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto max-w-4xl px-4 -mt-6 relative z-10 space-y-6">
        <FriendsPanel email={email} onFriendCountChange={setFriendCount} />
      </div>

      {/* Activity feed */}
      {friendCount > 0 && (
        <div className="mt-8">
          <ActivityFeedSection email={email} friendCount={friendCount} />
        </div>
      )}
    </div>
  );
}
