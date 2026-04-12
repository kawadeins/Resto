/**
 * GroupPlanModal — Create and share a group dining plan.
 * Triggered from the "Zusammen planen" card on the home page.
 * Mobile-first: bottom sheet on mobile, centered modal on desktop.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, ArrowRight, Share2, CheckCircle, Link2, Loader2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GroupPlanModalProps {
  open: boolean;
  onClose: () => void;
}

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "restaurant", emoji: "🍽️", label: "Restaurant" },
  { id: "cafe",       emoji: "☕",  label: "Café" },
  { id: "bar",        emoji: "🍸",  label: "Bar" },
  { id: "brunch",     emoji: "🥂",  label: "Brunch" },
  { id: "date",       emoji: "❤️",  label: "Date Night" },
  { id: "pizza",      emoji: "🍕",  label: "Pizza" },
];

// ─── Share fallback sheet ──────────────────────────────────────────────────────

function ShareFallback({ url, onDone }: { url: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareOptions = [
    {
      label: "WhatsApp",
      icon: "💬",
      cls: "bg-[#25D366]/10 text-[#128C7E] border-[#25D366]/30 hover:bg-[#25D366]/20",
      href: `https://wa.me/?text=${encodeURIComponent(`Gruppenplan 🍽️ Lass uns zusammen gehen! ${url}`)}`,
    },
    {
      label: "E-Mail",
      icon: "✉️",
      cls: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20",
      href: `mailto:?subject=${encodeURIComponent("Gruppenplan 🍽️")}&body=${encodeURIComponent(`Hey! Lass uns zusammen essen gehen 🍔\n\nHier ist unser Plan:\n${url}`)}`,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Teile den Plan mit deinen Freunden — sie können direkt antworten.
      </p>
      <div className="flex flex-col gap-2.5">
        {shareOptions.map(o => (
          <a
            key={o.label}
            href={o.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 p-3.5 rounded-2xl border font-semibold text-sm transition-all ${o.cls}`}
          >
            <span className="text-xl leading-none">{o.icon}</span>
            <span>{o.label}</span>
            <ArrowRight className="w-4 h-4 ml-auto opacity-50" />
          </a>
        ))}
        <button
          onClick={copy}
          className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-muted/40 font-semibold text-sm hover:bg-muted/70 transition-all"
        >
          {copied
            ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            : <Link2 className="w-5 h-5 text-muted-foreground shrink-0" />
          }
          <span className={copied ? "text-emerald-600" : "text-foreground"}>
            {copied ? "Link kopiert!" : "Link kopieren"}
          </span>
        </button>
      </div>
      <button
        onClick={onDone}
        className="w-full text-xs text-muted-foreground py-2.5 hover:text-foreground transition-colors"
      >
        Fertig
      </button>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

type ModalStep = "form" | "share" | "success";

export function GroupPlanModal({ open, onClose }: GroupPlanModalProps) {
  const [step, setStep] = useState<ModalStep>("form");
  const [category, setCategory] = useState("restaurant");
  const [note, setNote] = useState("");
  const [sharing, setSharing] = useState(false);
  const [planUrl, setPlanUrl] = useState("");

  const reset = () => {
    setStep("form");
    setCategory("restaurant");
    setNote("");
    setSharing(false);
    setPlanUrl("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleShare = async () => {
    setSharing(true);
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const url = `${window.location.origin}/customer/plan/${id}`;
    setPlanUrl(url);

    const catLabel = CATEGORIES.find(c => c.id === category)?.label ?? "essen gehen";
    const payload = {
      title: "Gruppenplan 🍽️",
      text: `Hey! Lass uns zusammen ${catLabel} gehen 🍔${note ? `\n\n${note}` : ""}`,
      url,
    };

    try {
      if (navigator.share && navigator.canShare?.(payload)) {
        await navigator.share(payload);
        setStep("success");
      } else {
        setStep("share");
      }
    } catch {
      setStep("share");
    } finally {
      setSharing(false);
    }
  };

  const stepTitle: Record<ModalStep, string> = {
    form:    "Gruppenplan erstellen",
    share:   "Plan teilen",
    success: "Plan erstellt!",
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Sheet / modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 56, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-x-3 bottom-3 md:inset-auto md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-[420px] z-50"
          >
            <div className="rounded-3xl bg-card border border-border/60 shadow-2xl shadow-black/20 overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/25">
                    <Users className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                  </div>
                  <h2 className="font-extrabold text-base text-foreground">{stepTitle[step]}</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-5">
                <AnimatePresence mode="wait">

                  {/* Step: form */}
                  {step === "form" && (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-5"
                    >
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-3">
                          Was wollt ihr unternehmen?
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {CATEGORIES.map(c => (
                            <button
                              key={c.id}
                              onClick={() => setCategory(c.id)}
                              className={`flex flex-col items-center gap-2 py-3.5 rounded-2xl border-2 transition-all duration-150 ${
                                category === c.id
                                  ? "border-primary bg-primary/8 shadow-md shadow-primary/15"
                                  : "border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/40"
                              }`}
                            >
                              <span className="text-2xl leading-none">{c.emoji}</span>
                              <span className={`text-[11px] font-extrabold leading-none ${category === c.id ? "text-primary" : "text-muted-foreground"}`}>
                                {c.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2">
                          Nachricht (optional)
                        </p>
                        <textarea
                          placeholder="Hey, wann habt ihr Zeit? 😊"
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          rows={2}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Step: share fallback */}
                  {step === "share" && (
                    <motion.div
                      key="share"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ShareFallback url={planUrl} onDone={handleClose} />
                    </motion.div>
                  )}

                  {/* Step: success */}
                  {step === "success" && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.93 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                      className="text-center py-4"
                    >
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/25">
                        <CheckCircle className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="font-extrabold text-lg text-foreground mb-1">Plan erfolgreich geteilt!</h3>
                      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                        Deine Freunde wurden eingeladen. Sobald sie bestätigen, seid ihr startklar.
                      </p>
                      <button
                        onClick={handleClose}
                        className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-sm shadow-md shadow-primary/25 hover:opacity-90 transition-opacity"
                      >
                        Fertig
                      </button>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {/* Sticky action bar — form step only */}
              {step === "form" && (
                <div className="px-5 pb-5 flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 rounded-2xl font-bold border-border hover:bg-muted/50"
                    onClick={handleClose}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-primary to-accent text-white border-0 shadow-lg shadow-primary/25 font-bold hover:opacity-90 transition-opacity"
                    onClick={handleShare}
                    disabled={!category || sharing}
                  >
                    {sharing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Teilen…</>
                    ) : (
                      <>Plan teilen <Share2 className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
