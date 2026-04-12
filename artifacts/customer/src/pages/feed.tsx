/**
 * Public Social Feed — Premium restaurant-first social experience.
 * Instagram + Google Maps + Airbnb feel.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Heart, MessageCircle, Send, X, MapPin, Plus,
  Loader2, Bookmark, Camera, Search, Check, ChevronRight,
  ArrowLeft
} from "lucide-react";
import { useSeo } from "@/hooks/use-seo";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useXpGain } from "@/components/xp-toast";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── Inject keyframe styles once ───────────────────────────────────────────────
if (!document.getElementById("feed-styles")) {
  const s = document.createElement("style");
  s.id = "feed-styles";
  s.textContent = `
    @keyframes heartPop {
      0%  { transform: scale(1); }
      30% { transform: scale(1.55); }
      60% { transform: scale(0.88); }
      100%{ transform: scale(1); }
    }
    @keyframes floatHeart {
      0%  { opacity:1; transform:translate(-50%,-50%) scale(0.7); }
      50% { opacity:1; transform:translate(-50%,-90%) scale(1.5); }
      100%{ opacity:0; transform:translate(-50%,-150%) scale(1.1); }
    }
    @keyframes imgFadeIn {
      from { opacity:0; transform:scale(1.05); }
      to   { opacity:1; transform:scale(1); }
    }
    @keyframes bookmarkBounce {
      0%  { transform: scale(1); }
      40% { transform: scale(1.35) rotate(-10deg); }
      100%{ transform: scale(1) rotate(0); }
    }
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position: 600px 0; }
    }
    .heart-pop  { animation: heartPop 0.38s cubic-bezier(.36,.07,.19,.97) both; }
    .heart-float{
      position:absolute; pointer-events:none; font-size:3.5rem; line-height:1;
      animation: floatHeart 0.85s ease forwards; z-index:20;
    }
    .img-fade-in{ animation: imgFadeIn 0.55s ease both; }
    .bm-bounce  { animation: bookmarkBounce 0.32s cubic-bezier(.36,.07,.19,.97) both; }
    .slide-up   { animation: slideUp 0.35s cubic-bezier(.2,.8,.3,1) both; }
    .fade-in    { animation: fadeIn 0.25s ease both; }
    .shimmer-line {
      background: linear-gradient(90deg,
        hsl(var(--muted)) 25%,
        hsl(var(--muted)/0.5) 50%,
        hsl(var(--muted)) 75%);
      background-size: 600px 100%;
      animation: shimmer 1.4s infinite linear;
      border-radius: 8px;
    }
  `;
  document.head.appendChild(s);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const GRAD = "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))";
const GRAD_SOFT = "linear-gradient(135deg,hsl(263,70%,52%,0.1),hsl(330,85%,58%,0.1))";

// ── API helpers ───────────────────────────────────────────────────────────────
const fetchFeed = (viewer: string) =>
  fetch(`${API_BASE}/api/posts?viewer=${encodeURIComponent(viewer)}&limit=20`).then(r => { if(!r.ok) throw new Error(); return r.json(); });

const fetchComments = (postId: number) =>
  fetch(`${API_BASE}/api/posts/${postId}/comments`).then(r => { if(!r.ok) throw new Error(); return r.json(); });

const apiToggleLike = (postId: number, email: string) =>
  fetch(`${API_BASE}/api/posts/${postId}/like`, {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
    body: JSON.stringify({ user_email: email }),
  }).then(r => { if(!r.ok) throw new Error(); return r.json(); });

const apiToggleSave = (postId: number, email: string) =>
  fetch(`${API_BASE}/api/posts/${postId}/save`, {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
    body: JSON.stringify({ user_email: email }),
  }).then(r => { if(!r.ok) throw new Error(); return r.json(); });

const apiSearchRestaurants = (q: string) =>
  fetch(`${API_BASE}/api/posts/restaurants/search?q=${encodeURIComponent(q)}`).then(r => r.json());

const apiAddComment = async (postId: number, email: string, text: string) => {
  const r = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
    body: JSON.stringify({ user_email: email, text }),
  });
  const data = await r.json();
  if (!r.ok) {
    const err: any = new Error(data.error || "Fehler beim Kommentieren.");
    err.moderated = data.moderated;
    err.strikeMessage = data.strikeMessage;
    throw err;
  }
  return data;
};

// ── Time ago ──────────────────────────────────────────────────────────────────
function timeAgo(ts: string) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return "Gerade eben";
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} Tag${d !== 1 ? "en" : ""}`;
  return new Date(ts).toLocaleDateString("de-AT", { day: "numeric", month: "short" });
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ photoUrl, name, size = "md" }: { photoUrl?: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "sm" ? "w-7 h-7 text-[10px]" : size === "lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-xs";
  return (
    <div
      className={`${cls} rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold text-white`}
      style={{ background: GRAD, boxShadow: "0 0 0 2px white, 0 0 0 3.5px hsl(263,70%,52%,0.35)" }}
    >
      {photoUrl
        ? <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        : (name || "?").charAt(0).toUpperCase()
      }
    </div>
  );
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-card rounded-[20px] overflow-hidden" style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.04)" }}>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded-full shimmer-line shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 shimmer-line" />
          <div className="h-2.5 w-20 shimmer-line" />
        </div>
      </div>
      <div className="w-full shimmer-line" style={{ aspectRatio: "4/5" }} />
      <div className="px-4 py-4 space-y-2.5">
        <div className="flex gap-4">
          <div className="h-6 w-14 shimmer-line rounded-full" />
          <div className="h-6 w-14 shimmer-line rounded-full" />
        </div>
        <div className="h-3 w-4/5 shimmer-line" />
        <div className="h-3 w-1/2 shimmer-line" />
      </div>
    </div>
  );
}

// ── Comment Sheet ─────────────────────────────────────────────────────────────
function CommentSheet({ postId, email, userName, userPhoto, onClose }: {
  postId: number; email: string; userName: string; userPhoto: string | null; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => fetchComments(postId),
  });

  const submit = useMutation({
    mutationFn: () => apiAddComment(postId, email, text),
    onSuccess: (c) => {
      qc.setQueryData(["comments", postId], (old: any[]) => [...(old || []), c]);
      qc.invalidateQueries({ queryKey: ["feed"] });
      setText("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    },
    onError: (err: any) => {
      if (err.moderated) {
        toast({ title: "Inhalt blockiert", description: err.message, variant: "destructive" });
        if (err.strikeMessage) {
          setTimeout(() => toast({ title: "Hinweis", description: err.strikeMessage }), 800);
        }
      } else {
        toast({ title: "Fehler", description: "Kommentar konnte nicht gesendet werden." });
      }
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center fade-in"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="bg-background w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl slide-up"
        style={{ boxShadow: "0 -8px 48px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* drag pill */}
        <div className="flex justify-center pt-3 pb-1 shrink-0 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <h3 className="font-bold">{"Kommentare"}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">{"💬"}</p>
              <p className="font-semibold">{"Noch keine Kommentare"}</p>
              <p className="text-sm text-muted-foreground mt-1">{"Schreib den ersten Kommentar!"}</p>
            </div>
          ) : (
            comments.map((c: any) => (
              <div key={c.id} className="flex gap-3">
                <Avatar photoUrl={c.user_photo} name={c.user_name || c.user_email} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="bg-muted/40 rounded-2xl px-3.5 py-2.5">
                    <p className="text-xs font-bold mb-0.5">{c.user_name || c.user_email.split("@")[0]}</p>
                    <p className="text-sm leading-snug">{c.text}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 ml-2">{timeAgo(c.created_at)}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {email ? (
          <div className="px-4 py-3 border-t flex gap-2 items-end shrink-0">
            <Avatar photoUrl={userPhoto} name={userName} size="sm" />
            <div className="flex-1 relative">
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={"Kommentar schreiben…"}
                className="resize-none min-h-[40px] max-h-[100px] pr-10 rounded-2xl text-sm py-2.5"
                rows={1}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && text.trim()) {
                    e.preventDefault();
                    submit.mutate();
                  }
                }}
              />
              <button
                className="absolute right-2 bottom-2 w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity"
                style={{ background: GRAD }}
                disabled={!text.trim() || submit.isPending}
                onClick={() => submit.mutate()}
              >
                {submit.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  : <Send className="w-3.5 h-3.5 text-white" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 border-t text-center">
            <Link href="/profile" className="text-primary text-sm font-semibold hover:underline">
              {"Anmelden zum Kommentieren"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Restaurant Picker ─────────────────────────────────────────────────────────
function RestaurantPicker({ value, onChange }: { value: { id?: number; name: string } | null; onChange: (r: { id?: number; name: string } | null) => void }) {
  const [query, setQuery] = useState(value?.name || "");
  const [open, setOpen] = useState(false);
  const { data: results = [] } = useQuery({
    queryKey: ["rest-search", query],
    queryFn: () => apiSearchRestaurants(query),
    enabled: open && query.length >= 1,
  });

  return (
    <div className="relative">
      <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border bg-muted/20 focus-within:border-primary/50 transition-colors">
        <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
        <input
          type="text"
          value={query}
          placeholder={"Restaurant taggen (optional)"}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onFocus={() => setOpen(true)}
          onChange={e => {
            setQuery(e.target.value);
            if (!e.target.value) onChange(null);
          }}
        />
        {value && (
          <button onClick={() => { setQuery(""); onChange(null); }}>
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-card rounded-xl border shadow-xl overflow-hidden">
          {results.map((r: any) => (
            <button
              key={r.id}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/50 transition-colors text-left"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onChange({ id: r.id, name: r.name });
                setQuery(r.name);
                setOpen(false);
              }}
            >
              <span className="text-lg">{r.cuisine_emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground truncate">{r.cuisine}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create Post Modal (multi-step) ────────────────────────────────────────────
type CreateStep = "upload" | "compose" | "preview" | "success";

function CreatePostModal({ email, userName, userPhoto, onClose, onCreated }: {
  email: string; userName: string; userPhoto: string | null;
  onClose: () => void; onCreated: () => void;
}) {
  const [step, setStep] = useState<CreateStep>("upload");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [restaurant, setRestaurant] = useState<{ id?: number; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImage(file);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setStep("compose");
  };

  const submit = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", image);
      fd.append("user_email", email);
      fd.append("caption", caption);
      if (restaurant) {
        fd.append("restaurant_name", restaurant.name);
        if (restaurant.id) fd.append("restaurant_id", String(restaurant.id));
      }
      const r = await fetch(`${API_BASE}/api/posts`, { method: "POST", credentials: "include", body: fd });
      const data = await r.json();
      if (!r.ok) {
        if (data.moderated) {
          toast({ title: "Inhalt blockiert", description: data.error, variant: "destructive" });
          if (data.strikeMessage) {
            setTimeout(() => toast({ title: "Hinweis", description: data.strikeMessage }), 800);
          }
        } else {
          toast({ title: "Fehler", description: "Beitrag konnte nicht erstellt werden." });
        }
        return;
      }
      setStep("success");
      onCreated();
    } catch {
      toast({ title: "Fehler", description: "Beitrag konnte nicht erstellt werden." });
    } finally {
      setLoading(false);
    }
  };

  const stepTitle: Record<CreateStep, string> = {
    upload: "Neuer Beitrag",
    compose: "Details hinzufügen",
    preview: "Vorschau",
    success: "",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center fade-in"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)" }}
      onClick={step === "success" ? onClose : undefined}
    >
      <div
        className="bg-background w-full sm:max-w-[440px] max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl slide-up overflow-hidden"
        style={{ boxShadow: "0 -8px 48px rgba(0,0,0,0.22)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Success screen ── */}
        {step === "success" ? (
          <div className="flex flex-col items-center justify-center gap-5 py-16 px-8 text-center fade-in">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: GRAD, boxShadow: "0 8px 30px hsl(263,70%,52%,0.4)" }}
            >
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
            <div>
              <p className="font-bold text-xl">{"Beitrag veröffentlicht!"}</p>
              <p className="text-muted-foreground text-sm mt-1.5">{"Dein Post ist jetzt im Feed sichtbar."}</p>
            </div>
            <button
              onClick={onClose}
              className="font-bold text-white px-8 py-3 rounded-2xl text-sm mt-2 hover:opacity-90 active:scale-95 transition-all"
              style={{ background: GRAD }}
            >
              {"Feed ansehen"}
            </button>
          </div>
        ) : (
          <>
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              {step === "compose" || step === "preview" ? (
                <button
                  onClick={() => setStep(step === "preview" ? "compose" : "upload")}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={onClose} className="text-sm text-muted-foreground font-medium hover:text-foreground transition-colors">
                  {"Abbrechen"}
                </button>
              )}
              <p className="font-bold text-[15px]">{stepTitle[step]}</p>
              {step === "compose" ? (
                <button
                  className="flex items-center gap-1 text-sm font-bold disabled:opacity-40 transition-opacity"
                  style={{ color: "hsl(263,70%,52%)" }}
                  disabled={!image}
                  onClick={() => setStep("preview")}
                >
                  {"Vorschau"} <ChevronRight className="w-4 h-4" />
                </button>
              ) : step === "preview" ? (
                <button
                  className="text-sm font-bold text-white px-4 py-1.5 rounded-xl disabled:opacity-40 transition-all hover:opacity-90 active:scale-95"
                  style={{ background: GRAD }}
                  disabled={loading || !image}
                  onClick={submit}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Veröffentlichen"}
                </button>
              ) : (
                <div className="w-16" />
              )}
            </div>

            {/* ── Step: upload ── */}
            {step === "upload" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5 py-6">
                {/* Step dots */}
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: "hsl(263,70%,52%)" }} />
                  <div className="w-2 h-2 rounded-full bg-muted" />
                  <div className="w-2 h-2 rounded-full bg-muted" />
                </div>

                {/* Required badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[11px] font-semibold text-amber-600">{"Foto erforderlich zum Posten"}</span>
                </div>

                {/* Upload zone with dashed border */}
                <button
                  type="button"
                  className="w-full border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 py-10 px-6 hover:bg-primary/[0.03] active:scale-[0.98] transition-all"
                  style={{ borderColor: "hsl(263,70%,52%,0.35)", background: "hsl(263,70%,52%,0.025)" }}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if(f) handleFile(f); }}
                >
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: GRAD_SOFT }}>
                    <Camera className="w-10 h-10 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-[17px]">{"Foto hinzufügen"}</p>
                    <p className="text-sm text-muted-foreground mt-1">{"Tippe, um ein Foto auszuwählen"}</p>
                  </div>
                </button>

                {/* Primary CTA */}
                <button
                  type="button"
                  className="w-full font-bold text-white py-3.5 rounded-2xl hover:opacity-90 active:scale-[0.97] transition-all text-[15px]"
                  style={{ background: GRAD }}
                  onClick={() => fileRef.current?.click()}
                >
                  {"Foto auswählen"}
                </button>

                <p className="text-[11px] text-muted-foreground">{"JPG, PNG oder HEIC · max. 10 MB"}</p>
              </div>
            )}

            {/* ── Step: compose ── */}
            {step === "compose" && (
              <div className="flex-1 overflow-y-auto">
                {/* Step dots */}
                <div className="flex items-center justify-center gap-1.5 pt-3 pb-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: "hsl(263,70%,52%)" }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: "hsl(263,70%,52%)" }} />
                  <div className="w-2 h-2 rounded-full bg-muted" />
                </div>

                {/* Preview strip */}
                {preview && (
                  <div className="relative w-full shrink-0" style={{ aspectRatio: "4/5", maxHeight: 260 }}>
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top,rgba(0,0,0,0.3) 0%,transparent 50%)" }} />
                    <button
                      className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                      onClick={() => { setImage(null); setPreview(null); setStep("upload"); }}
                      title={"Foto ändern"}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-2.5 left-3 text-[11px] font-semibold text-white/80 flex items-center gap-1">
                      <Camera className="w-3 h-3" /> {"Foto ändern"}
                    </span>
                  </div>
                )}

                <div className="px-5 py-4 space-y-4">
                  {/* Caption */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{"Beschriftung"}</label>
                    <div className="flex gap-3 items-start">
                      <Avatar photoUrl={userPhoto} name={userName} />
                      <Textarea
                        autoFocus
                        value={caption}
                        onChange={e => setCaption(e.target.value.slice(0, 500))}
                        maxLength={500}
                        placeholder={"Was erlebst du? Schreib etwas…"}
                        className="flex-1 resize-none min-h-[90px] rounded-2xl text-sm border-border/60 focus:border-primary/50"
                      />
                    </div>
                    <p className={`text-right text-[11px] pr-1 transition-colors ${caption.length >= 450 ? "text-amber-500 font-semibold" : "text-muted-foreground"}`}>
                      {caption.length}/500
                    </p>
                  </div>

                  {/* Restaurant picker */}
                  <RestaurantPicker value={restaurant} onChange={setRestaurant} />
                </div>
              </div>
            )}

            {/* ── Step: preview ── */}
            {step === "preview" && (
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-4">
                  {/* Step dots */}
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: "hsl(263,70%,52%)" }} />
                    <div className="w-2 h-2 rounded-full" style={{ background: "hsl(263,70%,52%)" }} />
                    <div className="w-2 h-2 rounded-full" style={{ background: "hsl(263,70%,52%)" }} />
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{"So sieht dein Beitrag aus"}</p>

                  {/* Preview card */}
                  <div className="bg-card rounded-2xl overflow-hidden border" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                      <Avatar photoUrl={userPhoto} name={userName} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">{userName || email.split("@")[0]}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {restaurant && (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: "hsl(330,85%,58%,0.12)", color: "hsl(330,85%,48%)" }}
                            >
                              <MapPin className="w-2.5 h-2.5" /> {restaurant.name}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">{"Gerade eben"}</span>
                        </div>
                      </div>
                    </div>
                    {/* Image */}
                    {preview && (
                      <div className="relative" style={{ aspectRatio: "4/5" }}>
                        <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to top,rgba(0,0,0,0.4) 0%,transparent 100%)" }} />
                      </div>
                    )}
                    {/* Actions */}
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-5 mb-2.5">
                        <div className="flex items-center gap-2"><Heart className="w-6 h-6 text-muted-foreground/50" /><span className="text-sm font-bold text-muted-foreground">0</span></div>
                        <div className="flex items-center gap-2"><MessageCircle className="w-6 h-6 text-muted-foreground/50" /><span className="text-sm font-bold text-muted-foreground">0</span></div>
                      </div>
                      {caption && (
                        <p className="text-sm leading-snug">
                          <span className="font-bold mr-1.5">{userName || email.split("@")[0]}</span>
                          {caption}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center mt-4">{"Alles gut? Drücke oben auf »Veröffentlichen«."}</p>
                </div>
              </div>
            )}
          </>
        )}

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({ post, email, userName, userPhoto, onOpenComments }: {
  post: any; email: string; userName: string; userPhoto: string | null;
  onOpenComments: (id: number) => void;
}) {
  const { gainXp } = useXpGain();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.savedByMe);
  const [liking, setLiking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [heartPop, setHeartPop] = useState(false);
  const [floatHearts, setFloatHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [pressed, setPressed] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const heartIdRef = useRef(0);
  const lastTapRef = useRef(0);
  const bmRef = useRef<SVGSVGElement>(null);

  const handleLike = useCallback(async (skipAnim = false) => {
    if (!email || liking) return;
    setLiking(true);
    if (!skipAnim) {
      setHeartPop(true);
      setTimeout(() => setHeartPop(false), 400);
    }
    const prev = liked;
    setLiked(!prev);
    setLikeCount((c: number) => c + (prev ? -1 : 1));
    if (!prev) gainXp(10, "Reaktion");
    try {
      const r = await apiToggleLike(post.id, email);
      setLiked(r.liked);
      setLikeCount(r.likeCount);
    } catch {
      setLiked(prev);
      setLikeCount((c: number) => c + (prev ? 1 : -1));
    } finally {
      setLiking(false);
    }
  }, [email, liking, liked, post.id]);

  const handleSave = async () => {
    if (!email || saving) return;
    setSaving(true);
    const prev = saved;
    setSaved(!prev);
    bmRef.current?.classList.remove("bm-bounce");
    void bmRef.current?.offsetWidth;
    bmRef.current?.classList.add("bm-bounce");
    try {
      const r = await apiToggleSave(post.id, email);
      setSaved(r.saved);
    } catch {
      setSaved(prev);
    } finally {
      setSaving(false);
    }
  };

  const handleDoubleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 340) {
      const rect = imageRef.current?.getBoundingClientRect();
      let x = 50, y = 50;
      if (rect) {
        const cx = "touches" in e ? e.changedTouches[0]?.clientX ?? rect.left + rect.width / 2 : (e as React.MouseEvent).clientX;
        const cy = "touches" in e ? e.changedTouches[0]?.clientY ?? rect.top + rect.height / 2 : (e as React.MouseEvent).clientY;
        x = ((cx - rect.left) / rect.width) * 100;
        y = ((cy - rect.top) / rect.height) * 100;
      }
      const id = ++heartIdRef.current;
      setFloatHearts(fh => [...fh, { id, x, y }]);
      setTimeout(() => setFloatHearts(fh => fh.filter(h => h.id !== id)), 950);
      if (!liked) handleLike(true);
    }
    lastTapRef.current = now;
  }, [liked, handleLike]);

  const imageUrl = post.image_url?.startsWith("/api") ? `${API_BASE}${post.image_url}` : post.image_url;
  const displayName = post.user_name || post.user_email?.split("@")[0] || "?";
  const caption = post.caption || "";
  const isLong = caption.length > 100;
  const isOwnPost = email && post.user_email && email.toLowerCase() === post.user_email.toLowerCase();
  const authorHref = isOwnPost ? "/profile" : `/u/${encodeURIComponent(post.user_email || "")}`;

  return (
    <article
      className="bg-card overflow-hidden transition-transform duration-200 select-none"
      style={{
        borderRadius: 20,
        boxShadow: "0 2px 20px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.04)",
        transform: pressed ? "scale(0.984)" : "scale(1)",
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Link href={authorHref}>
          <Avatar photoUrl={post.user_photo} name={displayName} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={authorHref}>
            <p className="text-[15px] font-bold truncate hover:text-primary transition-colors leading-tight">{displayName}</p>
          </Link>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {post.restaurant_name && (
              <Link href="/entdecken">
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ background: "hsl(330,85%,58%,0.12)", color: "hsl(330,85%,44%)" }}
                >
                  <MapPin className="w-2.5 h-2.5" />{post.restaurant_name}
                </span>
              </Link>
            )}
            <span className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</span>
          </div>
        </div>
        {/* Save bookmark */}
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors disabled:cursor-default"
          onClick={handleSave}
          disabled={!email}
          aria-label={saved ? "Gespeichert" : "Speichern"}
        >
          <Bookmark
            ref={bmRef}
            className={`w-[18px] h-[18px] transition-colors ${saved ? "fill-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          />
        </button>
      </div>

      {/* ── Image ── */}
      <div
        ref={imageRef}
        className="relative w-full overflow-hidden bg-muted/20 cursor-pointer"
        style={{ aspectRatio: "4/5" }}
        onClick={handleDoubleTap}
      >
        {!imgLoaded && (
          <div className="absolute inset-0 shimmer-line" />
        )}
        <img
          src={imageUrl}
          alt="Post"
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-700 ease-out hover:scale-[1.04] ${imgLoaded ? "img-fade-in" : "opacity-0"}`}
          onLoad={() => setImgLoaded(true)}
        />

        {/* Bottom gradient */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: "linear-gradient(to top,rgba(0,0,0,0.5) 0%,transparent 100%)" }}
        />

        {/* Floating hearts on double-tap */}
        {floatHearts.map(h => (
          <span key={h.id} className="heart-float" style={{ left: `${h.x}%`, top: `${h.y}%` }}>{"❤️"}</span>
        ))}

        {/* Restaurant pill overlay */}
        {post.restaurant_name && (
          <Link href="/entdecken">
            <span
              className="absolute bottom-3 left-3 inline-flex items-center gap-1 text-[11px] font-bold text-white px-2.5 py-1 rounded-full backdrop-blur-sm cursor-pointer hover:bg-black/60 transition-colors"
              style={{ background: "rgba(0,0,0,0.42)" }}
            >
              <MapPin className="w-2.5 h-2.5" />{post.restaurant_name}
            </span>
          </Link>
        )}

        {/* Friends badge */}
        {post.is_friend_post === 1 && (
          <span
            className="absolute top-3 left-3 text-[10px] font-bold text-white px-2 py-0.5 rounded-full backdrop-blur-sm"
            style={{ background: GRAD }}
          >
            {"Freund"}
          </span>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-center gap-5 mb-3">
          {/* Like */}
          <button
            className={`flex items-center gap-2 transition-all active:scale-90 ${!email && "opacity-50 cursor-default"}`}
            onClick={() => handleLike()}
            disabled={!email}
            aria-label="Like"
          >
            <Heart
              className={`w-6 h-6 transition-all duration-200 ${heartPop ? "heart-pop" : ""} ${liked ? "fill-rose-500 text-rose-500" : "text-foreground hover:text-rose-400"}`}
              style={liked ? { filter: "drop-shadow(0 0 5px rgba(244,63,94,0.6))" } : {}}
            />
            <span className={`text-sm font-bold tabular-nums transition-colors ${liked ? "text-rose-500" : "text-muted-foreground"}`}>
              {likeCount}
            </span>
          </button>

          {/* Comment */}
          <button
            className="flex items-center gap-2 group"
            onClick={() => onOpenComments(post.id)}
            aria-label="Kommentare"
          >
            <MessageCircle className="w-6 h-6 text-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm font-bold text-muted-foreground tabular-nums group-hover:text-primary transition-colors">
              {post.commentCount}
            </span>
          </button>
        </div>

        {/* Caption */}
        {caption && (
          <div className="text-[14px] leading-snug">
            <span className="font-bold mr-1.5">{displayName}</span>
            <span className={!captionExpanded && isLong ? "line-clamp-2" : ""}>{caption}</span>
            {isLong && !captionExpanded && (
              <button
                className="text-muted-foreground font-semibold ml-1 hover:text-foreground transition-colors text-xs"
                onClick={() => setCaptionExpanded(true)}
              >
                {"mehr anzeigen"}
              </button>
            )}
          </div>
        )}

        {/* Comment teaser */}
        {post.commentCount > 0 && (
          <button
            className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
            onClick={() => onOpenComments(post.id)}
          >
            {"Alle "}{post.commentCount}{" Kommentar"}{post.commentCount !== 1 ? "e" : ""}{" ansehen"}
          </button>
        )}
      </div>
    </article>
  );
}

