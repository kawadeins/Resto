/**
 * Public Social Feed — Premium Instagram-style post stream.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Heart, MessageCircle, Send, X, MapPin,
  Plus, Loader2, Bookmark, Camera
} from "lucide-react";
import { useSeo } from "@/hooks/use-seo";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── API helpers ────────────────────────────────────────────────────────────────
async function fetchFeed(viewer: string) {
  const r = await fetch(`${API_BASE}/api/posts?viewer=${encodeURIComponent(viewer)}&limit=20&offset=0`);
  if (!r.ok) throw new Error("Failed to fetch feed");
  return r.json();
}
async function toggleLike(postId: number, userEmail: string) {
  const r = await fetch(`${API_BASE}/api/posts/${postId}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_email: userEmail }),
  });
  if (!r.ok) throw new Error("Failed to toggle like");
  return r.json();
}
async function fetchComments(postId: number) {
  const r = await fetch(`${API_BASE}/api/posts/${postId}/comments`);
  if (!r.ok) throw new Error("Failed to fetch comments");
  return r.json();
}
async function addComment(postId: number, userEmail: string, text: string) {
  const r = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_email: userEmail, text }),
  });
  if (!r.ok) throw new Error("Failed to add comment");
  return r.json();
}

// ── Time ago ──────────────────────────────────────────────────────────────────
function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
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
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : size === "lg" ? "w-11 h-11 text-sm" : "w-9 h-9 text-xs";
  return (
    <div
      className={`${sz} rounded-full shrink-0 overflow-hidden flex items-center justify-center`}
      style={{
        background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))",
        boxShadow: "0 0 0 2px white, 0 0 0 3.5px hsl(263,70%,52%,0.4)",
      }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-white font-bold">{(name || "?").charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

// ── Heart Pop Animation (keyframes injected once) ──────────────────────────────
const STYLE_ID = "feed-heart-style";
if (!document.getElementById(STYLE_ID)) {
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes heartPop {
      0%   { transform: scale(1); }
      30%  { transform: scale(1.5); }
      60%  { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    @keyframes floatHeart {
      0%   { opacity: 1; transform: translate(-50%,-50%) scale(0.8); }
      50%  { opacity: 1; transform: translate(-50%,-80%) scale(1.4); }
      100% { opacity: 0; transform: translate(-50%,-130%) scale(1); }
    }
    .heart-pop { animation: heartPop 0.4s cubic-bezier(.36,.07,.19,.97) both; }
    .heart-float {
      position: absolute;
      pointer-events: none;
      font-size: 4rem;
      animation: floatHeart 0.9s ease forwards;
      z-index: 20;
    }
    @keyframes imgFadeIn {
      from { opacity: 0; transform: scale(1.04); }
      to   { opacity: 1; transform: scale(1); }
    }
    .img-fade-in { animation: imgFadeIn 0.5s ease both; }
    @keyframes bookmarkPop {
      0%   { transform: scale(1); }
      40%  { transform: scale(1.3) rotate(-8deg); }
      100% { transform: scale(1) rotate(0); }
    }
    .bookmark-pop { animation: bookmarkPop 0.35s cubic-bezier(.36,.07,.19,.97) both; }
  `;
  document.head.appendChild(s);
}

// ── Comment Sheet ─────────────────────────────────────────────────────────────
function CommentSheet({
  postId, email, userName, userPhoto, onClose
}: {
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

  const submitMutation = useMutation({
    mutationFn: () => addComment(postId, email, text),
    onSuccess: (newComment) => {
      qc.setQueryData(["comments", postId], (old: any[]) => [...(old || []), newComment]);
      qc.invalidateQueries({ queryKey: ["feed"] });
      setText("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: () => toast({ title: "Fehler", description: "Kommentar konnte nicht gesendet werden." }),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="bg-background rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[85vh] flex flex-col"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h3 className="font-bold text-base">{"Kommentare"}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">{"💬"}</p>
              <p className="text-sm text-muted-foreground">{"Noch keine Kommentare — schreib den ersten!"}</p>
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
                    submitMutation.mutate();
                  }
                }}
              />
              <button
                className="absolute right-2 bottom-2 w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity"
                style={{ background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))" }}
                disabled={!text.trim() || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending
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

// ── Create Post Modal ─────────────────────────────────────────────────────────
function CreatePostModal({
  email, userName, userPhoto, onClose, onCreated
}: {
  email: string; userName: string; userPhoto: string | null;
  onClose: () => void; onCreated: () => void;
}) {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const submit = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", image);
      fd.append("user_email", email);
      fd.append("caption", caption);
      fd.append("restaurant_name", restaurantName);
      const r = await fetch(`${API_BASE}/api/posts`, { method: "POST", body: fd });
      if (!r.ok) throw new Error("Upload failed");
      toast({ title: "Beitrag erstellt!", description: "Dein Post ist jetzt im Feed sichtbar." });
      onCreated();
      onClose();
    } catch {
      toast({ title: "Fehler", description: "Beitrag konnte nicht erstellt werden." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="bg-background rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <button onClick={onClose} className="text-sm text-muted-foreground font-medium hover:text-foreground transition-colors">
            {"Abbrechen"}
          </button>
          <h3 className="font-bold text-base">{"Post erstellen"}</h3>
          <button
            className="text-sm font-bold disabled:opacity-40 transition-opacity"
            style={{ background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            disabled={!image || loading}
            onClick={submit}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : "Teilen"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!preview ? (
            <div
              className="border-2 border-dashed border-border/50 rounded-2xl p-8 text-center flex flex-col items-center gap-3 cursor-pointer transition-all hover:border-primary/60 hover:bg-primary/5"
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,hsl(263,70%,52%,0.12),hsl(330,85%,58%,0.12))" }}>
                <Camera className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm">{"Foto hinzufügen"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{"Tippe oder ziehe ein Bild hierher"}</p>
              </div>
              <div className="text-xs font-bold text-white px-5 py-2.5 rounded-xl" style={{ background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))" }}>
                {"Foto auswählen"}
              </div>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "4/5" }}>
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              <button
                className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                onClick={() => { setImage(null); setPreview(null); }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

          <div className="flex gap-3 items-start">
            <Avatar photoUrl={userPhoto} name={userName} />
            <Textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder={"Was erlebst du? Schreib etwas…"}
              className="flex-1 resize-none min-h-[80px] rounded-2xl text-sm"
            />
          </div>

          <div className="flex items-center gap-2.5 p-3.5 rounded-xl border bg-muted/20">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
            <input
              type="text"
              value={restaurantName}
              onChange={e => setRestaurantName(e.target.value)}
              placeholder={"Restaurant taggen (optional)"}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({ post, email, userName, userPhoto, onOpenComments }: {
  post: any; email: string; userName: string; userPhoto: string | null;
  onOpenComments: (id: number) => void;
}) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [liking, setLiking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [heartPop, setHeartPop] = useState(false);
  const [floatHearts, setFloatHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [pressed, setPressed] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const heartIdRef = useRef(0);
  const lastTapRef = useRef(0);

  const handleLike = useCallback(async (skipAnimation = false) => {
    if (!email || liking) return;
    setLiking(true);
    if (!skipAnimation) {
      setHeartPop(true);
      setTimeout(() => setHeartPop(false), 400);
    }
    const prev = liked;
    setLiked(!prev);
    setLikeCount((c: number) => c + (prev ? -1 : 1));
    try {
      const result = await toggleLike(post.id, email);
      setLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch {
      setLiked(prev);
      setLikeCount((c: number) => c + (prev ? 1 : -1));
    } finally {
      setLiking(false);
    }
  }, [email, liking, liked, post.id]);

  const handleDoubleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      const rect = imageRef.current?.getBoundingClientRect();
      let x = 50, y = 50;
      if (rect) {
        const clientX = "touches" in e ? e.touches[0]?.clientX ?? rect.left + rect.width / 2 : (e as React.MouseEvent).clientX;
        const clientY = "touches" in e ? e.touches[0]?.clientY ?? rect.top + rect.height / 2 : (e as React.MouseEvent).clientY;
        x = ((clientX - rect.left) / rect.width) * 100;
        y = ((clientY - rect.top) / rect.height) * 100;
      }
      const id = ++heartIdRef.current;
      setFloatHearts(fh => [...fh, { id, x, y }]);
      setTimeout(() => setFloatHearts(fh => fh.filter(h => h.id !== id)), 1000);
      if (!liked) handleLike(true);
    }
    lastTapRef.current = now;
  }, [liked, handleLike]);

  const imageUrl = post.image_url?.startsWith("/api") ? `${API_BASE}${post.image_url}` : post.image_url;
  const displayName = post.user_name || post.user_email?.split("@")[0] || "?";
  const caption = post.caption || "";
  const longCaption = caption.length > 100;

  return (
    <div
      className="bg-card rounded-[20px] overflow-hidden transition-transform duration-200 select-none"
      style={{
        boxShadow: "0 2px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
        transform: pressed ? "scale(0.985)" : "scale(1)",
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Link href="/profile">
          <Avatar photoUrl={post.user_photo} name={displayName} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href="/profile">
            <p className="text-sm font-bold truncate hover:text-primary transition-colors">{displayName}</p>
          </Link>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {post.restaurant_name && (
              <Link href="/entdecken">
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ background: "hsl(330,85%,58%,0.12)", color: "hsl(330,85%,48%)" }}
                >
                  <MapPin className="w-2.5 h-2.5" />
                  {post.restaurant_name}
                </span>
              </Link>
            )}
            <span className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</span>
          </div>
        </div>
        <button
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${saved ? "" : "hover:bg-muted/60"}`}
          onClick={() => {
            setSaved(s => !s);
            const el = document.getElementById(`bm-${post.id}`);
            el?.classList.remove("bookmark-pop");
            void el?.offsetWidth;
            el?.classList.add("bookmark-pop");
          }}
        >
          <Bookmark
            id={`bm-${post.id}`}
            className={`w-5 h-5 transition-colors ${saved ? "fill-primary text-primary" : "text-muted-foreground"}`}
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
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
          </div>
        )}
        <img
          src={imageUrl}
          alt="Post"
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-500 ease-out hover:scale-[1.03] ${imgLoaded ? "img-fade-in" : "opacity-0"}`}
          onLoad={() => setImgLoaded(true)}
        />

        {/* Gradient overlay at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)" }}
        />

        {/* Float hearts on double-tap */}
        {floatHearts.map(h => (
          <span
            key={h.id}
            className="heart-float"
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
          >
            {"❤️"}
          </span>
        ))}

        {/* Restaurant pill overlay at bottom-left */}
        {post.restaurant_name && (
          <div className="absolute bottom-3 left-3 pointer-events-none">
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold text-white px-2.5 py-1 rounded-full backdrop-blur-sm"
              style={{ background: "rgba(0,0,0,0.45)" }}
            >
              <MapPin className="w-2.5 h-2.5" />
              {post.restaurant_name}
            </span>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="px-4 pt-3.5 pb-4">
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
              style={liked ? { filter: "drop-shadow(0 0 4px rgba(244,63,94,0.5))" } : {}}
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
          <div className="text-sm leading-snug">
            <span className="font-bold mr-1.5">{displayName}</span>
            <span className={!captionExpanded && longCaption ? "line-clamp-2" : ""}>
              {caption}
            </span>
            {longCaption && !captionExpanded && (
              <button
                className="text-muted-foreground font-medium ml-1 hover:text-foreground transition-colors text-xs"
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
    </div>
  );
}

// ── Stories-style top bar (anonymous users banner) ────────────────────────────
function GuestBanner() {
  return (
    <div
      className="rounded-2xl p-5 text-center"
      style={{ background: "linear-gradient(135deg,hsl(263,70%,52%,0.08),hsl(330,85%,58%,0.08))", border: "1px solid hsl(263,70%,52%,0.15)" }}
    >
      <p className="text-2xl mb-2">{"📸"}</p>
      <p className="font-bold text-sm mb-1">{"Meld dich an, um zu posten & zu liken"}</p>
      <p className="text-xs text-muted-foreground mb-3.5">{"Der Feed ist öffentlich – du kannst ohne Login alles lesen"}</p>
      <Link
        href="/profile"
        className="inline-flex items-center text-xs font-bold text-white px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))" }}
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
  const [showCreatePost, setShowCreatePost] = useState(false);
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
      .then(data => {
        if (data) {
          setUserName(data.name || email.split("@")[0]);
          setUserPhoto(data.photoUrl || null);
        }
      });
  }, [email]);

  const { data: posts = [], isLoading, refetch } = useQuery({
    queryKey: ["feed", email],
    queryFn: () => fetchFeed(email),
    refetchInterval: 60_000,
  });

  const commentPost = posts.find((p: any) => p.id === commentPostId);

  return (
    <div className="min-h-screen pb-28" style={{ background: "hsl(var(--background))" }}>
      {/* ── Sticky Header ── */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
        style={{ background: "hsl(var(--background)/0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid hsl(var(--border)/0.5)" }}
      >
        <div>
          <h1 className="font-serif font-bold text-xl leading-tight">{"Feed"}</h1>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{"Food-Erlebnisse der Community"}</p>
        </div>
        {email && (
          <button
            className="flex items-center gap-1.5 text-sm font-bold text-white px-4 py-2 rounded-xl shadow-md hover:opacity-90 active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))", boxShadow: "0 4px 12px hsl(263,70%,52%,0.35)" }}
            onClick={() => setShowCreatePost(true)}
          >
            <Plus className="w-4 h-4" />
            {"Posten"}
          </button>
        )}
      </div>

      {/* ── Feed Content ── */}
      <div className="max-w-[600px] mx-auto px-3 sm:px-5 py-5 space-y-5">
        {!email && <GuestBanner />}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,hsl(263,70%,52%,0.12),hsl(330,85%,58%,0.12))" }}
            >
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">{"Feed wird geladen…"}</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-5 py-20 text-center">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
              style={{ background: "linear-gradient(135deg,hsl(263,70%,52%,0.1),hsl(330,85%,58%,0.1))" }}
            >
              {"✨"}
            </div>
            <div>
              <p className="font-bold text-xl">{"Noch keine Beiträge"}</p>
              <p className="text-muted-foreground text-sm mt-1.5">{"Sei der Erste und teile dein Food-Erlebnis!"}</p>
            </div>
            {email && (
              <button
                className="flex items-center gap-2 text-sm font-bold text-white px-6 py-3 rounded-2xl shadow-md hover:opacity-90 active:scale-95 transition-all"
                style={{ background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))" }}
                onClick={() => setShowCreatePost(true)}
              >
                <Camera className="w-4 h-4" />
                {"Ersten Post erstellen"}
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
              onOpenComments={(id) => setCommentPostId(id)}
            />
          ))
        )}
      </div>

      {/* ── Floating Create Button ── */}
      {email && posts.length > 0 && (
        <button
          className="fixed bottom-24 right-4 z-20 w-14 h-14 rounded-full text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          style={{
            background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))",
            boxShadow: "0 6px 20px hsl(263,70%,52%,0.45)",
          }}
          onClick={() => setShowCreatePost(true)}
          aria-label="Neuer Post"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* ── Comment Sheet ── */}
      {commentPostId !== null && (
        <CommentSheet
          postId={commentPostId}
          email={email}
          userName={userName}
          userPhoto={userPhoto}
          onClose={() => setCommentPostId(null)}
        />
      )}

      {/* ── Create Post Modal ── */}
      {showCreatePost && (
        <CreatePostModal
          email={email}
          userName={userName}
          userPhoto={userPhoto}
          onClose={() => setShowCreatePost(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["feed"] })}
        />
      )}
    </div>
  );
}
