import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/contexts/session-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListReservations,
  getListReservationsQueryKey,
  usePatchReservationStatus,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Users, Clock, MessageSquare, CheckCircle2, XCircle, ChevronRight,
  Search, Plus, Share2, Copy, Mail, Send, Eye, EyeOff, Archive, Star,
  ClipboardList, Pencil, Trash2, FileCheck2, Files, X, Zap, Target,
  Instagram, Facebook, ChevronDown, Lock, Globe, Shield,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient as useQC } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Reservation helpers ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { className: string }> = {
  pending: { className: "text-amber-500 border-amber-500/30 bg-amber-500/5" },
  confirmed: { className: "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" },
  rejected: { className: "text-rose-500 border-rose-500/30 bg-rose-500/5" },
  arrived: { className: "text-blue-500 border-blue-500/30 bg-blue-500/5" },
  cancelled: { className: "text-muted-foreground border-border bg-muted/20" },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <Badge variant="outline" className={`text-xs ${cfg.className}`}>
      {t("bookings.status_" + status)}
    </Badge>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
}

// ─── Booking Plan types & helpers ──────────────────────────────────────────────

interface BookingPlan {
  id: number;
  restaurantId: number;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  targetAudience: string;
  status: "draft" | "active" | "finalized" | "archived";
  visibility: "private" | "team" | "public";
  minCovers: number | null;
  maxCovers: number | null;
  notes: string | null;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const PLAN_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Star }> = {
  draft: { label: "Entwurf", color: "text-slate-400 border-slate-500/30 bg-slate-500/5", icon: ClipboardList },
  active: { label: "Aktiv", color: "text-emerald-500 border-emerald-500/30 bg-emerald-500/5", icon: Zap },
  finalized: { label: "Abgeschlossen", color: "text-primary border-primary/30 bg-primary/5", icon: FileCheck2 },
  archived: { label: "Archiviert", color: "text-muted-foreground border-border bg-muted/10", icon: Archive },
};

const VISIBILITY_CONFIG: Record<string, { label: string; icon: typeof Globe }> = {
  private: { label: "Privat", icon: Lock },
  team: { label: "Team", icon: Shield },
  public: { label: "Öffentlich", icon: Globe },
};

const AUDIENCE_OPTIONS = [
  "Allgemein", "VIP-Gäste", "Stammkunden", "Firmenveranstaltung",
  "Privatfeier", "Gruppenreservierung", "Walk-in", "Sonderveranstaltung",
];

const TAGS_SUGGESTIONS = [
  "Wochenende", "Sondermenü", "Livemusik", "Vollbesetzt", "Priorität",
  "Nachverfolgung nötig", "Happy Hour", "Tasting-Menü",
];

const emptyPlan = (): Partial<BookingPlan> => ({
  title: "",
  description: "",
  date: new Date().toISOString().split("T")[0],
  startTime: "18:00",
  endTime: "23:00",
  targetAudience: "Allgemein",
  status: "draft",
  visibility: "team",
  minCovers: undefined,
  maxCovers: undefined,
  notes: "",
  tags: [],
  createdBy: "Manager",
});

// ─── Share Card ─────────────────────────────────────────────────────────────────

