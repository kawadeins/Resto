/**
 * Public Social Feed — Instagram-style post stream.
 * Users can view posts, like them, comment, and create new posts.
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Heart, MessageCircle, Send, X, Image, MapPin, ChevronDown,
  Plus, Loader2, Bookmark, MoreHorizontal, Trash2, Camera
} from "lucide-react";
import { useSeo } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── API helpers ────────────────────────────────────────────────────────────────
async function fetchFeed(viewer: string, offset = 0) {
  const r = await fetch(`${API_BASE}/api/posts?viewer=${encodeURIComponent(viewer)}&limit=20&offset=${offset}`);
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

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ photoUrl, name, size = "md" }: { photoUrl?: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : size === "lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-xs";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-background`}>
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-white font-bold">{(name || "?").charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

// ── Comment Sheet ──────────────────────────────────────────────────────────────
function CommentSheet({
  postId, postOwner, email, userName, userPhoto, onClose
}: {
  postId: number; postOwner: string; email: string; userName: string; userPhoto: string | null; onClose: () => void;
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-background rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h3 className="font-bold text-base">{"Kommentare"}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {"Noch keine Kommentare — schreib den ersten!"}
            </div>
          ) : (
            comments.map((c: any) => (
              <div key={c.id} className="flex gap-3">
                <Avatar photoUrl={c.user_photo} name={c.user_name || c.user_email} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="bg-muted/50 rounded-2xl px-3 py-2.5">
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

        {/* Input */}
        {email ? (
          <div className="px-4 py-3 border-t flex gap-2 items-end shrink-0">
            <Avatar photoUrl={userPhoto} name={userName} size="sm" />
            <div className="flex-1 relative">
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={"Kommentar schreiben…"}
                className="resize-none min-h-[40px] max-h-[120px] pr-10 rounded-2xl text-sm py-2.5"
                rows={1}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && text.trim()) {
                    e.preventDefault();
                    submitMutation.mutate();
                  }
                }}
              />
              <button
                className="absolute right-2 bottom-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center disabled:opacity-40"
                disabled={!text.trim() || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  : <Send className="w-3.5 h-3.5 text-white" />
                }
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

