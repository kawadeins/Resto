/**
 * Public Profile Page — /u/:userEmail
 * Shows ONLY public-safe data. Enforces is_private server-side.
 * Used when tapping an author from the social feed.
 */
import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, MapPin, Grid3X3, MessageCircle, Heart,
  ImageOff, UserPlus, UserCheck, Clock, Lock, Send
} from "lucide-react";
import { useSeo } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const GRAD = "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))";

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ photoUrl, name, size = "lg" }: { photoUrl?: string | null; name: string; size?: "sm" | "lg" }) {
  const [err, setErr] = useState(false);
  const dim = size === "lg" ? "w-24 h-24" : "w-10 h-10";
  const txt = size === "lg" ? "text-3xl" : "text-sm";
  const initials = name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase() || "?";

  if (photoUrl && !err) {
    const src = photoUrl.startsWith("/api") ? `${API_BASE}${photoUrl}` : photoUrl;
    return (
      <img
        src={src} alt={name} onError={() => setErr(true)}
        className={`${dim} rounded-full object-cover border-2 border-white/80 shadow-md`}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full flex items-center justify-center border-2 border-white/30 shadow-md`} style={{ background: GRAD }}>
      <span className={`font-bold text-white ${txt}`}>{initials}</span>
    </div>
  );
}

// ── Level Badge ────────────────────────────────────────────────────────────────
function LevelBadge({ postCount }: { postCount: number }) {
  const level = postCount >= 50 ? "Gold" : postCount >= 20 ? "Silver" : "Bronze";
  const emoji = level === "Gold" ? "⭐" : level === "Silver" ? "🥈" : "🥉";
  const color = level === "Gold" ? "hsl(45,90%,50%)" : level === "Silver" ? "hsl(220,15%,55%)" : "hsl(30,60%,55%)";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: `${color}18`, color }}>
      {emoji} {level}
    </span>
  );
}

// ── Post Grid Item ─────────────────────────────────────────────────────────────
function PostGridItem({ post }: { post: PublicPost }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const src = post.image_url?.startsWith("/api") ? `${API_BASE}${post.image_url}` : post.image_url;

  return (
    <div className="relative aspect-square bg-muted/30 overflow-hidden rounded-xl group cursor-pointer">
      {!imgErr && src ? (
        <>
          {!imgLoaded && <div className="absolute inset-0 bg-muted/40 animate-pulse" />}
          <img
            src={src} alt="" loading="lazy"
            className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImgLoaded(true)} onError={() => setImgErr(true)}
          />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageOff className="w-5 h-5 text-muted-foreground/30" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
        <span className="flex items-center gap-1 text-white text-xs font-bold"><Heart className="w-4 h-4 fill-white" /> {post.like_count ?? 0}</span>
        <span className="flex items-center gap-1 text-white text-xs font-bold"><MessageCircle className="w-4 h-4 fill-white" /> {post.comment_count ?? 0}</span>
      </div>
    </div>
  );
}

// ── Friend Button ──────────────────────────────────────────────────────────────
function FriendButton({ viewerEmail, targetEmail, status, onStatusChange }: {
  viewerEmail: string; targetEmail: string;
  status: FriendshipStatus; onStatusChange: (s: FriendshipStatus) => void;
}) {
  const { toast } = useToast();

  const sendRequest = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/api/social/request`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterEmail: viewerEmail, recipientEmail: targetEmail }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Fehler");
      return r.json();
    },
    onSuccess: () => onStatusChange("pending_sent"),
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  if (status === "accepted") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-2xl">
          <UserCheck className="w-4 h-4" /> {"Befreundet"}
        </span>
      </div>
    );
  }

  if (status === "pending_sent") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground bg-muted/50 px-4 py-2 rounded-2xl">
        <Clock className="w-4 h-4" /> {"Anfrage gesendet"}
      </span>
    );
  }

  if (status === "pending_received") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/10 px-4 py-2 rounded-2xl">
        <Clock className="w-4 h-4" /> {"Anfrage erhalten"}
      </span>
    );
  }

  return (
    <button
      onClick={() => sendRequest.mutate()}
      disabled={sendRequest.isPending}
      className="flex items-center gap-1.5 text-sm font-bold text-white px-5 py-2.5 rounded-2xl active:scale-95 transition-all disabled:opacity-60"
      style={{ background: GRAD }}
    >
      <UserPlus className="w-4 h-4" /> {"Freund hinzufügen"}
    </button>
  );
}