// ── Guest Banner ──────────────────────────────────────────────────────────────
function GuestBanner() {
  return (
    <div className="rounded-2xl p-5 text-center" style={{ background: GRAD_SOFT, border: "1px solid hsl(263,70%,52%,0.15)" }}>
      <p className="text-3xl mb-2">{"📸"}</p>
      <p className="font-bold text-sm mb-1">{"Meld dich an, um zu posten & zu liken"}</p>
      <p className="text-xs text-muted-foreground mb-3.5">{"Der Feed ist öffentlich – du kannst ohne Login alles lesen"}</p>
      <Link
        href="/profile"
        className="inline-flex items-center text-xs font-bold text-white px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all"
        style={{ background: GRAD }}
      >
        {"Anmelden"}
      </Link>
    </div>
  );
}

// ── Feed Page ─────────────────────────────────────────────────────────────────
export default function FeedPage() {
  useSeo({ title: "Feed – RestoSmart" });

  const [email, setEmail] = useState(() => localStorage.getItem("restosmart_email") ?? "");
  const [userName, setUserName] = useState("");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [commentPostId, setCommentPostId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const sync = () => setEmail(localStorage.getItem("restosmart_email") ?? "");
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!email) return;
    fetch(`${API_BASE}/api/customer-profile/${encodeURIComponent(email)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setUserName(d.name || email.split("@")[0]); setUserPhoto(d.photoUrl || null); } });
  }, [email]);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["feed", email],
    queryFn: () => fetchFeed(email),
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen pb-28" style={{ background: "hsl(var(--background))" }}>
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-30 px-4 py-3.5 flex items-center justify-between"
        style={{ background: "hsl(var(--background)/0.92)", backdropFilter: "blur(18px)", borderBottom: "1px solid hsl(var(--border)/0.5)" }}
      >
        <div>
          <h1 className="font-serif font-bold text-[20px] leading-tight">{"Feed"}</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">{"Food-Erlebnisse der Community"}</p>
        </div>
        {email && (
          <button
            className="flex items-center gap-1.5 text-sm font-bold text-white px-4 py-2 rounded-xl hover:opacity-90 active:scale-95 transition-all"
            style={{ background: GRAD, boxShadow: "0 4px 14px hsl(263,70%,52%,0.38)" }}
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4" />{"Posten"}
          </button>
        )}
      </div>

      {/* ── Content ── */}
      <div className="max-w-[600px] mx-auto px-3 sm:px-5 py-5 space-y-5">
        {!email && <GuestBanner />}

        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-5 py-20 text-center fade-in">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl" style={{ background: GRAD_SOFT }}>{"✨"}</div>
            <div>
              <p className="font-bold text-xl">{"Noch keine Beiträge"}</p>
              <p className="text-muted-foreground text-sm mt-1.5">{"Sei der Erste und teile dein Food-Erlebnis!"}</p>
            </div>
            {email && (
              <button
                className="flex items-center gap-2 text-sm font-bold text-white px-6 py-3 rounded-2xl hover:opacity-90 active:scale-95 transition-all"
                style={{ background: GRAD }}
                onClick={() => setShowCreate(true)}
              >
                <Camera className="w-4 h-4" />{"Ersten Post erstellen"}
              </button>
            )}
          </div>
        ) : (
          posts.map((post: any) => (
            <PostCard
              key={post.id}
              post={post}
              email={email}
              userName={userName}
              userPhoto={userPhoto}
              onOpenComments={setCommentPostId}
            />
          ))
        )}
      </div>

      {/* ── Floating Create ── */}
      {email && posts.length > 0 && (
        <button
          className="fixed bottom-24 right-4 z-20 w-14 h-14 rounded-full text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          style={{ background: GRAD, boxShadow: "0 6px 24px hsl(263,70%,52%,0.5)" }}
          onClick={() => setShowCreate(true)}
          aria-label="Neuer Post"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* ── Modals ── */}
      {commentPostId !== null && (
        <CommentSheet
          postId={commentPostId}
          email={email}
          userName={userName}
          userPhoto={userPhoto}
          onClose={() => setCommentPostId(null)}
        />
      )}
      {showCreate && (
        <CreatePostModal
          email={email}
          userName={userName}
          userPhoto={userPhoto}
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["feed"] })}
        />
      )}
    </div>
  );
}
