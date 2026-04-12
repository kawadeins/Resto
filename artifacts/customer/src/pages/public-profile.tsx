/**
 * Public Profile Page — /u/:userEmail
 * Shows ONLY public-safe data. No private saves, plans, or preferences.
 * Used when tapping an author from the social feed.
 */
import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Grid3X3, MessageCircle, Heart, ImageOff } from "lucide-react";
import { useSeo } from "@/hooks/use-seo";

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
        src={src}
        alt={name}
        onError={() => setErr(true)}
        className={`${dim} rounded-full object-cover border-2 border-white/80 shadow-md`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center border-2 border-white/30 shadow-md`}
      style={{ background: GRAD }}
    >
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
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ background: `${color}18`, color }}
    >
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
            src={src}
            alt=""
            loading="lazy"
            className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgErr(true)}
          />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageOff className="w-5 h-5 text-muted-foreground/30" />
        </div>
      )}
      {/* Hover overlay with stats */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
        <span className="flex items-center gap-1 text-white text-xs font-bold">
          <Heart className="w-4 h-4 fill-white" /> {post.like_count ?? 0}
        </span>
        <span className="flex items-center gap-1 text-white text-xs font-bold">
          <MessageCircle className="w-4 h-4 fill-white" /> {post.comment_count ?? 0}
        </span>
      </div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface PublicPost {
  id: number;
  image_url: string;
  caption: string | null;
  restaurant_name: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
}

interface PublicProfileData {
  name: string | null;
  photoUrl: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  postCount: number;
  posts: PublicPost[];
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PublicProfilePage() {
  const [, params] = useRoute("/u/:userEmail");
  const userEmail = params?.userEmail ? decodeURIComponent(params.userEmail) : "";

  const currentEmail = localStorage.getItem("restosmart_email") ?? "";

  // Redirect to own profile if viewing self
  useEffect(() => {
    if (userEmail && currentEmail && userEmail.toLowerCase() === currentEmail.toLowerCase()) {
      window.location.replace(import.meta.env.BASE_URL.replace(/\/$/, "") + "/profile");
    }
  }, [userEmail, currentEmail]);

  const { data, isLoading, isError } = useQuery<PublicProfileData>({
    queryKey: ["public-profile", userEmail],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/public-profile/${encodeURIComponent(userEmail)}`);
      if (!r.ok) throw new Error("not found");
      return r.json();
    },
    enabled: !!userEmail,
  });

  useSeo({ title: data?.name ? `${data.name} – RestoSmart` : "Profil – RestoSmart" });

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
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <div className="flex flex-col items-center justify-center pt-24 px-8 text-center">
          <p className="text-4xl mb-4">{"👤"}</p>
          <p className="font-bold text-lg mb-1">{"Profil nicht gefunden"}</p>
          <p className="text-sm text-muted-foreground mb-6">{"Dieses Profil existiert nicht oder ist nicht öffentlich."}</p>
          <button onClick={() => window.history.back()} className="text-sm text-primary hover:underline">
            {"← Zurück"}
          </button>
        </div>
      )}

      {/* ── Profile content ── */}
      {data && !isLoading && (
        <>
          {/* ── Hero ── */}
          <div className="flex flex-col items-center px-5 pt-6 pb-5 text-center">
            <div className="relative mb-4">
              <div
                className="absolute inset-0 rounded-full blur-xl opacity-30 scale-110"
                style={{ background: GRAD }}
              />
              <div className="relative">
                <Avatar photoUrl={data.photoUrl} name={displayName} size="lg" />
              </div>
            </div>

            <h1 className="text-xl font-black tracking-tight mb-0.5">{displayName}</h1>

            {/* Location */}
            {(data.city || data.country) && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {[data.city, data.country].filter(Boolean).join(", ")}
              </p>
            )}

            {/* Level badge */}
            <div className="mt-2">
              <LevelBadge postCount={data.postCount} />
            </div>

            {/* Bio */}
            {data.bio && (
              <p className="text-sm text-foreground/80 mt-3 max-w-xs leading-relaxed">
                {data.bio}
              </p>
            )}

            {/* Post count stat */}
            <div className="mt-4 flex items-center gap-1.5 text-sm">
              <Grid3X3 className="w-4 h-4 text-muted-foreground" />
              <span className="font-bold">{data.postCount}</span>
              <span className="text-muted-foreground">{"Beiträge"}</span>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-border/60 mx-4 mb-4" />

          {/* ── Posts grid ── */}
          {data.posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <p className="text-4xl mb-3">{"📸"}</p>
              <p className="font-bold text-base mb-1">{"Noch keine Beiträge"}</p>
              <p className="text-sm text-muted-foreground">{"Dieser Nutzer hat noch nichts gepostet."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 px-1 pb-4">
              {data.posts.map(post => (
                <PostGridItem key={post.id} post={post} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