// ── Create Post Modal ──────────────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-background rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <button onClick={onClose} className="text-sm text-muted-foreground font-medium hover:text-foreground">
            {"Abbrechen"}
          </button>
          <h3 className="font-bold text-base">{"Post erstellen"}</h3>
          <button
            className="text-sm font-bold text-primary hover:opacity-80 disabled:opacity-40"
            disabled={!image || loading}
            onClick={submit}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Teilen"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Image picker */}
          {!preview ? (
            <div
              className="border-2 border-dashed border-border/60 rounded-2xl p-8 text-center flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{"Foto hinzufügen"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{"Tippe oder ziehe ein Bild hierher"}</p>
              </div>
              <button className="text-xs font-bold text-white bg-gradient-to-r from-primary to-accent px-4 py-2 rounded-xl hover:opacity-90">
                {"Foto auswählen"}
              </button>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden">
              <img src={preview} alt="Preview" className="w-full max-h-72 object-cover rounded-2xl" />
              <button
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80"
                onClick={() => { setImage(null); setPreview(null); }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

          {/* Caption */}
          <div className="flex gap-3">
            <Avatar photoUrl={userPhoto} name={userName} />
            <Textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder={"Was erlebst du? Schreib etwas…"}
              className="flex-1 resize-none min-h-[80px] rounded-2xl text-sm"
            />
          </div>

          {/* Restaurant tag */}
          <div className="flex items-center gap-2 p-3 rounded-xl border bg-muted/20">
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
function PostCard({ post, email, userName, userPhoto, onLike, onOpenComments }: {
  post: any; email: string; userName: string; userPhoto: string | null;
  onLike: (id: number) => void; onOpenComments: (id: number) => void;
}) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [liking, setLiking] = useState(false);

  const handleLike = async () => {
    if (!email || liking) return;
    setLiking(true);
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
  };

  const isOwner = email === post.user_email;

  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Link href="/profile">
          <Avatar photoUrl={post.user_photo} name={post.user_name || post.user_email} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href="/profile">
            <p className="text-sm font-bold truncate hover:text-primary transition-colors">
              {post.user_name || post.user_email.split("@")[0]}
            </p>
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            {post.restaurant_name && (
              <span className="flex items-center gap-1 text-[11px] text-rose-500 font-medium">
                <MapPin className="w-3 h-3" /> {post.restaurant_name}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Image */}
      <div className="relative bg-muted/30">
        <img
          src={post.image_url.startsWith("/api") ? `${API_BASE}${post.image_url}` : post.image_url}
          alt="Post"
          className="w-full aspect-[4/3] sm:aspect-[16/10] object-cover"
          loading="lazy"
          onDoubleClick={handleLike}
        />
      </div>

      {/* Actions */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-4 mb-3">
          <button
            className={`flex items-center gap-1.5 group transition-transform active:scale-90 ${!email && "opacity-50 cursor-default"}`}
            onClick={handleLike}
            disabled={!email}
          >
            <Heart
              className={`w-6 h-6 transition-all duration-150 ${liked ? "fill-rose-500 text-rose-500 scale-110" : "text-foreground group-hover:text-rose-500"}`}
            />
            <span className={`text-sm font-semibold tabular-nums ${liked ? "text-rose-500" : "text-muted-foreground"}`}>
              {likeCount}
            </span>
          </button>
          <button
            className="flex items-center gap-1.5 group"
            onClick={() => onOpenComments(post.id)}
          >
            <MessageCircle className="w-6 h-6 text-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm font-semibold text-muted-foreground tabular-nums">{post.commentCount}</span>
          </button>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm leading-snug">
            <span className="font-bold mr-1.5">{post.user_name || post.user_email.split("@")[0]}</span>
            {post.caption}
          </p>
        )}

        {/* Comment teaser */}
        {post.commentCount > 0 && (
          <button
            className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onOpenComments(post.id)}
          >
            {"Alle"} {post.commentCount} {"Kommentar" + (post.commentCount !== 1 ? "e" : "")} {"ansehen"}
          </button>
        )}
      </div>
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

  // Fetch user profile for avatar/name
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

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-serif font-bold text-xl">{"Feed"}</h1>
          <p className="text-xs text-muted-foreground">{"Food-Erlebnisse der Community"}</p>
        </div>
        {email && (
          <button
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent text-white text-sm font-bold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
            onClick={() => setShowCreatePost(true)}
          >
            <Plus className="w-4 h-4" /> {"Posten"}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-w-xl mx-auto px-3 sm:px-4 py-4 space-y-4">
        {!email && (
          <div className="bg-gradient-to-br from-primary/8 to-accent/8 border border-primary/15 rounded-2xl p-5 text-center">
            <p className="text-2xl mb-2">{"📸"}</p>
            <p className="font-semibold text-sm mb-1">{"Meld dich an, um zu posten & zu liken"}</p>
            <p className="text-xs text-muted-foreground mb-3">{"Der Feed ist öffentlich – du kannst ohne Login alles lesen"}</p>
            <Link href="/profile" className="inline-flex text-xs font-bold text-white bg-gradient-to-r from-primary to-accent px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
              {"Anmelden"}
            </Link>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{"Feed wird geladen…"}</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-4xl">
              {"📸"}
            </div>
            <div>
              <p className="font-bold text-lg">{"Noch keine Beiträge"}</p>
              <p className="text-muted-foreground text-sm mt-1">{"Sei der Erste und teile dein Food-Erlebnis!"}</p>
            </div>
            {email && (
              <button
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:opacity-90"
                onClick={() => setShowCreatePost(true)}
              >
                <Camera className="w-4 h-4" /> {"Ersten Post erstellen"}
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
              onLike={() => {}}
              onOpenComments={(id) => setCommentPostId(id)}
            />
          ))
        )}
      </div>

      {/* Floating create button (mobile) */}
      {email && posts.length > 0 && (
        <button
          className="fixed bottom-24 right-4 z-20 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          onClick={() => setShowCreatePost(true)}
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Comment sheet */}
      {commentPostId !== null && (
        <CommentSheet
          postId={commentPostId}
          postOwner={posts.find((p: any) => p.id === commentPostId)?.user_email || ""}
          email={email}
          userName={userName}
          userPhoto={userPhoto}
          onClose={() => setCommentPostId(null)}
        />
      )}

      {/* Create post modal */}
      {showCreatePost && email && (
        <CreatePostModal
          email={email}
          userName={userName}
          userPhoto={userPhoto}
          onClose={() => setShowCreatePost(false)}
          onCreated={() => refetch()}
        />
      )}
    </div>
  );
}
