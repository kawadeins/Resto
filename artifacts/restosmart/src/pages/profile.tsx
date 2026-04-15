import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getCsrfToken } from "@workspace/api-client-react";
import { useSession } from "@/contexts/session-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Video, Instagram, Facebook, Globe, MapPin, Mail, Phone,
  Plus, X, Upload, Save, Eye, Star, Image as ImageIcon, ExternalLink,
  Loader2, Trash2, Link2
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface RestaurantProfile {
  id: number;
  name: string;
  cuisine: string;
  cuisineEmoji: string;
  description: string;
  about: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  heroImage: string;
  photos: string[];
  videoUrl: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  website: string;
  googleMapsUrl: string;
  tags: string[];
  priceRange: number;
  openTime: string;
  closeTime: string;
  openDays: string[];
  lat: number;
  lng: number;
}

function useProfile() {
  return useQuery<RestaurantProfile>({
    queryKey: ["profile"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/profile`);
      if (!r.ok) throw new Error("Failed to load profile");
      return r.json();
    },
  });
}

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const csrfToken = getCsrfToken();
  const csrfHeaders: Record<string, string> = csrfToken ? { "X-CSRF-Token": csrfToken } : {};
  const r = await fetch(`${API_BASE}/api/profile/upload`, {
    method: "POST",
    credentials: "include",
    headers: csrfHeaders,
    body: fd,
  });
  if (!r.ok) throw new Error("Upload failed");
  const { url } = await r.json();
  return `${API_BASE}${url}`;
}

function ImageUploadZone({
  value,
  onChange,
  label,
  aspectClass = "aspect-video",
  className = "",
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  aspectClass?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      onChange(url);
    } catch {
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`relative group ${className}`}>
      <div
        className={`${aspectClass} rounded-xl border-2 border-dashed border-border bg-muted/30 overflow-hidden cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50`}
        onClick={() => inputRef.current?.click()}
      >
        {value ? (
          <>
            <img src={value} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-8 h-8 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-4">
            {uploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            ) : (
              <>
                <Upload className="w-8 h-8" />
                <span className="text-sm font-medium text-center">{label}</span>
                <span className="text-xs opacity-60">Klicken oder Bild hierher ziehen</span>
              </>
            )}
          </div>
        )}
        {uploading && value && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(""); }}
          className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function GalleryManager({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const MAX = 5;

  const handleFiles = async (files: FileList) => {
    const remaining = MAX - photos.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (!toUpload.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(toUpload.map(uploadFile));
      onChange([...photos, ...urls]);
    } catch {
    } finally {
      setUploading(false);
    }
  };

  const remove = (idx: number) => {
    const next = photos.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {photos.map((url, idx) => (
          <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-border">
            <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
              {idx + 1}
            </div>
          </div>
        ))}
        {photos.length < MAX && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Plus className="w-6 h-6" />
                <span className="text-[11px] font-medium">{t("common.add")}</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">
        {photos.length}/{MAX} {t("profile.photos_hint")}
      </p>
    </div>
  );
}

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1.5 pr-1">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}>
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={t("profile.tag_add_placeholder")}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!input.trim()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ProfilePage() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { csrfToken } = useSession();
  const [form, setForm] = useState<Partial<RestaurantProfile>>({});
  const [initialized, setInitialized] = useState(false);

  if (profile && !initialized) {
    setForm({ ...profile });
    setInitialized(true);
  }

  const set = useCallback(<K extends keyof RestaurantProfile>(key: K, value: RestaurantProfile[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const save = useMutation({
    mutationFn: async (data: Partial<RestaurantProfile>) => {
      const csrfHdr = csrfToken ? { "X-CSRF-Token": csrfToken } : {};
      const r = await fetch(`${API_BASE}/api/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHdr },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: t("profile.save_success") });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("profile.save_error"), variant: "destructive" });
    },
  });

  const handleSave = () => save.mutate(form);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const f = form as RestaurantProfile;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("profile.page_title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("profile.page_subtitle")}
          </p>
        </div>
        <Button onClick={handleSave} disabled={save.isPending} size="lg" className="gap-2 shadow-lg shadow-primary/20">
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t("profile.save_btn")}
        </Button>
      </div>

      <Tabs defaultValue="basics" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="basics">{t("profile.tab_basics")}</TabsTrigger>
          <TabsTrigger value="media">{t("profile.tab_media")}</TabsTrigger>
          <TabsTrigger value="story">{t("profile.tab_story")}</TabsTrigger>
          <TabsTrigger value="links">{t("profile.tab_links")}</TabsTrigger>
        </TabsList>

        {/* ── TAB: Grunddaten ── */}
        <TabsContent value="basics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                {t("profile.section_core")}
              </CardTitle>
              <CardDescription>{t("profile.section_core_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("profile.label_restaurant_name")}</Label>
                  <Input
                    id="name"
                    value={f.name ?? ""}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="z.B. Ristorante Bella Italia"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuisine">{t("profile.label_cuisine")}</Label>
                  <Input
                    id="cuisine"
                    value={f.cuisine ?? ""}
                    onChange={(e) => set("cuisine", e.target.value)}
                    placeholder="z.B. Italienisch, Arabisch, Sushi…"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="emoji">{t("profile.label_emoji")}</Label>
                  <Input
                    id="emoji"
                    value={f.cuisineEmoji ?? ""}
                    onChange={(e) => set("cuisineEmoji", e.target.value)}
                    placeholder="🍝"
                    className="text-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priceRange">{t("profile.label_price_range")}</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => set("priceRange", p)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          f.priceRange === p
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {"€".repeat(p)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("profile.label_description")}</Label>
                <Textarea
                  id="description"
                  value={f.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder={t("profile.description_cta_placeholder")}
                  className="resize-none min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">{t("profile.chars_recommended", { count: (f.description ?? "").length })}</p>
              </div>

              <div className="space-y-2">
                <Label>{t("profile.label_tags")}</Label>
                <TagsInput tags={f.tags ?? []} onChange={(t) => set("tags", t)} />
                <p className="text-xs text-muted-foreground">{t("profile.tags_hint")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                {t("profile.section_location")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="address">{t("common.address")}</Label>
                  <Input
                    id="address"
                    value={f.address ?? ""}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder={t("profile.placeholder_street")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{t("profile.label_city")}</Label>
                  <Input
                    id="city"
                    value={f.city ?? ""}
                    onChange={(e) => set("city", e.target.value)}
                    placeholder={t("profile.placeholder_city")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("common.phone")}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      className="pl-9"
                      value={f.phone ?? ""}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="+43 1 12345678"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("common.email")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-9"
                      value={f.email ?? ""}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="info@meinrestaurant.de"
                    />
                  </div>
                </div>
              </div>

              <Separator />
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="lat">{t("profile.label_lat")}</Label>
                  <Input
                    id="lat"
                    type="number"
                    step="0.000001"
                    value={f.lat ?? ""}
                    onChange={(e) => set("lat", parseFloat(e.target.value) as any)}
                    placeholder="48.208174"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng">{t("profile.label_lng")}</Label>
                  <Input
                    id="lng"
                    type="number"
                    step="0.000001"
                    value={f.lng ?? ""}
                    onChange={(e) => set("lng", parseFloat(e.target.value) as any)}
                    placeholder="16.373819"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("profile.coords_hint")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("profile.section_opening")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="openTime">{t("profile.label_open_time")}</Label>
                  <Input
                    id="openTime"
                    type="time"
                    value={f.openTime ?? ""}
                    onChange={(e) => set("openTime", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="closeTime">{t("profile.label_close_time")}</Label>
                  <Input
                    id="closeTime"
                    type="time"
                    value={f.closeTime ?? ""}
                    onChange={(e) => set("closeTime", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("profile.label_open_days")}</Label>
                <div className="flex flex-wrap gap-2">
                  {ALL_DAYS.map((day) => {
                    const active = (f.openDays ?? []).includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const days = f.openDays ?? [];
                          set("openDays", active ? days.filter((d) => d !== day) : [...days, day]);
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {({ Monday: t("staff.day_monday"), Tuesday: t("staff.day_tuesday"), Wednesday: t("staff.day_wednesday"), Thursday: t("staff.day_thursday"), Friday: t("staff.day_friday"), Saturday: t("staff.day_saturday"), Sunday: t("staff.day_sunday") } as Record<string, string>)[day] ?? day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Medien ── */}
        <TabsContent value="media" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                {t("profile.section_hero_image")}
              </CardTitle>
              <CardDescription>{t("profile.hero_image_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUploadZone
                value={f.heroImage ?? ""}
                onChange={(url) => set("heroImage", url)}
                label={t("profile.upload_hero_btn")}
                aspectClass="aspect-[16/7]"
              />
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground mb-1 block">{t("profile.or_url")}</Label>
                <Input
                  value={f.heroImage ?? ""}
                  onChange={(e) => set("heroImage", e.target.value)}
                  placeholder="https://images.unsplash.com/…"
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" />
                {t("profile.section_gallery")}
              </CardTitle>
              <CardDescription>{t("profile.gallery_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <GalleryManager photos={f.photos ?? []} onChange={(p) => set("photos", p)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                {t("profile.section_video")}
              </CardTitle>
              <CardDescription>{t("profile.video_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="videoUrl">{t("profile.label_video_url")}</Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="videoUrl"
                    className="pl-9"
                    value={f.videoUrl ?? ""}
                    onChange={(e) => set("videoUrl", e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=… oder direkte MP4-URL"
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t("profile.video_formats")}</p>
              </div>

              {f.videoUrl && (
                <div className="rounded-xl overflow-hidden bg-muted aspect-video">
                  {f.videoUrl.includes("youtube.com") || f.videoUrl.includes("youtu.be") ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYouTubeId(f.videoUrl)}`}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  ) : f.videoUrl.includes("vimeo.com") ? (
                    <iframe
                      src={`https://player.vimeo.com/video/${f.videoUrl.split("/").pop()}`}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  ) : (
                    <video src={f.videoUrl} controls className="w-full h-full object-cover" />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Geschichte ── */}
        <TabsContent value="story" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                {t("profile.section_story")}
              </CardTitle>
              <CardDescription>{t("profile.story_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={f.about ?? ""}
                onChange={(e) => set("about", e.target.value)}
                placeholder={t("profile.story_placeholder")}
                className="min-h-[280px] resize-none text-base leading-relaxed"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("profile.story_tip")}</span>
                <span>{t("profile.story_chars", { count: (f.about ?? "").length })}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Links ── */}
        <TabsContent value="links" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                {t("profile.section_links")}
              </CardTitle>
              <CardDescription>{t("profile.links_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-pink-500" />
                    Instagram
                  </Label>
                  <Input
                    id="instagram"
                    value={f.instagram ?? ""}
                    onChange={(e) => set("instagram", e.target.value)}
                    placeholder="https://instagram.com/meinrestaurant"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facebook" className="flex items-center gap-2">
                    <Facebook className="w-4 h-4 text-blue-600" />
                    Facebook
                  </Label>
                  <Input
                    id="facebook"
                    value={f.facebook ?? ""}
                    onChange={(e) => set("facebook", e.target.value)}
                    placeholder="https://facebook.com/meinrestaurant"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tiktok" className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">TikTok</span>
                  </Label>
                  <Input
                    id="tiktok"
                    value={f.tiktok ?? ""}
                    onChange={(e) => set("tiktok", e.target.value)}
                    placeholder="https://tiktok.com/@meinrestaurant"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website" className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    Website
                  </Label>
                  <Input
                    id="website"
                    value={f.website ?? ""}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="https://meinrestaurant.de"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="googleMaps" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-500" />
                    Google Maps Link
                  </Label>
                  <Input
                    id="googleMaps"
                    value={f.googleMapsUrl ?? ""}
                    onChange={(e) => set("googleMapsUrl", e.target.value)}
                    placeholder="https://maps.google.com/?q=Mein+Restaurant+Wien"
                  />
                  <p className="text-xs text-muted-foreground">{t("profile.google_maps_hint")}</p>
                </div>
              </div>

              {/* Preview of links */}
              {(f.instagram || f.facebook || f.tiktok || f.website || f.googleMapsUrl) && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-3 text-muted-foreground">{t("profile.link_preview")}</p>
                    <div className="flex flex-wrap gap-3">
                      {f.instagram && (
                        <a href={f.instagram} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-pink-200 bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors text-sm font-medium">
                          <Instagram className="w-4 h-4" />
                          Instagram
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {f.facebook && (
                        <a href={f.facebook} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium">
                          <Facebook className="w-4 h-4" />
                          Facebook
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {f.tiktok && (
                        <a href={f.tiktok} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted text-foreground hover:bg-muted/80 transition-colors text-sm font-medium">
                          <span className="font-bold text-xs">TT</span>
                          TikTok
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {f.website && (
                        <a href={f.website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-sm font-medium">
                          <Globe className="w-4 h-4" />
                          Website
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {f.googleMapsUrl && (
                        <a href={f.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-sm font-medium">
                          <MapPin className="w-4 h-4" />
                          Google Maps
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Floating save bar */}
      <div className="fixed bottom-6 right-6 z-50 md:right-8">
        <Button
          onClick={handleSave}
          disabled={save.isPending}
          size="lg"
          className="gap-2 shadow-xl shadow-primary/30 rounded-full px-6"
        >
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Profil speichern
        </Button>
      </div>
    </div>
  );
}

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return match?.[1] ?? "";
}