// ── Message Button ─────────────────────────────────────────────────────────────
interface ConvSummary { id: number; type: string; unread_count: number; participants: { user_email: string }[] }

function MessageButton({ viewerEmail, targetEmail, status }: {
  viewerEmail: string; targetEmail: string; status: FriendshipStatus;
}) {
  const { toast } = useToast();
  const isFriends = status === "accepted";
  const isPending = status === "pending_sent" || status === "pending_received";

  // Fetch conversations only when friends to find unread count
  const { data: conversations = [] } = useQuery<ConvSummary[]>({
    queryKey: ["conversations", viewerEmail],
    queryFn: () =>
      fetch(`${API_BASE}/api/messages/conversations/${encodeURIComponent(viewerEmail)}`, { credentials: "include" })
        .then(r => r.json()),
    enabled: isFriends && !!viewerEmail,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const unreadCount = isFriends
    ? (conversations.find(c =>
        c.type === "direct" &&
        c.participants.some(p => p.user_email === targetEmail)
      )?.unread_count ?? 0)
    : 0;

  const startDM = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/api/messages/start-dm`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderEmail: viewerEmail, recipientEmail: targetEmail }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Fehler");
      return r.json();
    },
    onSuccess: (d) => {
      window.location.href = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/messages/${d.conversationId}`;
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  if (isFriends) {
    return (
      <button
        onClick={() => startDM.mutate()}
        disabled={startDM.isPending}
        className="relative flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-2xl transition-all active:scale-[0.97] disabled:opacity-60 border"
        style={{
          background: "rgba(120, 60, 220, 0.08)",
          borderColor: "hsl(263 70% 52% / 0.35)",
          color: "hsl(263, 70%, 48%)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 1px 10px hsl(263 70% 52% / 0.12)",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 18px hsl(263 70% 52% / 0.25)";
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 1px 10px hsl(263 70% 52% / 0.12)";
          (e.currentTarget as HTMLButtonElement).style.transform = "";
        }}
      >
        <Send className="w-4 h-4" /> {"Chat öffnen"}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    );
  }

  // Disabled state — not yet friends or pending
  const label = isPending ? "Anfrage ausstehend" : "Nachricht senden";
  return (
    <button
      disabled
      title={"Nachricht erst nach Annahme möglich"}
      className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-2xl border cursor-not-allowed select-none"
      style={{
        opacity: 0.55,
        background: "hsl(var(--muted) / 0.4)",
        borderColor: "hsl(var(--border))",
        color: "hsl(var(--muted-foreground))",
      }}
    >
      <Send className="w-4 h-4" /> {label}
    </button>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "accepted";

interface PublicPost {
  id: number; image_url: string; caption: string | null;
  restaurant_name: string | null; created_at: string;
  like_count: number; comment_count: number;
}

interface PublicProfileData {
  name: string | null; photoUrl: string | null;
  bio: string | null; city: string | null; country: string | null;
  isPrivate: boolean; postCount: number; posts: PublicPost[];
  friendshipStatus: FriendshipStatus;
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PublicProfilePage() {
  const [, params] = useRoute("/u/:userEmail");
  const userEmail = params?.userEmail ? decodeURIComponent(params.userEmail) : "";
  const currentEmail = localStorage.getItem("restosmart_email") ?? "";

  const [friendStatus, setFriendStatus] = useState<FriendshipStatus>("none");

  // Redirect to own profile if viewing self
  useEffect(() => {
    if (userEmail && currentEmail && userEmail.toLowerCase() === currentEmail.toLowerCase()) {
      window.location.replace(import.meta.env.BASE_URL.replace(/\/$/, "") + "/profile");
    }
  }, [userEmail, currentEmail]);

  const { data, isLoading, isError } = useQuery<PublicProfileData>({
    queryKey: ["public-profile", userEmail, currentEmail],
    queryFn: async () => {
      const qs = currentEmail ? `?viewer=${encodeURIComponent(currentEmail)}` : "";
      const r = await fetch(`${API_BASE}/api/public-profile/${encodeURIComponent(userEmail)}${qs}`);
      if (!r.ok) throw new Error("not found");
      return r.json();
    },
    enabled: !!userEmail,
  });

  useEffect(() => {
    if (data?.friendshipStatus) setFriendStatus(data.friendshipStatus);
  }, [data?.friendshipStatus]);

  useSeo({ title: data?.name ? `${data.name} – RestoSmart` : "Profil – RestoSmart", description: data?.bio ?? "RestoSmart Nutzerprofil" });

  const displayName = data?.name || userEmail.split("@")[0] || "Nutzer";

  return (
    <div className="min-h-screen pb-28" style={{ background: "hsl(var(--background))" }}>

      {/* ── Top nav ── */}
      <div
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3.5"
        style={{ background: "hsl(var(--background)/0.92)", backdropFilter: "blur(14px)" }}
      >
        <button
          onClick={() => window.history.back()}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="font-bold text-base truncate">{displayName}</p>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="px-4 pt-6 space-y-5">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-muted/50 animate-pulse" />
            <div className="h-5 w-32 rounded-lg bg-muted/50 animate-pulse" />
            <div className="h-3.5 w-48 rounded-lg bg-muted/40 animate-pulse" />
          </div>
          <div className="grid grid-cols-3 gap-1 mt-6">
            {Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-square rounded-xl bg-muted/40 animate-pulse" />)}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <div className="flex flex-col items-center justify-center pt-24 px-8 text-center">
          <p className="text-4xl mb-4">{"👤"}</p>
          <p className="font-bold text-lg mb-1">{"Profil nicht gefunden"}</p>
          <p className="text-sm text-muted-foreground mb-6">{"Dieses Profil existiert nicht oder ist nicht öffentlich."}</p>
          <button onClick={() => window.history.back()} className="text-sm text-primary hover:underline">{"← Zurück"}</button>
        </div>
      )}

      {/* ── Profile content ── */}
      {data && !isLoading && (
        <>
          {/* ── Hero ── */}
          <div className="flex flex-col items-center px-5 pt-6 pb-5 text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-full blur-xl opacity-30 scale-110" style={{ background: GRAD }} />
              <div className="relative">
                <Avatar photoUrl={data.photoUrl} name={displayName} size="lg" />
              </div>
            </div>

            <h1 className="text-xl font-black tracking-tight mb-0.5">{displayName}</h1>

            {(data.city || data.country) && !data.isPrivate && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {[data.city, data.country].filter(Boolean).join(", ")}
              </p>
            )}

            {!data.isPrivate && <div className="mt-2"><LevelBadge postCount={data.postCount} /></div>}

            {data.bio && !data.isPrivate && (
              <p className="text-sm text-foreground/80 mt-3 max-w-xs leading-relaxed">{data.bio}</p>
            )}

            {/* Action buttons */}
            {currentEmail && currentEmail !== userEmail && (
              <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
                <FriendButton
                  viewerEmail={currentEmail}
                  targetEmail={userEmail}
                  status={friendStatus}
                  onStatusChange={setFriendStatus}
                />
                <MessageButton
                  viewerEmail={currentEmail}
                  targetEmail={userEmail}
                  status={friendStatus}
                />
              </div>
            )}

            {!data.isPrivate && (
              <div className="mt-4 flex items-center gap-1.5 text-sm">
                <Grid3X3 className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold">{data.postCount}</span>
                <span className="text-muted-foreground">{"Beiträge"}</span>
              </div>
            )}
          </div>

          {/* ── Private profile lock screen ── */}
          {data.isPrivate && friendStatus !== "accepted" ? (
            <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-bold text-base mb-1">{"Privates Profil"}</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                {"Dieses Profil ist privat. Füge "}
                {displayName}
                {" als Freund hinzu, um Beiträge zu sehen."}
              </p>
            </div>
          ) : (
            <>
              <div className="h-px bg-border/60 mx-4 mb-4" />
              {data.posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                  <p className="text-4xl mb-3">{"📸"}</p>
                  <p className="font-bold text-base mb-1">{"Noch keine Beiträge"}</p>
                  <p className="text-sm text-muted-foreground">{"Dieser Nutzer hat noch nichts gepostet."}</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 px-1 pb-4">
                  {data.posts.map(post => <PostGridItem key={post.id} post={post} />)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