function ShareCard({ plan }: { plan: BookingPlan }) {
  const statusCfg = PLAN_STATUS_CONFIG[plan.status];
  const dateFormatted = new Date(plan.date + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0f0a1e 0%, #1a0d36 50%, #0f0a1e 100%)",
        border: "1px solid rgba(139,92,246,0.2)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: 4, background: "linear-gradient(90deg, #8b5cf6, #ec4899, #8b5cf6)" }} />

      <div style={{ padding: "28px 32px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "white",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
            </div>
            <span style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>RestoSmart</span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600, color: "#a78bfa",
            background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: 20, padding: "3px 10px", letterSpacing: "0.05em", textTransform: "uppercase",
          }}>
            Buchungsplan
          </span>
        </div>

        {/* Title */}
        <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          {plan.title}
        </h2>
        {plan.description && (
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 }}>
            {plan.description}
          </p>
        )}

        {/* Key info grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20,
        }}>
          {[
            { label: "Datum", value: dateFormatted },
            { label: "Zeitraum", value: `${plan.startTime} – ${plan.endTime} Uhr` },
            { label: "Zielgruppe", value: plan.targetAudience },
            { label: "Kapazität", value: plan.maxCovers ? `max. ${plan.maxCovers} Gäste` : "Nicht festgelegt" },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 600, marginBottom: 3, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</p>
              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600, margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        {plan.tags && plan.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {plan.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 11, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)",
                borderRadius: 20, padding: "3px 10px", border: "1px solid rgba(255,255,255,0.08)",
              }}>{tag}</span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
            Erstellt von {plan.createdBy}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: plan.status === "finalized" ? "#a78bfa" : "rgba(255,255,255,0.4)",
            background: plan.status === "finalized" ? "rgba(139,92,246,0.1)" : "transparent",
            border: plan.status === "finalized" ? "1px solid rgba(139,92,246,0.2)" : "none",
            borderRadius: 20, padding: plan.status === "finalized" ? "2px 8px" : 0,
          }}>
            {PLAN_STATUS_CONFIG[plan.status]?.label ?? plan.status}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Share Modal ────────────────────────────────────────────────────────────────

function ShareModal({ plan, onClose }: { plan: BookingPlan; onClose: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const summaryText = `📋 Buchungsplan: ${plan.title}
📅 Datum: ${new Date(plan.date + "T00:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
🕐 Zeitraum: ${plan.startTime} – ${plan.endTime} Uhr
👥 Zielgruppe: ${plan.targetAudience}${plan.maxCovers ? `\n🪑 Kapazität: max. ${plan.maxCovers} Gäste` : ""}${plan.description ? `\n\n${plan.description}` : ""}${plan.notes ? `\n\n📝 Notizen: ${plan.notes}` : ""}
${plan.tags?.length ? `\n🏷️ ${plan.tags.join(" · ")}` : ""}
— RestoSmart · Buchungsplanung`.trim();

  const emailSubject = encodeURIComponent(`Buchungsplan: ${plan.title}`);
  const emailBody = encodeURIComponent(summaryText);
  const whatsappText = encodeURIComponent(summaryText);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      toast({ title: t("bookings.copied"), description: t("bookings.copied_desc") });
    } catch {
      toast({ title: t("bookings.copy_error_title"), description: t("bookings.copy_error"), variant: "destructive" });
    }
  };

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" />
          {t("bookings.share_modal_title")}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-5 pt-2">
        {/* Share actions */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-primary/30 transition-all group cursor-pointer text-center"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <Mail className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-foreground">{t("bookings.share_email")}</span>
            <span className="text-[10px] text-muted-foreground">{t("bookings.share_email_desc")}</span>
          </a>

          <button
            onClick={copyToClipboard}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-primary/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <Copy className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-foreground">{t("bookings.share_copy")}</span>
            <span className="text-[10px] text-muted-foreground">{t("bookings.share_copy_desc")}</span>
          </button>

          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-primary/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center group-hover:bg-[#25D366]/20 transition-colors">
              <Send className="h-5 w-5 text-[#25D366]" />
            </div>
            <span className="text-xs font-semibold text-foreground">WhatsApp</span>
            <span className="text-[10px] text-muted-foreground">{t("bookings.share_whatsapp_desc")}</span>
          </a>

          <button
            onClick={copyToClipboard}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-primary/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center group-hover:from-purple-500/20 group-hover:to-pink-500/20 transition-colors">
              <Instagram className="h-5 w-5 text-pink-400" />
            </div>
            <span className="text-xs font-semibold text-foreground">{t("bookings.share_instagram")}</span>
            <span className="text-[10px] text-muted-foreground">{t("bookings.share_instagram_desc")}</span>
          </button>
        </div>

        {/* Visual share card */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("bookings.share_card_title")}</p>
            <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{t("bookings.share_card_desc")}</span>
          </div>
          <ShareCard plan={plan} />
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            {t("bookings.share_card_screenshot_hint")}
          </p>
        </div>

        {/* Raw text summary */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("bookings.share_text_label")}</p>
          <div className="relative">
            <pre className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-4 whitespace-pre-wrap border border-border/40 leading-relaxed max-h-40 overflow-y-auto font-mono">
              {summaryText}
            </pre>
            <button
              onClick={copyToClipboard}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              title="Kopieren"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}

// ─── Plan Editor Modal ──────────────────────────────────────────────────────────

function PlanEditorModal({
  plan,
  onClose,
  onSave,
  isSaving,
}: {
  plan: Partial<BookingPlan>;
  onClose: () => void;
  onSave: (data: Partial<BookingPlan>) => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Partial<BookingPlan>>(plan);
  const [tagInput, setTagInput] = useState("");

  const update = (field: keyof BookingPlan, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !(form.tags ?? []).includes(trimmed)) {
      update("tags", [...(form.tags ?? []), trimmed]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) =>
    update("tags", (form.tags ?? []).filter((v) => v !== tag));

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          {plan.id ? t("common.edit") : t("bookings.new_plan")}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6 pt-2">
        {/* Title + Description */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("bookings.form_title_label")}</Label>
            <Input
              placeholder={t("bookings.form_title_placeholder")}
              value={form.title ?? ""}
              onChange={(e) => update("title", e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("bookings.form_desc_label")}</Label>
            <Textarea
              placeholder={t("bookings.form_desc_placeholder")}
              value={form.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
              className="text-sm resize-none min-h-[72px]"
            />
          </div>
        </div>

        {/* Date & Time */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("bookings.form_datetime_section")}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-3 sm:col-span-1">
              <Label className="text-xs text-muted-foreground">{t("bookings.form_date_label")}</Label>
              <Input
                type="date"
                value={form.date ?? ""}
                onChange={(e) => update("date", e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("bookings.form_start_label")}</Label>
              <Input
                type="time"
                value={form.startTime ?? "18:00"}
                onChange={(e) => update("startTime", e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("bookings.form_end_label")}</Label>
              <Input
                type="time"
                value={form.endTime ?? "23:00"}
                onChange={(e) => update("endTime", e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* Covers */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("bookings.form_covers_section")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("bookings.form_min_covers")}</Label>
              <Input
                type="number"
                placeholder="z.B. 10"
                value={form.minCovers ?? ""}
                onChange={(e) => update("minCovers", e.target.value ? parseInt(e.target.value) : undefined)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("bookings.form_max_covers")}</Label>
              <Input
                type="number"
                placeholder="z.B. 80"
                value={form.maxCovers ?? ""}
                onChange={(e) => update("maxCovers", e.target.value ? parseInt(e.target.value) : undefined)}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* Target Audience, Status, Visibility */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("bookings.form_config_section")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("bookings.form_audience_label")}</Label>
              <Select value={form.targetAudience ?? "Allgemein"} onValueChange={(v) => update("targetAudience", v)}>
                <SelectTrigger className="text-sm h-9">
                  <Target className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("bookings.form_status_label")}</Label>
              <Select value={form.status ?? "draft"} onValueChange={(v) => update("status", v)}>
                <SelectTrigger className="text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("bookings.plan_status_draft")}</SelectItem>
                  <SelectItem value="active">{t("bookings.plan_status_active")}</SelectItem>
                  <SelectItem value="finalized">{t("bookings.plan_status_finalized")}</SelectItem>
                  <SelectItem value="archived">{t("bookings.plan_status_archived")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("bookings.form_visibility_label")}</Label>
              <Select value={form.visibility ?? "team"} onValueChange={(v) => update("visibility", v)}>
                <SelectTrigger className="text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">{t("bookings.form_visibility_private")}</SelectItem>
                  <SelectItem value="team">{t("bookings.form_visibility_team")}</SelectItem>
                  <SelectItem value="public">{t("bookings.form_visibility_public")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Created By */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("bookings.form_created_by_label")}</Label>
          <Input
            placeholder={t("bookings.form_created_by_placeholder")}
            value={form.createdBy ?? "Manager"}
            onChange={(e) => update("createdBy", e.target.value)}
            className="text-sm"
          />
        </div>

        {/* Tags */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("bookings.form_tags_label")}</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(form.tags ?? []).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-primary/60">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t("bookings.form_tag_placeholder")}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
              className="text-sm h-8"
            />
            <Button variant="outline" size="sm" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()} className="h-8 px-3">
              +
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {TAGS_SUGGESTIONS.filter((t) => !(form.tags ?? []).includes(t)).map((t) => (
              <button
                key={t}
                onClick={() => addTag(t)}
                className="text-[11px] px-2.5 py-0.5 rounded-full border border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                + {t}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("bookings.form_notes_label")}</Label>
          <Textarea
            placeholder={t("bookings.form_notes_placeholder")}
            value={form.notes ?? ""}
            onChange={(e) => update("notes", e.target.value)}
            className="text-sm resize-none min-h-[80px]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-border/40">
          <Button
            className="flex-1"
            onClick={() => onSave(form)}
            disabled={isSaving || !form.title?.trim() || !form.date}
          >
            {isSaving ? t("common.loading") : plan.id ? t("common.save") : t("bookings.new_plan")}
          </Button>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ─── Plan Card ──────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onEdit,
  onShare,
  onDuplicate,
  onDelete,
  onFinalize,
  onStatusChange,
}: {
  plan: BookingPlan;
  onEdit: () => void;
  onShare: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFinalize: () => void;
  onStatusChange: (s: BookingPlan["status"]) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "de" ? "de-AT" : i18n.language === "fr" ? "fr-FR" : i18n.language === "it" ? "it-IT" : i18n.language === "es" ? "es-ES" : i18n.language === "nl" ? "nl-NL" : i18n.language === "pt" ? "pt-PT" : i18n.language === "tr" ? "tr-TR" : i18n.language === "pl" ? "pl-PL" : "en-US";
  const statusCfg = PLAN_STATUS_CONFIG[plan.status] ?? PLAN_STATUS_CONFIG.draft;
  const visibilityCfg = VISIBILITY_CONFIG[plan.visibility] ?? VISIBILITY_CONFIG.team;
  const VisIcon = visibilityCfg.icon;
  const StatusIcon = statusCfg.icon;

  const dateFormatted = new Date(plan.date + "T00:00:00").toLocaleDateString(locale, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="group rounded-xl border border-border/50 bg-card/60 hover:bg-card hover:border-primary/20 transition-all p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant="outline" className={`text-xs gap-1 ${statusCfg.color}`}>
              <StatusIcon className="h-3 w-3" />
              {t("bookings.plan_status_" + plan.status)}
            </Badge>
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <VisIcon className="h-3 w-3" />
              {t("bookings.visibility_" + plan.visibility)}
            </span>
            {plan.tags?.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/40">
                {tag}
              </span>
            ))}
            {(plan.tags?.length ?? 0) > 2 && (
              <span className="text-[10px] text-muted-foreground">+{(plan.tags?.length ?? 0) - 2}</span>
            )}
          </div>

          <h3 className="font-semibold text-base text-foreground mb-1 leading-tight">{plan.title}</h3>
          {plan.description && (
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed line-clamp-2">{plan.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {dateFormatted}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {t("bookings.plan_time_uhr", { start: plan.startTime, end: plan.endTime })}
            </span>
            <span className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" />
              {plan.targetAudience}
            </span>
            {plan.maxCovers && (
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {t("bookings.plan_capacity_max", { count: plan.maxCovers })}
              </span>
            )}
          </div>

          {plan.notes && (
            <p className="mt-2 text-[11px] text-muted-foreground/70 italic border-l-2 border-border/40 pl-2 line-clamp-1">
              {plan.notes}
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {plan.status !== "finalized" && plan.status !== "archived" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={onFinalize}
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("bookings.plan_finalize_btn")}</span>
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onShare} title="Teilen">
            <Share2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onEdit} title="Bearbeiten">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onDuplicate} title="Duplizieren">
            <Files className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 border-rose-500/20 text-rose-400 hover:bg-rose-500/10"
            onClick={onDelete}
            title="Löschen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Booking Plans Tab ──────────────────────────────────────────────────────────

function BookingPlansTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { csrfToken } = useSession();
  const csrfHdr = csrfToken ? { "X-CSRF-Token": csrfToken } : {};
  const qc = useQC();

  const [editorOpen, setEditorOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<BookingPlan>>(emptyPlan());
  const [sharingPlan, setSharingPlan] = useState<BookingPlan | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const PLANS_KEY = ["booking-plans"];

  const { data: plans, isLoading } = useQuery<BookingPlan[]>({
    queryKey: PLANS_KEY,
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/booking-plans`);
      if (!r.ok) throw new Error("Fetch failed");
      return r.json();
    },
    refetchInterval: 60000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: PLANS_KEY });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<BookingPlan>) => {
      const url = data.id
        ? `${API_BASE}/api/booking-plans/${data.id}`
        : `${API_BASE}/api/booking-plans`;
      const method = data.id ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHdr },
        body: JSON.stringify({ ...data, tags: data.tags ?? [] }),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: editingPlan.id ? t("bookings.plan_updated") : t("bookings.plan_created") });
      invalidate();
      setEditorOpen(false);
    },
    onError: () => toast({ title: t("bookings.save_error"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API_BASE}/api/booking-plans/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { ...csrfHdr },
      });
      if (!r.ok) throw new Error("Delete failed");
    },
    onSuccess: () => { toast({ title: t("bookings.plan_deleted") }); invalidate(); },
    onError: () => toast({ title: t("bookings.delete_error"), variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API_BASE}/api/booking-plans/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
        headers: { ...csrfHdr },
      });
      if (!r.ok) throw new Error("Duplicate failed");
      return r.json();
    },
    onSuccess: () => { toast({ title: t("bookings.plan_duplicated") }); invalidate(); },
    onError: () => toast({ title: t("bookings.duplicate_error"), variant: "destructive" }),
  });

  const patchStatus = async (id: number, status: BookingPlan["status"]) => {
    const r = await fetch(`${API_BASE}/api/booking-plans/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...csrfHdr },
      body: JSON.stringify({ status }),
    });
    if (r.ok) { invalidate(); toast({ title: `${t("common.status")}: ${t("bookings.plan_status_" + status)}` }); }
  };

  const openCreate = () => { setEditingPlan(emptyPlan()); setEditorOpen(true); };
  const openEdit = (plan: BookingPlan) => { setEditingPlan(plan); setEditorOpen(true); };
  const openShare = (plan: BookingPlan) => { setSharingPlan(plan); setShareOpen(true); };

  const filtered = (plans ?? []).filter(
    (p) => statusFilter === "all" || p.status === statusFilter,
  );

  const stats = {
    total: (plans ?? []).length,
    active: (plans ?? []).filter((p) => p.status === "active").length,
    finalized: (plans ?? []).filter((p) => p.status === "finalized").length,
    draft: (plans ?? []).filter((p) => p.status === "draft").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("bookings.plans_stat_total"), value: stats.total, color: "text-foreground" },
          { label: t("bookings.plans_stat_active"), value: stats.active, color: "text-emerald-500" },
          { label: t("bookings.plans_stat_finalized"), value: stats.finalized, color: "text-primary" },
          { label: t("bookings.plans_stat_draft"), value: stats.draft, color: "text-slate-400" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Header + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">{t("bookings.plans_heading")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("bookings.plans_subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("bookings.filter_status_all")}</SelectItem>
              <SelectItem value="draft">{t("bookings.plan_status_draft")}</SelectItem>
              <SelectItem value="active">{t("bookings.plan_status_active")}</SelectItem>
              <SelectItem value="finalized">{t("bookings.plan_status_finalized")}</SelectItem>
              <SelectItem value="archived">{t("bookings.plan_status_archived")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate} className="h-9 gap-2 px-4">
            <Plus className="h-4 w-4" />
            {t("bookings.new_plan")}
          </Button>
        </div>
      </div>

      {/* Plan list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed border-border/40 rounded-xl">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">{t("bookings.no_plans")}</p>
          <p className="text-sm mt-1">{t("bookings.no_plans_desc")}</p>
          <Button variant="outline" onClick={openCreate} className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> {t("bookings.no_plans_cta")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={() => openEdit(plan)}
                onShare={() => openShare(plan)}
                onDuplicate={() => duplicateMutation.mutate(plan.id)}
                onDelete={() => deleteMutation.mutate(plan.id)}
                onFinalize={() => patchStatus(plan.id, "finalized")}
                onStatusChange={(s) => patchStatus(plan.id, s)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Editor Modal */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <PlanEditorModal
          plan={editingPlan}
          onClose={() => setEditorOpen(false)}
          onSave={(data) => saveMutation.mutate(data)}
          isSaving={saveMutation.isPending}
        />
      </Dialog>

      {/* Share Modal */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        {sharingPlan && <ShareModal plan={sharingPlan} onClose={() => setShareOpen(false)} />}
      </Dialog>
    </div>
  );
}

// ─── Main Bookings Page ─────────────────────────────────────────────────────────

export default function Bookings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);

  const params = dateFilter ? { date: dateFilter } : {};
  const { data: reservations, isLoading } = useListReservations({
    params,
    query: { queryKey: getListReservationsQueryKey(params), refetchInterval: 30000 },
  });

  const patchStatus = usePatchReservationStatus();

  const handleStatusChange = (id: number, status: "confirmed" | "rejected" | "arrived" | "cancelled" | "pending") => {
    patchStatus.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({ title: t("bookings.booking_marked_as", { status: t("bookings.status_" + status) }) });
          queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey(params) });
        },
        onError: () => toast({ title: t("bookings.booking_update_error"), variant: "destructive" }),
      }
    );
  };

  const filtered = reservations?.filter((r) => {
    const matchesSearch =
      !search ||
      r.customerName.toLowerCase().includes(search.toLowerCase()) ||
      r.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      r.customerPhone.includes(search);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) ?? [];

  const confirmed = filtered.filter((r) => r.status === "confirmed" || r.status === "arrived");
  const totalCoversConfirmed = confirmed.reduce((sum, r) => sum + r.partySize, 0);
  const expectedRevenue = totalCoversConfirmed * 35;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const twoHoursLater = nowMin + 120;
  const liveTraffic = filtered.filter((r) => {
    if (r.status === "rejected" || r.status === "cancelled") return false;
    const [h, m] = r.time.split(":").map(Number);
    const min = h * 60 + (m || 0);
    return min >= nowMin && min <= twoHoursLater;
  }).length;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("bookings.page_title")}</h2>
        <p className="text-muted-foreground mt-2">
          {t("bookings.page_subtitle")}
        </p>
      </div>

      <Tabs defaultValue="reservations">
        <TabsList className="mb-6">
          <TabsTrigger value="reservations" className="gap-2">
            <Calendar className="h-4 w-4" />
            {t("bookings.tab_reservations")}
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            {t("bookings.tab_booking_plans")}
          </TabsTrigger>
        </TabsList>

        {/* ── Reservations Tab ── */}
        <TabsContent value="reservations" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{t("bookings.stat_total_bookings")}</p>
                      <p className="text-2xl font-bold mt-1">{filtered.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("bookings.stat_for_date")}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-primary/30" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{t("bookings.stat_est_revenue")}</p>
                      <p className="text-2xl font-bold mt-1 text-emerald-500">
                        {expectedRevenue.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{t("bookings.stat_confirmed_guests", { count: totalCoversConfirmed })}</p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{t("bookings.stat_live_traffic")}</p>
                      <p className="text-2xl font-bold mt-1 text-blue-500">{liveTraffic}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("bookings.stat_live_traffic_desc")}</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500/30" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <CardTitle>{t("bookings.card_title_reservations")}</CardTitle>
                  <CardDescription>{t("bookings.card_desc_reservations")}</CardDescription>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("bookings.search_placeholder")}
                      className="pl-9 w-48"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Input
                    type="date"
                    className="w-40"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder={t("bookings.filter_status_all")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("bookings.filter_status_all")}</SelectItem>
                      <SelectItem value="pending">{t("bookings.filter_pending")}</SelectItem>
                      <SelectItem value="confirmed">{t("bookings.filter_confirmed")}</SelectItem>
                      <SelectItem value="arrived">{t("bookings.filter_arrived")}</SelectItem>
                      <SelectItem value="rejected">{t("bookings.filter_rejected")}</SelectItem>
                      <SelectItem value="cancelled">{t("bookings.filter_cancelled")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">{t("bookings.no_bookings_found")}</p>
                  <p className="text-sm mt-1">{t("bookings.no_bookings_hint")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {filtered.map((r) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border/40 bg-card/50 hover:bg-card/80 transition-colors"
                      >
                        <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div>
                            <p className="font-semibold text-sm">{r.customerName}</p>
                            <p className="text-xs text-muted-foreground">{r.customerPhone}</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span>{t("bookings.party_size", { count: r.partySize })}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span>{formatDate(r.date)} {t("bookings.time_at", { time: r.time })}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            {r.notes ? (
                              <>
                                <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{r.notes}</span>
                              </>
                            ) : (
                              <span className="italic opacity-50">{t("bookings.no_special_requests")}</span>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={r.status} />
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {r.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 px-3 text-xs"
                                onClick={() => handleStatusChange(r.id, "confirmed")}
                                disabled={patchStatus.isPending}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t("bookings.action_confirm_label")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10 h-8 px-3 text-xs"
                                onClick={() => handleStatusChange(r.id, "rejected")}
                                disabled={patchStatus.isPending}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> {t("bookings.action_reject_label")}
                              </Button>
                            </>
                          )}
                          {r.status === "confirmed" && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-500 text-white h-8 px-3 text-xs"
                              onClick={() => handleStatusChange(r.id, "arrived")}
                              disabled={patchStatus.isPending}
                            >
                              <ChevronRight className="h-3.5 w-3.5 mr-1" /> {t("bookings.action_arrived_label")}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Plans Tab ── */}
        <TabsContent value="plans">
          <BookingPlansTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
