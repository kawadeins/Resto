/**
 * PlanDetail — shareable group plan view.
 * Accessed via /plan/:id — public, no auth required.
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import {
  CalendarDays, Clock, Users, MapPin, Share2, Link2, CheckCircle,
  ArrowLeft, UtensilsCrossed, Bell,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const API = ((import.meta.env.VITE_API_URL as string | undefined) ?? "") + "/api";

const FOOD_THEME_LABELS: Record<string, { emoji: string; label: string }> = {
  burger:   { emoji: "🍔", label: "Burger" },
  pizza:    { emoji: "🍕", label: "Pizza" },
  sushi:    { emoji: "🍣", label: "Sushi" },
  meat:     { emoji: "🥩", label: "Grill & Fleisch" },
  fish:     { emoji: "🐟", label: "Fisch" },
  pasta:    { emoji: "🍝", label: "Pasta" },
  vegan:    { emoji: "🌱", label: "Vegan" },
  asian:    { emoji: "🍜", label: "Asiatisch" },
  oriental: { emoji: "🥙", label: "Orientalisch" },
  mexican:  { emoji: "🌮", label: "Mexikanisch" },
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("de-AT", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function PlanDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API}/meal-plan/group/plan/${id}`)
      .then(r => { if (!r.ok) throw new Error("not found"); return r.json(); })
      .then(data => { setPlan(data); setLoading(false); })
      .catch(() => { setError("Plan nicht gefunden oder nicht mehr verfügbar."); setLoading(false); });
  }, [id]);

  const shareUrl = window.location.href;

  const handleShare = async () => {
    const text = plan
      ? `Hey! Unser Gruppenplan 🍽️\n\n${plan.restaurant ? `📍 ${plan.restaurant.name}\n🗺️ ${plan.restaurant.address}\n` : ""}📅 ${formatDate(plan.date)} um ${plan.time} Uhr\n👥 ${plan.groupSize} Personen\n\n${shareUrl}`
      : shareUrl;
    try {
      if (navigator.share && navigator.canShare?.({ url: shareUrl })) {
        await navigator.share({ title: plan?.title ?? "Gruppenplan", text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const theme = plan ? (FOOD_THEME_LABELS[plan.foodTheme] ?? { emoji: "🍽️", label: plan.foodTheme }) : null;
  const participants: any[] = Array.isArray(plan?.participants) ? plan.participants : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <Link href="/meal-plan" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Zum Essensplan
        </Link>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-md">

          {loading && (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent animate-pulse mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Plan wird geladen…</p>
            </div>
          )}

          {error && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <UtensilsCrossed className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="font-bold text-lg mb-2">Plan nicht gefunden</h2>
              <p className="text-sm text-muted-foreground mb-6">{error}</p>
              <Link href="/" className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-2xl hover:opacity-90 transition-opacity text-sm">
                Zur Startseite
              </Link>
            </div>
          )}

          {plan && !loading && !error && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="space-y-4"
              >
                {/* Hero card */}
                <div className="rounded-3xl bg-card border border-border/60 shadow-xl shadow-black/8 overflow-hidden">
                  {/* Color bar */}
                  <div className="h-2 bg-gradient-to-r from-primary to-accent" />

                  <div className="p-6">
                    {/* Category badge + title */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center text-3xl shadow-sm">
                        {theme?.emoji}
                      </div>
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{theme?.label}</p>
                        <h1 className="font-extrabold text-xl leading-tight">{plan.title}</h1>
                        <p className="text-xs text-muted-foreground">Organisiert von {plan.organizerName || "jemandem"}</p>
                      </div>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex items-start gap-2.5 bg-muted/40 rounded-2xl p-3">
                        <CalendarDays className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Datum</p>
                          <p className="text-xs font-semibold leading-tight mt-0.5">{formatDate(plan.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 bg-muted/40 rounded-2xl p-3">
                        <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Uhrzeit</p>
                          <p className="text-xs font-semibold mt-0.5">{plan.time} Uhr</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 bg-muted/40 rounded-2xl p-3">
                        <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gruppe</p>
                          <p className="text-xs font-semibold mt-0.5">{plan.groupSize} Personen</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 bg-muted/40 rounded-2xl p-3">
                        <Bell className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Erinnerung</p>
                          <p className="text-xs font-semibold mt-0.5">
                            {plan.reminderTiming === "1_hour_before" ? "1h vorher"
                              : plan.reminderTiming === "1_day_before" ? "1 Tag vorher"
                              : "Beides"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Restaurant */}
                    {plan.restaurant && (
                      <div className="flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-2xl p-3.5 mb-4">
                        <MapPin className="w-4.5 h-4.5 text-primary mt-0.5 shrink-0" style={{ width: 18, height: 18 }} />
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary mb-0.5">Treffpunkt</p>
                          <p className="text-sm font-bold text-foreground">{plan.restaurant.name}</p>
                          <p className="text-xs text-muted-foreground">{plan.restaurant.address}</p>
                        </div>
                      </div>
                    )}

                    {/* Participants */}
                    {participants.length > 0 && (
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2">Teilnehmer</p>
                        <div className="flex flex-wrap gap-1.5">
                          {participants.map((p: any, i: number) => (
                            <div key={i} className="flex items-center gap-1.5 bg-muted/50 border border-border/60 rounded-full px-3 py-1">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                {(p.name || "?")[0].toUpperCase()}
                              </div>
                              <span className="text-xs font-semibold">{p.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Share + Join CTA */}
                <div className="space-y-2.5">
                  <button
                    onClick={handleShare}
                    className="w-full h-13 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    style={{ height: 52 }}
                  >
                    {copied
                      ? <><CheckCircle className="w-4 h-4" /> Link kopiert!</>
                      : <><Share2 className="w-4 h-4" /> Plan teilen</>
                    }
                  </button>
                  <Link href="/meal-plan" className="w-full h-13 rounded-2xl border border-border font-bold text-sm hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 text-foreground" style={{ height: 52 }}>
                    <UtensilsCrossed className="w-4 h-4" /> Meinen Plan öffnen
                  </Link>
                </div>

                {/* Branding */}
                <p className="text-center text-xs text-muted-foreground pt-2">
                  Geteilt via <span className="font-bold text-primary">RestoSmart</span> Wien
                </p>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
