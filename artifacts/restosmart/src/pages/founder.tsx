import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import PremiumConversionPanel from "@/components/premium-conversion-panel";
import VariantOptimizationPanel from "@/components/variant-optimization-panel";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info,
  RefreshCw, Shield, Lock, Eye, EyeOff, ArrowUpRight, ArrowDownRight,
  Zap, Users, Star, MapPin, BarChart3, DollarSign, Target, Rocket,
  Store, Coffee, Wine, UtensilsCrossed, Tag, Flag, Search, ChevronUp,
  ChevronDown, Activity, Flame, Crown, Award, AlertCircle, X,
  Phone, MessageSquare, Mail, ChevronRight, Filter, LayoutList,
  PhoneCall, CheckSquare, ClipboardList, Euro, Ban, Clock, Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = window.location.origin + "/api";
const FOUNDER_KEY_STORAGE = "restosmart_founder_key";
const CORRECT_KEY = "rs_founder_2026";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("de-DE", opts).format(n);
}

function fmtEur(cents: number) {
  return fmt(Math.round(cents / 100), { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function fmtEurDirect(eur: number) {
  return fmt(eur, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function pct(a: number, b: number) {
  if (!b) return "0,0%";
  return fmt((a / b) * 100, { maximumFractionDigits: 1 }) + "%";
}

const BIZ_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
};

const BIZ_ICONS: Record<string, typeof Store> = {
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  bar: Wine,
};

const BIZ_COLORS: Record<string, string> = {
  restaurant: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  cafe: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  bar: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

const BOOST_LABELS: Record<string, string> = {
  breakfast_boost: "Frühstücks-Boost",
  lunch_boost: "Mittags-Boost",
  happy_hour_boost: "Happy-Hour-Boost",
  nightlife_boost: "Nightlife-Boost",
  local_spotlight: "Local Spotlight",
  local_heat_boost: "Heat Boost",
};

// ─── Auth Gate ────────────────────────────────────────────────────────────────

function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [input, setInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  function submit() {
    if (input === CORRECT_KEY) {
      localStorage.setItem(FOUNDER_KEY_STORAGE, input);
      onAuth();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setTimeout(() => setError(false), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-900/60">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-[#080810]">
              <Shield className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Founder Command Center
          </h1>
          <p className="text-sm text-[#666]">
            Exklusiver Zugang — Gründer-Schlüssel erforderlich
          </p>
        </div>

        <motion.div
          animate={shake ? { x: [-8, 8, -6, 6, -4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="space-y-3"
        >
          <div className={cn(
            "relative rounded-2xl border transition-colors",
            error ? "border-red-500/60 bg-red-500/5" : "border-white/10 bg-white/4"
          )}>
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input
              type={showKey ? "text" : "password"}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="Founder-Schlüssel eingeben"
              className="w-full bg-transparent pl-11 pr-12 py-4 text-white text-sm outline-none placeholder:text-[#444]"
              autoFocus
            />
            <button
              onClick={() => setShowKey(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888] transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-400 text-center"
            >
              Ungültiger Schlüssel — Zugriff verweigert
            </motion.p>
          )}

          <button
            onClick={submit}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-violet-900/40"
          >
            Zugriff gewähren
          </button>
        </motion.div>

        <p className="text-center text-xs text-[#333] mt-6">
          Dieser Bereich ist ausschließlich für den Plattform-Gründer zugänglich.
        </p>
      </motion.div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, trend, icon: Icon, color = "violet", size = "normal"
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: { value: string; up: boolean } | null;
  icon: typeof TrendingUp;
  color?: "violet" | "emerald" | "amber" | "rose" | "blue" | "indigo";
  size?: "normal" | "large";
}) {
  const colorMap = {
    violet:  { icon: "text-violet-400",  glow: "shadow-violet-900/30",  border: "border-violet-500/15", bg: "from-violet-500/8" },
    emerald: { icon: "text-emerald-400", glow: "shadow-emerald-900/30", border: "border-emerald-500/15", bg: "from-emerald-500/8" },
    amber:   { icon: "text-amber-400",   glow: "shadow-amber-900/30",   border: "border-amber-500/15",  bg: "from-amber-500/8" },
    rose:    { icon: "text-rose-400",    glow: "shadow-rose-900/30",    border: "border-rose-500/15",   bg: "from-rose-500/8" },
    blue:    { icon: "text-blue-400",    glow: "shadow-blue-900/30",    border: "border-blue-500/15",   bg: "from-blue-500/8" },
    indigo:  { icon: "text-indigo-400",  glow: "shadow-indigo-900/30",  border: "border-indigo-500/15", bg: "from-indigo-500/8" },
  };
  const c = colorMap[color];
  return (
    <div className={cn(
      "relative rounded-2xl border bg-gradient-to-br to-transparent p-5 shadow-lg",
      c.border, c.glow, c.bg, "border-white/5"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2 rounded-xl bg-white/5", c.icon)}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1 text-xs font-semibold",
            trend.up ? "text-emerald-400" : "text-red-400"
          )}>
            {trend.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
      </div>
      <div className={cn("font-bold text-white leading-tight", size === "large" ? "text-3xl" : "text-2xl")}>
        {value}
      </div>
      <div className="text-xs text-[#666] mt-1">{label}</div>
      {sub && <div className="text-[10px] text-[#444] mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Alert Badge ──────────────────────────────────────────────────────────────

function AlertBadge({ alert }: { alert: { type: string; severity: string; title: string; detail: string } }) {
  const s = {
    high:    { cls: "border-red-500/30 bg-red-500/8",     icon: AlertTriangle, color: "text-red-400" },
    medium:  { cls: "border-amber-500/30 bg-amber-500/8", icon: AlertCircle,   color: "text-amber-400" },
    info:    { cls: "border-blue-500/30 bg-blue-500/8",   icon: Info,          color: "text-blue-400" },
    success: { cls: "border-emerald-500/30 bg-emerald-500/8", icon: CheckCircle, color: "text-emerald-400" },
  }[alert.severity] ?? { cls: "border-white/10 bg-white/4", icon: Info, color: "text-white" };
  const AlertIcon = s.icon;
  return (
    <div className={cn("rounded-xl border p-3.5 flex gap-3 items-start", s.cls)}>
      <AlertIcon className={cn("w-4 h-4 mt-0.5 shrink-0", s.color)} />
      <div>
        <div className="text-sm font-semibold text-white leading-tight">{alert.title}</div>
        <div className="text-xs text-[#666] mt-0.5 leading-snug">{alert.detail}</div>
      </div>
    </div>
  );
}

// ─── Business Row ─────────────────────────────────────────────────────────────

function BusinessRow({
  biz, notes, tag, flagged, onNote, onTag, onFlag,
}: {
  biz: any;
  notes: string;
  tag: string;
  flagged: boolean;
  onNote: (v: string) => void;
  onTag: (v: string) => void;
  onFlag: () => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState(notes);
  const BizIcon = BIZ_ICONS[biz.businessType] ?? Store;
  const bizColor = BIZ_COLORS[biz.businessType] ?? BIZ_COLORS.restaurant;

  return (
    <tr className="border-b border-white/4 hover:bg-white/2 transition-colors group">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <button onClick={onFlag} className="shrink-0">
            <Flag className={cn("w-3.5 h-3.5 transition-colors",
              flagged ? "text-amber-400 fill-amber-400/30" : "text-[#333] group-hover:text-[#555]"
            )} />
          </button>
          <div>
            <div className="text-sm font-semibold text-white leading-tight">{biz.name}</div>
            <div className="text-xs text-[#555]">{biz.city}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg border", bizColor)}>
          <BizIcon className="w-3 h-3" />
          {BIZ_LABELS[biz.businessType] ?? biz.businessType}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5">
          {biz.isPartner ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300">
              <Crown className="w-2.5 h-2.5" /> Premium
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-[#555]">
              Free
            </span>
          )}
          {!biz.isActive && (
            <span className="text-[10px] text-red-400 font-medium">Inaktiv</span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <Star className="w-3 h-3 text-amber-400 fill-amber-400/40" />
          <span className="text-sm font-semibold text-white">{biz.rating > 0 ? biz.rating.toFixed(1) : "—"}</span>
          <span className="text-xs text-[#444]">({biz.reviewCount})</span>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <span className="text-sm text-white font-medium">{biz.recentBookings}</span>
        <span className="text-xs text-[#444] ml-1">/ 30d</span>
      </td>
      <td className="py-3 px-4 text-right">
        {biz.promo.total_promos > 0 ? (
          <div>
            <span className="text-sm font-semibold text-violet-300">{fmtEur(biz.promo.total_budget_cents)}</span>
            <span className="text-xs text-[#444] ml-1">({biz.promo.total_promos} Boosts)</span>
          </div>
        ) : (
          <span className="text-xs text-[#333]">—</span>
        )}
      </td>
      <td className="py-3 px-4">
        {editingNote ? (
          <div className="flex gap-1.5">
            <input
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { onNote(noteInput); setEditingNote(false); } }}
              autoFocus
              className="flex-1 text-xs bg-white/8 border border-white/15 rounded-lg px-2.5 py-1.5 text-white outline-none placeholder:text-[#444] min-w-0"
              placeholder="Notiz hinzufügen..."
            />
            <button onClick={() => { onNote(noteInput); setEditingNote(false); }}
              className="text-emerald-400 hover:text-emerald-300 transition-colors">
              <CheckCircle className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setEditingNote(false)} className="text-[#444] hover:text-[#666]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditingNote(true)} className="text-left">
            {notes ? (
              <span className="text-xs text-[#888] hover:text-white transition-colors line-clamp-1">{notes}</span>
            ) : (
              <span className="text-xs text-[#333] hover:text-[#555] transition-colors opacity-0 group-hover:opacity-100">+ Notiz</span>
            )}
          </button>
        )}
      </td>
      <td className="py-3 px-4">
        <select
          value={tag}
          onChange={e => onTag(e.target.value)}
          className="text-xs bg-white/5 border border-white/8 rounded-lg px-2 py-1 text-[#888] outline-none hover:border-white/15 transition-colors appearance-none cursor-pointer"
        >
          <option value="">— Tag —</option>
          <option value="vip">VIP</option>
          <option value="follow_up">Follow-Up</option>
          <option value="upsell">Upsell</option>
          <option value="churn_risk">Abwanderungsrisiko</option>
          <option value="new">Neu</option>
          <option value="watch">Beobachten</option>
        </select>
      </td>
    </tr>
  );
}

// ─── Sortable table header ────────────────────────────────────────────────────

function SortHeader({ label, field, sort, onSort }: {
  label: string; field: string;
  sort: { field: string; asc: boolean };
  onSort: (f: string) => void;
}) {
  const active = sort.field === field;
  return (
    <th
      onClick={() => onSort(field)}
      className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-right cursor-pointer hover:text-[#666] transition-colors select-none"
    >
      <div className="flex items-center justify-end gap-1">
        {label}
        {active
          ? sort.asc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          : <div className="w-3 h-3" />}
      </div>
    </th>
  );
}

// ─── Wien Sales Pipeline ──────────────────────────────────────────────────────

const PIPELINE_STATUSES = [
  { id: "discovered", label: "Entdeckt",   color: "text-[#666] bg-white/5 border-white/10",              icon: Search,        step: 0 },
  { id: "contacted",  label: "Kontaktiert",color: "text-blue-400 bg-blue-500/10 border-blue-500/25",     icon: PhoneCall,     step: 1 },
  { id: "demo",       label: "Demo",       color: "text-amber-400 bg-amber-500/10 border-amber-500/25",  icon: LayoutList,    step: 2 },
  { id: "trial",      label: "Trial",      color: "text-violet-400 bg-violet-500/10 border-violet-500/25",icon: ClipboardList, step: 3 },
  { id: "paying",     label: "Zahlt",      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",icon: Euro,       step: 4 },
  { id: "declined",   label: "Abgelehnt",  color: "text-red-400/70 bg-red-500/5 border-red-500/20",      icon: Ban,           step: -1 },
] as const;

type PipelineStatus = typeof PIPELINE_STATUSES[number]["id"];

const PRIORITY_COLORS: Record<string, string> = {
  high:   "text-amber-400 bg-amber-500/10 border-amber-500/25",
  medium: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  low:    "text-[#444] bg-white/4 border-white/8",
};

const SALES_SCRIPT = [
  { step: "1", text: '"Hallo, wir haben eine App die Wienern Lokale in ihrer Nähe zeigt."' },
  { step: "2", text: '"Gerade sehen User bereits Cafés und Restaurants — wir können Ihr Lokal zeigen."' },
  { step: "3", text: '"Wir nehmen gerade ein paar lokale Betriebe für frühe Sichtbarkeit auf."' },
  { step: "4", text: '"Wir können Sie listen und in der Nähe promoten."' },
  { step: "5", text: '"Sie können es zuerst kostenlos ausprobieren." → Stille.' },
];

const OBJECTIONS = [
  { q: '"Wir haben schon Kunden"', a: '"Das hier sind NEUE Kunden in Ihrer Nähe — die Sie noch nicht erreichen."' },
  { q: '"Wir brauchen das nicht"', a: '"Kein Problem — wir nehmen nur wenige lokale Betriebe auf."' },
  { q: '"Keine Zeit"', a: '"Wir richten alles für Sie ein. Null Aufwand."' },
];

// ─── Founder Business Growth Section ─────────────────────────────────────────

interface BusinessClaim {
  id: number;
  business_name: string;
  business_type: "restaurant" | "cafe" | "bar";
  owner_name: string;
  email: string;
  phone?: string;
  city: string;
  message?: string;
  status: "new" | "contacted" | "onboarded" | "rejected";
  created_at: string;
}

interface ClaimsKpi {
  total?: number;
  last_7d?: number;
  last_30d?: number;
  status_new?: number;
  status_contacted?: number;
  status_onboarded?: number;
  status_rejected?: number;
  type_restaurant?: number;
  type_cafe?: number;
  type_bar?: number;
}

const CLAIM_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  new:       { label: "Neu",        cls: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  contacted: { label: "Kontaktiert", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  onboarded: { label: "Onboarded",  cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  rejected:  { label: "Abgelehnt", cls: "bg-red-500/15 text-red-400 border-red-500/25" },
};

const BIZ_TYPE_ICONS: Record<string, typeof Store> = {
  restaurant: UtensilsCrossed,
  cafe:       Coffee,
  bar:        Wine,
};

const BIZ_TYPE_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  cafe:       "Café",
  bar:        "Bar",
};

function FounderBusinessGrowthSection({ founderKey, businessClaims }: {
  founderKey: string;
  businessClaims: ClaimsKpi;
}) {
  const headers = { "x-founder-key": founderKey, "Content-Type": "application/json" };
  const qc = useQueryClient();

  const claimsQuery = useQuery<{ claims: BusinessClaim[]; total: number }>({
    queryKey: ["founder-claims"],
    queryFn: async () => {
      const r = await fetch(`${API}/founder/claims`, { headers });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`${API}/founder/claims/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["founder-claims"] }),
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const claims = claimsQuery.data?.claims ?? [];

  const kpi = businessClaims;

  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <Activity className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Business Growth Engine</span>
        <span className="ml-2 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
          {kpi.total ?? 0} Anfragen
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
        {[
          { label: "Gesamt",       value: kpi.total ?? 0,           color: "violet" },
          { label: "Letzte 7 Tage", value: kpi.last_7d ?? 0,        color: "blue" },
          { label: "Neu",          value: kpi.status_new ?? 0,       color: "sky" },
          { label: "Kontaktiert",  value: kpi.status_contacted ?? 0, color: "amber" },
          { label: "Onboarded",    value: kpi.status_onboarded ?? 0, color: "emerald" },
          { label: "Restaurant",   value: kpi.type_restaurant ?? 0,  color: "violet" },
          { label: "Café / Bar",   value: (kpi.type_cafe ?? 0) + (kpi.type_bar ?? 0), color: "rose" },
        ].map(({ label, value, color }) => {
          const colorMap: Record<string, string> = {
            violet: "text-violet-400", blue: "text-blue-400", sky: "text-sky-400",
            amber: "text-amber-400", emerald: "text-emerald-400", rose: "text-rose-400",
          };
          return (
            <div key={label} className="rounded-2xl border border-white/6 bg-white/2 px-4 py-3 text-center">
              <p className={`text-xl font-bold ${colorMap[color]}`}>{value}</p>
              <p className="text-[10px] text-[#555] mt-0.5">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Claims list */}
      <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
          <span className="text-xs font-semibold text-[#888]">Eingehende Betriebsanfragen</span>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["founder-claims"] })}
            className="text-[11px] text-[#444] hover:text-[#888] flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Aktualisieren
          </button>
        </div>

        {claimsQuery.isLoading ? (
          <div className="p-6 text-center text-sm text-[#444]">Lade Anfragen…</div>
        ) : claims.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[#444] text-sm">Noch keine Anfragen eingegangen</p>
            <p className="text-[11px] text-[#333] mt-1">Besucher der /for-business Seite tauchen hier auf</p>
          </div>
        ) : (
          <div className="divide-y divide-white/4">
            {claims.slice(0, 20).map((claim) => {
              const BizIcon = BIZ_TYPE_ICONS[claim.business_type] ?? Store;
              const statusCfg = CLAIM_STATUS_CONFIG[claim.status] ?? CLAIM_STATUS_CONFIG.new;
              const isExpanded = expandedId === claim.id;

              return (
                <div key={claim.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        <BizIcon className="w-3.5 h-3.5 text-[#888]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white leading-tight truncate">{claim.business_name}</p>
                        <p className="text-[11px] text-[#555] leading-tight">
                          {claim.owner_name} · {claim.city} · {BIZ_TYPE_LABELS[claim.business_type]}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {claim.source === "self_serve" && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/25 text-emerald-400">
                          SELF-SERVE
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.cls}`}>
                        {statusCfg.label}
                      </span>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : claim.id)}
                        className="text-[11px] text-[#444] hover:text-[#888]"
                      >
                        {isExpanded ? "Schließen" : "Details"}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pl-11 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 text-[#555]">
                          <Mail className="w-3 h-3 shrink-0" />
                          <a href={`mailto:${claim.email}`} className="hover:text-[#888] truncate">{claim.email}</a>
                        </div>
                        {claim.phone && (
                          <div className="flex items-center gap-1.5 text-[#555]">
                            <PhoneCall className="w-3 h-3 shrink-0" />
                            <a href={`tel:${claim.phone}`} className="hover:text-[#888]">{claim.phone}</a>
                          </div>
                        )}
                      </div>
                      {claim.message && (
                        <p className="text-[11px] text-[#555] bg-white/3 rounded-lg px-3 py-2 italic">
                          „{claim.message}"
                        </p>
                      )}
                      <p className="text-[10px] text-[#333]">
                        Eingegangen: {new Date(claim.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {(["new", "contacted", "onboarded", "rejected"] as const).map(s => {
                          const sc = CLAIM_STATUS_CONFIG[s];
                          const isCurrentStatus = claim.status === s;
                          return (
                            <button
                              key={s}
                              onClick={() => statusMutation.mutate({ id: claim.id, status: s })}
                              disabled={isCurrentStatus || statusMutation.isPending}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-opacity ${
                                isCurrentStatus ? `${sc.cls} opacity-100` : "border-white/8 text-[#555] hover:text-[#888] hover:border-white/15"
                              } disabled:opacity-50`}
                            >
                              {sc.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Founder Pricing Controls ─────────────────────────────────────────────────

interface PricingConfig {
  basePrice: number;
  maxMultiplier: number;
  minPrice: number;
  demandSensitivity: number;
  demandThresholds: { low: number; normal: number; high: number; very_high: number };
}

interface LivePricing {
  pricePerImpression: number;
  pricePer1000: number;
  demandLevel: string;
  totalActivePlatformBoosts: number;
  competingBoosts: number;
  pricingContext: string;
  breakdown: { basePrice: number; demandMultiplier: number; timeMultiplier: number; slotMultiplier: number; weekendBonus: number; totalMultiplier: number; finalPrice: number };
  config: { basePrice: number; maxMultiplier: number };
}

function FounderPricingControls({ founderKey }: { founderKey: string }) {
  const headers = { "x-founder-key": founderKey, "Content-Type": "application/json" };
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const configQuery = useQuery<PricingConfig>({
    queryKey: ["founder-pricing-config"],
    queryFn: async () => {
      const r = await fetch(`${API}/pricing/config`, { headers });
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    },
  });

  const liveQuery = useQuery<LivePricing>({
    queryKey: ["founder-pricing-live"],
    queryFn: async () => {
      const r = await fetch(`${API}/pricing/current`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const [draft, setDraft] = useState<Partial<PricingConfig>>({});
  useEffect(() => {
    if (configQuery.data && Object.keys(draft).length === 0) {
      setDraft(configQuery.data);
    }
  }, [configQuery.data]);

  const cfg = { ...(configQuery.data ?? {}), ...draft } as PricingConfig;

  async function saveConfig() {
    setSaving(true);
    try {
      const r = await fetch(`${API}/pricing/config`, {
        method: "PUT",
        headers,
        body: JSON.stringify(draft),
      });
      if (!r.ok) throw new Error("Failed");
      qc.invalidateQueries({ queryKey: ["founder-pricing-config"] });
      qc.invalidateQueries({ queryKey: ["founder-pricing-live"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const live = liveQuery.data;

  const DEMAND_COLORS: Record<string, string> = {
    low: "text-emerald-400",
    normal: "text-blue-400",
    high: "text-amber-400",
    very_high: "text-red-400",
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <Activity className="w-4 h-4 text-violet-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Dynamic Pricing Engine</span>
        <span className="ml-2 text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full font-bold">FOUNDER ONLY</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Live status card */}
        <div className="rounded-2xl border border-white/6 bg-white/2 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#888]">Live-Preisübersicht</span>
            <span className={cn("text-xs font-bold", DEMAND_COLORS[live?.demandLevel ?? "normal"])}>
              {live?.demandLevel === "low" ? "Niedrige" : live?.demandLevel === "high" ? "Hohe" : live?.demandLevel === "very_high" ? "Sehr hohe" : "Normale"} Nachfrage
            </span>
          </div>

          {live ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#0d0d18] border border-white/6 p-3 text-center">
                  <p className="text-[10px] text-[#555] mb-1">Preis / Einbl.</p>
                  <p className="text-base font-bold text-white font-mono">€{live.pricePerImpression.toFixed(4)}</p>
                </div>
                <div className="rounded-xl bg-[#0d0d18] border border-white/6 p-3 text-center">
                  <p className="text-[10px] text-[#555] mb-1">Preis / 1.000</p>
                  <p className="text-base font-bold text-white font-mono">€{live.pricePer1000.toFixed(2)}</p>
                </div>
                <div className="rounded-xl bg-[#0d0d18] border border-white/6 p-3 text-center">
                  <p className="text-[10px] text-[#555] mb-1">Aktive Boosts</p>
                  <p className="text-base font-bold text-white font-mono">{live.totalActivePlatformBoosts}</p>
                </div>
              </div>

              <div className="rounded-xl bg-[#0d0d18] border border-white/6 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-[#888]">Preisfaktoren</p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    ["Basispreis",      `€${live.breakdown.basePrice.toFixed(4)}`],
                    ["Nachfrage ×",     `${live.breakdown.demandMultiplier.toFixed(2)}×`],
                    ["Tageszeit ×",     `${live.breakdown.timeMultiplier.toFixed(2)}×`],
                    ["Wettbewerb ×",    `${live.breakdown.slotMultiplier.toFixed(2)}×`],
                    ["Wochenend-Bonus", `${live.breakdown.weekendBonus.toFixed(2)}×`],
                    ["Gesamtfaktor",    `${live.breakdown.totalMultiplier.toFixed(2)}×`],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between bg-white/3 rounded px-2 py-1">
                      <span className="text-[#555]">{label}</span>
                      <span className="font-mono text-white/80">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-[#555]">{live.pricingContext}</p>
            </>
          ) : (
            <div className="animate-pulse space-y-3">
              <div className="h-16 bg-white/4 rounded-xl" />
              <div className="h-28 bg-white/4 rounded-xl" />
            </div>
          )}
        </div>

        {/* Config editor */}
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#888]">Preisparameter bearbeiten</span>
            {saved && <span className="text-[11px] text-emerald-400 font-semibold">✓ Gespeichert</span>}
          </div>

          {configQuery.isLoading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-white/4 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-3">

              <ConfigRow
                label="Basispreis (€ / Einbl.)"
                value={cfg.basePrice ?? 0.01}
                min={0.001} max={0.05} step={0.001}
                format={v => `€${v.toFixed(4)}`}
                onChange={v => setDraft(d => ({ ...d, basePrice: v }))}
              />

              <ConfigRow
                label="Max. Multiplikator"
                value={cfg.maxMultiplier ?? 2.5}
                min={1.0} max={5.0} step={0.1}
                format={v => `${v.toFixed(1)}×`}
                onChange={v => setDraft(d => ({ ...d, maxMultiplier: v }))}
              />

              <ConfigRow
                label="Min. Preis (Boden)"
                value={cfg.minPrice ?? 0.004}
                min={0.001} max={0.01} step={0.001}
                format={v => `€${v.toFixed(4)}`}
                onChange={v => setDraft(d => ({ ...d, minPrice: v }))}
              />

              <ConfigRow
                label="Nachfrage-Sensitivität"
                value={cfg.demandSensitivity ?? 1.0}
                min={0.1} max={3.0} step={0.1}
                format={v => `${v.toFixed(1)}×`}
                onChange={v => setDraft(d => ({ ...d, demandSensitivity: v }))}
              />

              <div className="space-y-2">
                <p className="text-[11px] text-[#555] font-semibold">Nachfrage-Schwellenwerte (Anzahl aktiver Boosts)</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["low", "normal", "high", "very_high"] as const).map(level => {
                    const LABELS: Record<string, string> = { low: "Niedrig bis", normal: "Normal bis", high: "Hoch bis", very_high: "Sehr hoch ab" };
                    return (
                      <div key={level} className="flex items-center justify-between gap-2 bg-[#0d0d18] rounded-xl px-3 py-2">
                        <span className={cn("text-[11px] font-medium", DEMAND_COLORS[level])}>{LABELS[level]}</span>
                        <input
                          type="number"
                          min={1} max={200}
                          value={cfg.demandThresholds?.[level] ?? 0}
                          onChange={e => setDraft(d => ({
                            ...d,
                            demandThresholds: {
                              ...(d.demandThresholds ?? cfg.demandThresholds ?? { low: 3, normal: 8, high: 15, very_high: 25 }),
                              [level]: Number(e.target.value),
                            },
                          }))}
                          className="w-14 text-right text-xs font-mono bg-white/5 border border-white/8 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-violet-500/50"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={saveConfig}
                disabled={saving}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white text-xs font-bold py-2.5 rounded-xl transition-opacity disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                {saving ? "Speichert…" : "Preisparameter speichern"}
              </button>

              <p className="text-[10px] text-[#444] text-center">
                Änderungen wirken sofort für alle neuen Impressionen auf der Plattform.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ConfigRow({
  label, value, min, max, step, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-[#888]">{label}</span>
        <span className="text-[11px] font-mono font-bold text-white">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 appearance-none rounded-full bg-white/10 accent-violet-500 cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-[#333]">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function WienPipelineView({ founderKey }: { founderKey: string }) {
  const headers = { "x-founder-key": founderKey };
  const qc = useQueryClient();

  const { data: pipeline = [], isLoading, refetch } = useQuery({
    queryKey: ["founder-pipeline"],
    queryFn: async () => {
      const r = await fetch(`${API}/founder/pipeline`, { headers });
      if (!r.ok) throw new Error("Unauthorized");
      return r.json() as Promise<any[]>;
    },
    refetchInterval: 30_000,
  });

  const [filterBiz, setFilterBiz] = useState("all");
  const [filterStatus, setFilterStatus] = useState<PipelineStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [scriptOpen, setScriptOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [localNotes, setLocalNotes] = useState<Record<number, string>>({});

  // Funnel counts
  const counts = PIPELINE_STATUSES.reduce((acc, s) => {
    acc[s.id] = pipeline.filter((v: any) => v.status === s.id).length;
    return acc;
  }, {} as Record<string, number>);

  const totalPaying = counts["paying"] ?? 0;
  const totalTrial = counts["trial"] ?? 0;
  const totalInProgress = (counts["contacted"] ?? 0) + (counts["demo"] ?? 0);

  async function updateStatus(restaurantId: number, status: string) {
    setUpdatingId(restaurantId);
    try {
      await fetch(`${API}/founder/pipeline/${restaurantId}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await refetch();
    } finally {
      setUpdatingId(null);
    }
  }

  async function saveNotes(restaurantId: number, notes: string) {
    await fetch(`${API}/founder/pipeline/${restaurantId}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
  }

  const filtered = pipeline.filter((v: any) => {
    if (filterBiz !== "all" && v.business_type !== filterBiz) return false;
    if (filterStatus !== "all" && v.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!v.name?.toLowerCase().includes(s) && !v.address?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  // Priority targets: café, discovered, high priority
  const priorityTargets = pipeline.filter((v: any) =>
    v.status === "discovered" && v.business_type === "cafe" && v.priority === "high"
  ).slice(0, 4);

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/6 bg-[#080810]/95 backdrop-blur-xl">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/40">
                <ClipboardList className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-white leading-tight">Wien Sales Pipeline</div>
                <div className="text-[10px] text-[#444] leading-tight">Erstes Ziel: 10 zahlende Betriebe</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <Euro className="w-3 h-3" />
              {totalPaying} zahlend · {totalTrial} Trial · {totalInProgress} in Kontakt
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors px-3 py-1.5 rounded-xl border border-white/6 hover:border-white/15"
            >
              <RefreshCw className="w-3 h-3" />
              Aktualisieren
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

        {/* ── Conversion Funnel ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Conversion Funnel · Wien</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {PIPELINE_STATUSES.map((s) => {
              const StatusIcon = s.icon;
              const count = counts[s.id] ?? 0;
              return (
                <button
                  key={s.id}
                  onClick={() => setFilterStatus(filterStatus === s.id ? "all" : s.id)}
                  className={cn(
                    "rounded-2xl border p-4 text-center transition-all hover:scale-105 cursor-pointer",
                    s.color,
                    filterStatus === s.id && "ring-2 ring-white/20 scale-105"
                  )}
                >
                  <StatusIcon className="w-4 h-4 mx-auto mb-2 opacity-70" />
                  <div className="text-2xl font-bold text-white">{count}</div>
                  <div className="text-[10px] mt-1 opacity-70">{s.label}</div>
                </button>
              );
            })}
          </div>
          {/* Target Progress */}
          <div className="mt-4 rounded-2xl border border-white/6 bg-white/2 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#555] font-semibold">Ziel: 10 zahlende Betriebe in Wien</span>
              <span className="text-xs font-bold text-emerald-400">{totalPaying}/10</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/6 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-700"
                style={{ width: `${Math.min(100, (totalPaying / 10) * 100)}%` }}
              />
            </div>
            <div className="flex gap-4 mt-3 text-[10px] text-[#444]">
              <span>🎯 Fokus: Cafés zuerst → Restaurants → Bars</span>
              <span>💶 Ziel-MRR: €399/Monat (10 × €39,90)</span>
            </div>
          </div>
        </section>

        {/* ── Priority Targets (Cafés to call NOW) ── */}
        {priorityTargets.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Jetzt kontaktieren — Café Prioritäten</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {priorityTargets.map((v: any) => (
                <div key={v.id} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-white text-sm leading-tight">{v.name}</div>
                      <div className="text-[10px] text-[#555] mt-0.5">{v.address?.split(",")[0]}</div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400 shrink-0">
                      <Star className="w-3 h-3 fill-amber-400/40" />
                      <span className="text-xs font-bold">{v.rating}</span>
                    </div>
                  </div>
                  {v.phone && (
                    <a
                      href={`tel:${v.phone}`}
                      className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors font-semibold"
                    >
                      <Phone className="w-3 h-3" />
                      {v.phone}
                    </a>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(v.id, "contacted")}
                      disabled={updatingId === v.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-50"
                    >
                      <PhoneCall className="w-3 h-3" />
                      Kontaktiert
                    </button>
                    {v.email && (
                      <a
                        href={`mailto:${v.email}?subject=RestoSmart Wien — Kostenlose Listung für ${v.name}&body=Hallo%2C%0A%0Awir%20haben%20eine%20App%20die%20Wienern%20Lokale%20in%20ihrer%20Nähe%20zeigt.%20Wir%20möchten%20Sie%20kostenlos%20listen.%0A%0AMit%20freundlichen%20Grüßen`}
                        className="p-2 rounded-xl border border-white/10 hover:border-amber-500/30 text-[#555] hover:text-amber-400 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Sales Script (Collapsible) ── */}
        <section>
          <button
            onClick={() => setScriptOpen(v => !v)}
            className="w-full flex items-center justify-between rounded-2xl border border-white/6 bg-white/2 hover:bg-white/4 px-5 py-4 transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-bold text-white">Sales Script + Einwandbehandlung</span>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-[#555] transition-transform", scriptOpen && "rotate-180")} />
          </button>
          <AnimatePresence>
            {scriptOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-3">Script — Schritt für Schritt</div>
                    {SALES_SCRIPT.map((s) => (
                      <div key={s.step} className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-400 shrink-0 mt-0.5">{s.step}</div>
                        <p className="text-sm text-[#aaa] leading-relaxed italic">{s.text}</p>
                      </div>
                    ))}
                    <div className="mt-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-semibold">
                      💡 Nach Schritt 5: Stille lassen. Wer redet verliert.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/6 bg-white/2 p-5 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-widest text-[#555] mb-3">Einwandbehandlung</div>
                    {OBJECTIONS.map((o, i) => (
                      <div key={i} className="space-y-1">
                        <div className="text-xs text-red-400/80 font-semibold">{o.q}</div>
                        <div className="text-xs text-[#888] pl-3 border-l border-white/10 leading-relaxed">{o.a}</div>
                      </div>
                    ))}
                    <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                      🎯 Angebot: 7 Tage Demo-Zugang → dann €39,90/Monat. "Wir richten alles ein."
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Filters + Search ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#444]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Lokal suchen…"
              className="w-full bg-white/4 border border-white/8 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-[#333] outline-none focus:border-white/20 transition-colors"
            />
          </div>
          <div className="flex gap-1.5">
            {[
              { id: "all", label: "Alle", emoji: "📋" },
              { id: "cafe", label: "Cafés", emoji: "☕" },
              { id: "restaurant", label: "Restaurants", emoji: "🍽️" },
              { id: "bar", label: "Bars", emoji: "🍸" },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterBiz(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                  filterBiz === f.id
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-white/3 border-white/6 text-[#555] hover:text-white hover:border-white/12"
                )}
              >
                {f.emoji} {f.label}
              </button>
            ))}
          </div>
          {filterStatus !== "all" && (
            <button
              onClick={() => setFilterStatus("all")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-[#555] border border-white/6 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" /> Filter: {PIPELINE_STATUSES.find(s => s.id === filterStatus)?.label}
            </button>
          )}
          <div className="ml-auto text-xs text-[#333]">{filtered.length} Betriebe</div>
        </div>

        {/* ── Venue List ── */}
        <section className="space-y-2">
          {isLoading && (
            <div className="text-center text-sm text-[#333] py-12">Lade Pipeline…</div>
          )}
          {filtered.map((v: any) => {
            const statusDef = PIPELINE_STATUSES.find(s => s.id === v.status) ?? PIPELINE_STATUSES[0];
            const StatusIcon = statusDef.icon;
            const BizIcon = BIZ_ICONS[v.business_type as string] ?? Store;
            const noteVal = localNotes[v.id] !== undefined ? localNotes[v.id] : (v.notes ?? "");
            return (
              <div
                key={v.id}
                className={cn(
                  "rounded-2xl border bg-white/2 hover:bg-white/3 transition-all",
                  v.status === "paying" ? "border-emerald-500/20" :
                  v.status === "trial"  ? "border-violet-500/20" :
                  v.status === "demo"   ? "border-amber-500/20" :
                  "border-white/6"
                )}
              >
                <div className="p-4 flex flex-col sm:flex-row gap-4">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded-lg border text-xs", BIZ_COLORS[v.business_type] ?? BIZ_COLORS.restaurant)}>
                          <BizIcon className="w-3 h-3" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm leading-tight">{v.cuisine_emoji} {v.name}</div>
                          <div className="text-[10px] text-[#444] mt-0.5">{v.address}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400/30" />
                        <span className="text-xs text-white font-semibold">{v.rating}</span>
                        {v.is_partner && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-500/15 text-violet-400 border border-violet-500/25">Premium</span>
                        )}
                      </div>
                    </div>
                    {/* Contact */}
                    <div className="flex gap-3 flex-wrap">
                      {v.phone && (
                        <a href={`tel:${v.phone}`} className="flex items-center gap-1 text-[11px] text-[#555] hover:text-white transition-colors">
                          <Phone className="w-3 h-3" />
                          {v.phone}
                        </a>
                      )}
                      {v.email && (
                        <a
                          href={`mailto:${v.email}?subject=RestoSmart Wien — Kostenlose Listung für ${v.name}&body=Hallo%2C%0A%0Awir%20haben%20eine%20App%20die%20Wienern%20Lokale%20in%20ihrer%20Nähe%20zeigt.%20Wir%20möchten%20Ihr%20Lokal%20kostenlos%20listen.%0A%0AMit%20freundlichen%20Grüßen`}
                          className="flex items-center gap-1 text-[11px] text-[#555] hover:text-blue-400 transition-colors"
                        >
                          <Mail className="w-3 h-3" />
                          {v.email}
                        </a>
                      )}
                    </div>
                    {/* Notes */}
                    <textarea
                      value={noteVal}
                      onChange={e => setLocalNotes(n => ({ ...n, [v.id]: e.target.value }))}
                      onBlur={() => saveNotes(v.id, noteVal)}
                      placeholder="Notizen: Wer angerufen, wie reagiert, nächster Schritt…"
                      rows={2}
                      className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-[#888] placeholder:text-[#333] outline-none focus:border-white/20 resize-none transition-colors"
                    />
                  </div>

                  {/* Right: status selector */}
                  <div className="flex flex-col gap-2 sm:w-40 shrink-0">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-[#333] mb-0.5">Status</div>
                    <div className="flex flex-col gap-1">
                      {PIPELINE_STATUSES.map((s) => {
                        const SIcon = s.icon;
                        const active = v.status === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => updateStatus(v.id, s.id)}
                            disabled={updatingId === v.id}
                            className={cn(
                              "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all text-left",
                              active ? s.color + " scale-100" : "text-[#333] bg-white/2 border-white/5 hover:border-white/15 hover:text-[#888]"
                            )}
                          >
                            <SIcon className="w-3 h-3 shrink-0" />
                            {s.label}
                            {active && <CheckCircle className="w-2.5 h-2.5 ml-auto opacity-60" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && !isLoading && (
            <div className="text-center text-xs text-[#333] py-12">Keine Betriebe gefunden.</div>
          )}
        </section>

        {/* ── Footer ── */}
        <div className="text-center text-xs text-[#222] py-4 border-t border-white/4">
          Wien Sales Pipeline · RestoSmart Intern · Streng vertraulich
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ founderKey }: { founderKey: string }) {
  const headers = { "x-founder-key": founderKey };

  const metricsQuery = useQuery({
    queryKey: ["founder-metrics"],
    queryFn: async () => {
      const r = await fetch(`${API}/founder/metrics`, { headers });
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const bizQuery = useQuery({
    queryKey: ["founder-businesses"],
    queryFn: async () => {
      const r = await fetch(`${API}/founder/businesses`, { headers });
      if (!r.ok) throw new Error("Unauthorized");
      return r.json() as Promise<any[]>;
    },
    refetchInterval: 60_000,
  });

  // Founder notes/tags/flags stored in localStorage
  const [businessMeta, setBusinessMeta] = useState<Record<number, { note: string; tag: string; flagged: boolean }>>(() => {
    try { return JSON.parse(localStorage.getItem("restosmart_founder_biz_meta") ?? "{}"); } catch { return {}; }
  });

  function saveMeta(meta: typeof businessMeta) {
    setBusinessMeta(meta);
    localStorage.setItem("restosmart_founder_biz_meta", JSON.stringify(meta));
  }

  function updateMeta(id: number, patch: Partial<{ note: string; tag: string; flagged: boolean }>) {
    const existing = businessMeta[id] ?? { note: "", tag: "", flagged: false };
    saveMeta({ ...businessMeta, [id]: { ...existing, ...patch } });
  }

  // Search + sort state
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: string; asc: boolean }>({ field: "recentBookings", asc: false });
  const [filterPremium, setFilterPremium] = useState<"all" | "premium" | "free">("all");
  const [filterBiz, setFilterBiz] = useState("all");

  function toggleSort(field: string) {
    setSort(prev => prev.field === field ? { field, asc: !prev.asc } : { field, asc: false });
  }

  const businesses: any[] = bizQuery.data ?? [];

  const filteredBiz = businesses
    .filter(b => {
      if (search) {
        const s = search.toLowerCase();
        if (!b.name.toLowerCase().includes(s) && !b.city.toLowerCase().includes(s)) return false;
      }
      if (filterPremium === "premium" && !b.isPartner) return false;
      if (filterPremium === "free" && b.isPartner) return false;
      if (filterBiz !== "all" && b.businessType !== filterBiz) return false;
      return true;
    })
    .sort((a, b) => {
      let va: number, vb: number;
      switch (sort.field) {
        case "rating": va = a.rating; vb = b.rating; break;
        case "recentBookings": va = a.recentBookings; vb = b.recentBookings; break;
        case "boostBudget": va = a.promo.total_budget_cents; vb = b.promo.total_budget_cents; break;
        case "reviews": va = a.reviewCount; vb = b.reviewCount; break;
        default: va = a.recentBookings; vb = b.recentBookings;
      }
      return sort.asc ? va - vb : vb - va;
    });

  const flaggedBiz = businesses.filter(b => businessMeta[b.id]?.flagged);
  const taggedBiz = businesses.filter(b => businessMeta[b.id]?.tag);

  if (metricsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin mx-auto" />
          <p className="text-sm text-[#555]">Lade Plattformdaten…</p>
        </div>
      </div>
    );
  }

  if (metricsQuery.isError) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="text-center text-red-400">Zugriff verweigert oder Fehler beim Laden.</div>
      </div>
    );
  }

  const m = metricsQuery.data;
  const { kpis, byBizType, byCity, promoByType, rankings, alerts } = m;

  const flaggedCount = flaggedBiz.length;

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* ── Header ── */}
      <div className="sticky top-0 z-40 border-b border-white/6 bg-[#080810]/95 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-white leading-tight">Founder Command Center</div>
                <div className="text-[10px] text-[#444] leading-tight">RestoSmart · Internes Cockpit</div>
              </div>
            </div>
            <div className="h-5 w-px bg-white/6" />
            <div className="flex items-center gap-1.5 text-xs text-[#444]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live-Daten
            </div>
          </div>
          <div className="flex items-center gap-3">
            {flaggedCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
                <Flag className="w-3 h-3" />
                {flaggedCount} markiert
              </div>
            )}
            <button
              onClick={() => { metricsQuery.refetch(); bizQuery.refetch(); }}
              className="flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors px-3 py-1.5 rounded-xl border border-white/6 hover:border-white/15"
            >
              <RefreshCw className={cn("w-3 h-3", metricsQuery.isFetching && "animate-spin")} />
              Aktualisieren
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">

        {/* ── Section: Executive KPIs ── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Executive KPIs</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <KpiCard
              label="Monthly Recurring Revenue"
              value={fmtEurDirect(kpis.mrrEur)}
              sub={`${kpis.premiumBusinesses} Business Premium-Abonnements \u00d7 \u20ac39,90`}
              icon={DollarSign}
              color="violet"
              size="large"
            />
            <KpiCard
              label="Premium-Betriebe"
              value={fmt(kpis.premiumBusinesses)}
              sub={`${kpis.nonPremiumActive} aktive Free-Betriebe`}
              icon={Crown}
              color="violet"
              trend={kpis.newPremium30d > 0 ? { value: `+${kpis.newPremium30d} (30d)`, up: true } : null}
            />
            <KpiCard
              label="Neu (30 Tage)"
              value={fmt(kpis.newPremium30d)}
              sub="Neue Premium-Abonnements"
              icon={Rocket}
              color="emerald"
            />
            <KpiCard
              label="Abwanderungsrisiko"
              value={fmt(kpis.churnRisk)}
              sub="Premium ohne Aktivität"
              icon={TrendingDown}
              color={kpis.churnRisk > 0 ? "rose" : "emerald"}
            />
            <KpiCard
              label="Boost-Umsatz"
              value={fmtEurDirect(kpis.boostRevenueEur)}
              sub={`${kpis.totalPromos} Promotions gesamt`}
              icon={Zap}
              color="amber"
            />
            <KpiCard
              label="Buchungen beeinflusst"
              value={fmt(kpis.totalBookingsInfluenced)}
              sub={`${kpis.activePromos} Boosts aktiv`}
              icon={Target}
              color="blue"
            />
            <KpiCard
              label="Gesamtreichweite"
              value={fmt(kpis.totalBoostImpressions)}
              sub={`${kpis.boostConvRate} Klickrate`}
              icon={Activity}
              color="indigo"
            />
            <KpiCard
              label="Platform Revenue"
              value={fmtEurDirect(kpis.totalRevenueEur)}
              sub="Abos + Boost-Budgets"
              icon={TrendingUp}
              color="emerald"
              size="large"
            />
          </div>
        </section>

        {/* ── Section: Alerts ── */}
        {alerts.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Executive-Alerts</span>
              <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full font-bold">
                {alerts.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {alerts.map((alert: any, i: number) => (
                <AlertBadge key={i} alert={alert} />
              ))}
            </div>
          </section>
        )}

        {/* ── Section: Business Type + City ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Business Type Breakdown */}
          <section>
            <div className="flex items-center gap-2 mb-5">
              <Store className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Betriebstyp-Analyse</span>
            </div>
            <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/6">
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-left">Typ</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-right">Gesamt</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-right">Premium</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-right">Aktivierungsrate</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-right">⌀ Rating</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-right">Boost-Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {(byBizType as any[]).map((row: any) => {
                    const BizIcon = BIZ_ICONS[row.business_type] ?? Store;
                    const bizColor = BIZ_COLORS[row.business_type] ?? BIZ_COLORS.restaurant;
                    const activationRate = row.total > 0 ? ((row.premium / row.total) * 100).toFixed(0) : "0";
                    return (
                      <tr key={row.business_type} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                        <td className="py-3 px-4">
                          <span className={cn("inline-flex items-center gap-2 text-xs font-bold px-2.5 py-1 rounded-lg border", bizColor)}>
                            <BizIcon className="w-3 h-3" />
                            {BIZ_LABELS[row.business_type] ?? row.business_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold text-white">{row.total}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-bold text-violet-300">{row.premium}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-white/6">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500"
                                style={{ width: `${activationRate}%` }}
                              />
                            </div>
                            <span className="text-xs text-[#666]">{activationRate}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400/40" />
                            <span className="text-sm text-white">{row.avg_rating ?? "—"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold text-amber-300">
                          {fmtEur(row.total_budget_cents ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* City Leaderboard */}
          <section>
            <div className="flex items-center gap-2 mb-5">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Stadt-Leaderboard</span>
            </div>
            <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/6">
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-left">Stadt</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-right">Betriebe</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-right">Premium</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-right">⌀ Rating</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-right">Boost-Buchungen</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-right">Impressionen</th>
                  </tr>
                </thead>
                <tbody>
                  {(byCity as any[]).slice(0, 12).map((row: any, i: number) => (
                    <tr key={row.city} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {i < 3 && (
                            <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center bg-violet-500/15 text-violet-400">
                              {i + 1}
                            </span>
                          )}
                          <span className="text-sm font-semibold text-white">{row.city}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-[#888]">{row.total}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-bold text-violet-300">{row.premium}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400/40" />
                          <span className="text-sm text-white">{row.avg_rating ?? "—"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-emerald-300">
                        {fmt(row.boost_bookings ?? 0)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-[#666]">
                        {fmt(row.boost_impressions ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ── Section: Boost Performance by Type ── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Boost-Performance nach Typ</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {(promoByType as any[]).map((row: any) => {
              const ctr = row.total_impressions > 0
                ? ((row.total_clicks / row.total_impressions) * 100).toFixed(1) : "0.0";
              const roi = row.total_bookings > 0 && row.total_budget_cents > 0
                ? (((row.total_bookings * 35 * 100) / row.total_budget_cents) * 100).toFixed(0) : null;
              return (
                <div key={row.type} className="rounded-2xl border border-white/6 bg-white/2 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 leading-tight">
                      {BOOST_LABELS[row.type] ?? row.type}
                    </span>
                    <span className="text-[10px] text-[#444] bg-white/5 border border-white/8 px-1.5 py-0.5 rounded-full">
                      {row.count}×
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#444]">Budget</span>
                      <span className="text-white font-semibold">{fmtEur(row.total_budget_cents ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#444]">Impressionen</span>
                      <span className="text-[#888]">{fmt(row.total_impressions ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#444]">Klicks</span>
                      <span className="text-[#888]">{fmt(row.total_clicks ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#444]">CTR</span>
                      <span className="text-blue-300 font-semibold">{ctr}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#444]">Buchungen</span>
                      <span className="text-emerald-300 font-bold">{row.total_bookings ?? 0}</span>
                    </div>
                    {roi && (
                      <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                        <span className="text-[#444]">Est. ROI</span>
                        <span className="text-violet-300 font-bold">{roi}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Section: Business Growth Engine ── */}
        <FounderBusinessGrowthSection founderKey={founderKey} businessClaims={m.businessClaims ?? {}} />

        {/* ── Section: Dynamic Pricing Engine Controls ── */}
        <FounderPricingControls founderKey={founderKey} />

        {/* ── Section: Rankings ── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Rankings & Intelligence</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

            {/* Top boosted */}
            <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-bold text-white">Top Boost-ROI</span>
              </div>
              <div className="divide-y divide-white/4">
                {rankings.topBoosted.slice(0, 8).map((r: any, i: number) => (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-white/2 transition-colors">
                    <span className="text-[10px] font-bold text-[#333] w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{r.name}</div>
                      <div className="text-[10px] text-[#444]">{r.city}</div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 shrink-0">
                      {r.promo.totalBookings} Buchungen
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top spenders */}
            <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-white">Größte Boost-Investitionen</span>
              </div>
              <div className="divide-y divide-white/4">
                {rankings.topSpenders.slice(0, 8).map((r: any, i: number) => (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-white/2 transition-colors">
                    <span className="text-[10px] font-bold text-[#333] w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{r.name}</div>
                      <div className="text-[10px] text-[#444]">{r.city}</div>
                    </div>
                    <span className="text-xs font-bold text-amber-300 shrink-0">
                      {fmtEur(r.promo.totalBudget)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upsell candidates */}
            <div className="rounded-2xl border border-violet-500/15 bg-violet-500/4 overflow-hidden">
              <div className="px-4 py-3 border-b border-violet-500/15 flex items-center gap-2">
                <Rocket className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-bold text-white">Upsell-Kandidaten</span>
                <span className="text-[10px] text-violet-400 font-bold ml-auto">{rankings.upsellCandidates.length}</span>
              </div>
              <div className="divide-y divide-violet-500/8">
                {rankings.upsellCandidates.slice(0, 8).map((r: any) => (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-violet-500/6 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{r.name}</div>
                      <div className="text-[10px] text-[#555]">{r.city} · {BIZ_LABELS[r.businessType] ?? r.businessType}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-violet-300 font-bold">{r.recentBookings}B</div>
                      <div className="flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400/50" />
                        <span className="text-[10px] text-[#555]">{r.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Churn risk */}
            <div className="rounded-2xl border border-red-500/15 bg-red-500/4 overflow-hidden">
              <div className="px-4 py-3 border-b border-red-500/15 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-bold text-white">Abwanderungsrisiko</span>
                <span className="text-[10px] text-red-400 font-bold ml-auto">{rankings.churnRiskBusinesses.length}</span>
              </div>
              <div className="divide-y divide-red-500/8">
                {rankings.churnRiskBusinesses.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-[#444]">Kein Risiko erkannt ✓</div>
                ) : rankings.churnRiskBusinesses.slice(0, 8).map((r: any) => (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-red-500/6 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{r.name}</div>
                      <div className="text-[10px] text-[#555]">{r.city}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] text-red-300 font-semibold">0 Buchungen</div>
                      <div className="text-[10px] text-[#444]">kein Boost</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Section: Business Directory ── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Betriebsverzeichnis</span>
              <span className="text-xs text-[#333] bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
                {filteredBiz.length} / {businesses.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter by premium */}
              <select
                value={filterPremium}
                onChange={e => setFilterPremium(e.target.value as any)}
                className="text-xs bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-[#888] outline-none hover:border-white/15 transition-colors appearance-none cursor-pointer"
              >
                <option value="all">Alle</option>
                <option value="premium">Nur Premium</option>
                <option value="free">Nur Free</option>
              </select>
              {/* Filter by biz type */}
              <select
                value={filterBiz}
                onChange={e => setFilterBiz(e.target.value)}
                className="text-xs bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-[#888] outline-none hover:border-white/15 transition-colors appearance-none cursor-pointer"
              >
                <option value="all">Alle Typen</option>
                <option value="restaurant">Restaurant</option>
                <option value="cafe">Café</option>
                <option value="bar">Bar</option>
              </select>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#444]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Suchen…"
                  className="pl-8 pr-4 py-2 text-xs bg-white/5 border border-white/8 rounded-xl text-white outline-none placeholder:text-[#333] hover:border-white/15 focus:border-white/20 transition-colors w-48"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/6">
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-left">Betrieb</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-left">Typ</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-left">Status</th>
                    <SortHeader label="Rating" field="rating" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Buchungen (30d)" field="recentBookings" sort={sort} onSort={toggleSort} />
                    <SortHeader label="Boost-Budget" field="boostBudget" sort={sort} onSort={toggleSort} />
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-left">Notiz</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#444] text-left">Tag</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBiz.map(biz => (
                    <BusinessRow
                      key={biz.id}
                      biz={biz}
                      notes={businessMeta[biz.id]?.note ?? ""}
                      tag={businessMeta[biz.id]?.tag ?? ""}
                      flagged={businessMeta[biz.id]?.flagged ?? false}
                      onNote={v => updateMeta(biz.id, { note: v })}
                      onTag={v => updateMeta(biz.id, { tag: v })}
                      onFlag={() => updateMeta(biz.id, { flagged: !(businessMeta[biz.id]?.flagged ?? false) })}
                    />
                  ))}
                  {filteredBiz.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-[#333]">
                        Keine Betriebe gefunden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <div className="text-center text-xs text-[#222] py-4 border-t border-white/4">
          Founder Command Center · RestoSmart Intern · Streng vertraulich
        </div>
      </div>
    </div>
  );
}

// ─── Founder Master Brain + Auto Decision Engine ────────────────────────────

  interface BrainSystem {
    id: string; name: string; role: string; health: "green" | "yellow" | "red";
    speed: "fast" | "normal" | "slow"; errorLevel: number; riskLevel: number;
    lastUpdate: string; requiresAttention: boolean;
    actionFlag: "action_needed" | "auto_handled" | "monitoring";
    summary: string; analysis: string;
    importanceWeight: "critical" | "high" | "medium" | "low";
    connectionStatus: "connected" | "partially_connected" | "not_connected" | "not_reporting";
    connectionDetails: { sendsStatus: boolean; sendsIncidents: boolean; sendsPerformance: boolean; sendsRiskSignals: boolean; returnsHealth: boolean };
    metrics: { successRate: number; errorRate: number; activityLevel: number; responseSpeed: number };
    incidents: { open: number; healed: number; escalated: number };
    details: Record<string, any>;
    recommendedAction: string;
  }

  interface BrainPriority {
    rank: number; title: string; reason: string; impact: string; system: string;
    severity: "critical" | "high" | "medium" | "low"; score: number;
    suggestedAction: string; safeAutoAction: string | null;
    whatHappened: string; whyItMatters: string; whatWasAttempted: string; whatShouldHappenNext: string;
  }

  interface BrainAutoAction {
    id: string; timestamp: string; system: string; trigger: string;
    action: string; result: "success" | "failed" | "partial"; details: string; needsMoreAction: boolean;
  }

  interface BrainStatus {
    overallHealth: "green" | "yellow" | "red";
    healthCounts: { green: number; yellow: number; red: number };
    totalSystems: number; totalIncidentsOpen: number; totalHealed: number; avgResponseSpeed: number;
    brainMode: "monitoring" | "decision_support" | "safe_autonomous";
    brainModeReason: string; readinessPercent: number;
    connectionCounts: { connected: number; partial: number; notConnected: number; notReporting: number };
    summaryLines: string[];
    systems: BrainSystem[]; priorities: BrainPriority[]; topPriorities: BrainPriority[];
    autoActionsThisRun: BrainAutoAction[]; autoActionHistory: BrainAutoAction[];
    lastAnalysis: string;
  }

  const BRAIN_HEALTH_MAP: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    green:  { label: "Alle Systeme stabil",  color: "text-emerald-400", bg: "bg-emerald-500/8", border: "border-emerald-500/20", dot: "bg-emerald-500" },
    yellow: { label: "Warnungen aktiv",      color: "text-amber-400",   bg: "bg-amber-500/8",   border: "border-amber-500/20",   dot: "bg-amber-500" },
    red:    { label: "Kritische Probleme",   color: "text-red-400",     bg: "bg-red-500/8",     border: "border-red-500/20",     dot: "bg-red-500" },
  };

  const BRAIN_CONN_MAP: Record<string, { label: string; color: string; dot: string }> = {
    connected:            { label: "Verbunden",             color: "text-emerald-400", dot: "bg-emerald-500" },
    partially_connected:  { label: "Teilweise",             color: "text-amber-400",   dot: "bg-amber-500" },
    not_connected:        { label: "Nicht verbunden",       color: "text-red-400",     dot: "bg-red-500" },
    not_reporting:        { label: "Keine Daten",           color: "text-rose-400",    dot: "bg-rose-500" },
  };

  const BRAIN_MODE_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    monitoring:        { label: "Nur Monitoring",          color: "text-blue-400",    bg: "bg-blue-500/8",    icon: "eye" },
    decision_support:  { label: "Entscheidungshilfe",      color: "text-amber-400",   bg: "bg-amber-500/8",   icon: "brain" },
    safe_autonomous:   { label: "Sicher Autonom",          color: "text-emerald-400", bg: "bg-emerald-500/8", icon: "zap" },
  };

  const BRAIN_SEV_MAP: Record<string, { label: string; color: string; bg: string }> = {
    critical: { label: "KRITISCH", color: "text-red-400",    bg: "bg-red-500/10" },
    high:     { label: "HOCH",     color: "text-rose-400",   bg: "bg-rose-500/10" },
    medium:   { label: "MITTEL",   color: "text-amber-400",  bg: "bg-amber-500/10" },
    low:      { label: "NIEDRIG",  color: "text-blue-400",   bg: "bg-blue-500/10" },
  };

  const BRAIN_SYS_ICONS: Record<string, typeof Shield> = {
    premium: Crown, billing: Banknote, boost: Zap, growth: Rocket, competition: Activity,
    watchdog: Shield, cities: MapPin, social: Users, instant_plans: Clock, reviews: Star,
    data_integrity: CheckSquare, abuse: AlertTriangle, monetization: Euro,
    discovery: Search, map: MapPin, smart_offers: Tag, user_profiles: Users,
    reservations: Clock, loyalty: Award, conversion: BarChart3, notifications: Mail,
    auth: Lock, founder_dashboard: Crown,
    launch_control: Rocket, heat_map: Flame, auto_plans: ClipboardList,
  };

  function FounderBrainCenter({ founderKey }: { founderKey: string }) {
    const headers: Record<string, string> = { "x-founder-key": founderKey, "Content-Type": "application/json" };
    const qc = useQueryClient();
    const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<"overview" | "feed" | "actions">("overview");
    const [expandedPriority, setExpandedPriority] = useState<number | null>(null);

    const statusQuery = useQuery<BrainStatus>({
      queryKey: ["brain-status"],
      queryFn: async () => {
        const r = await fetch(`${API}/brain/status`, { headers });
        if (!r.ok) throw new Error("Failed");
        return r.json();
      },
      staleTime: 30_000, refetchInterval: 60_000,
    });

    const triggerAction = useMutation({
      mutationFn: async (actionType: string) => {
        const r = await fetch(`${API}/brain/action/${actionType}`, { method: "POST", headers });
        if (!r.ok) throw new Error("Failed");
        return r.json();
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["brain-status"] });
        qc.invalidateQueries({ queryKey: ["ops-summary"] });
        qc.invalidateQueries({ queryKey: ["ops-incidents"] });
      },
    });

    const d = statusQuery.data;
    const selected = d?.systems.find(s => s.id === selectedSystem) ?? null;
    const hStyle = d ? BRAIN_HEALTH_MAP[d.overallHealth] : BRAIN_HEALTH_MAP.green;
    const mStyle = d ? BRAIN_MODE_MAP[d.brainMode] : BRAIN_MODE_MAP.monitoring;

    if (statusQuery.isLoading) {
      return (
        <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 rounded-xl bg-white/3 animate-pulse" />)}
        </div>
      );
    }

    if (statusQuery.isError) {
      return (
        <div className="max-w-screen-xl mx-auto px-6 py-8">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-red-400 mb-1">Brain-Analyse fehlgeschlagen</p>
            <p className="text-[11px] text-[#555] mb-3">Verbindung zum System konnte nicht hergestellt werden.</p>
            <button onClick={() => statusQuery.refetch()} className="text-[11px] font-bold text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 px-4 py-1.5 rounded-xl hover:bg-emerald-500/15 transition-colors">
              Erneut versuchen
            </button>
          </div>
        </div>
      );
    }

    if (!d) return null;

    return (
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-5">

        {/* ── FOUNDER SUMMARY BLOCK ──────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", hStyle.dot)}>
                <Flame className="w-6 h-6 text-white" />
              </div>
              <span className={cn("absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0a0a0f] animate-pulse", hStyle.dot)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Master Brain</h2>
                <span className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full border", hStyle.color, hStyle.bg, hStyle.border)}>{hStyle.label}</span>
                <span className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-white/10", mStyle.color, mStyle.bg)}>{mStyle.label}</span>
              </div>
              <p className="text-[10px] text-[#444] mt-0.5">{d.totalSystems} Systeme verbunden · Zentrale Intelligenz · Auto Decision Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => triggerAction.mutate("health-check")} disabled={triggerAction.isPending}
              className={cn("flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all",
                triggerAction.isPending ? "text-[#444] border-white/6 bg-white/2" : "text-emerald-400 border-emerald-500/20 bg-emerald-500/8 hover:bg-emerald-500/15")}>
              <Zap className="w-3 h-3" />{triggerAction.isPending ? "Läuft..." : "System-Check"}
            </button>
            <button onClick={() => qc.invalidateQueries({ queryKey: ["brain-status"] })} className="text-[#444] hover:text-[#888] transition-colors p-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── SUMMARY LINES ──────────────────────────────────────────── */}
        <div className={cn("rounded-xl border px-4 py-3", hStyle.border, hStyle.bg)}>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {d.summaryLines.map((line, i) => (
              <span key={i} className="text-[11px] font-medium text-white/80 flex items-center gap-1.5">
                <span className={cn("w-1 h-1 rounded-full shrink-0", hStyle.dot)} />{line}
              </span>
            ))}
          </div>
        </div>

        {/* ── READINESS + MODE + HEALTH GRID ─────────────────────────── */}
        <div className="grid grid-cols-8 gap-2">
          <div className={cn("rounded-xl border px-3 py-2.5 text-center", hStyle.border, hStyle.bg)}>
            <p className={cn("text-lg font-bold", hStyle.color)}>{d.totalSystems}</p>
            <p className="text-[8px] text-[#444]">Systeme</p>
          </div>
          <div className="rounded-xl border border-emerald-500/12 bg-emerald-500/3 px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-emerald-400">{d.healthCounts.green}</p>
            <p className="text-[8px] text-[#444]">Stabil</p>
          </div>
          <div className="rounded-xl border border-amber-500/12 bg-amber-500/3 px-3 py-2.5 text-center">
            <p className={cn("text-lg font-bold", d.healthCounts.yellow > 0 ? "text-amber-400" : "text-[#333]")}>{d.healthCounts.yellow}</p>
            <p className="text-[8px] text-[#444]">Warnung</p>
          </div>
          <div className="rounded-xl border border-red-500/12 bg-red-500/3 px-3 py-2.5 text-center">
            <p className={cn("text-lg font-bold", d.healthCounts.red > 0 ? "text-red-400" : "text-[#333]")}>{d.healthCounts.red}</p>
            <p className="text-[8px] text-[#444]">Kritisch</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/2 px-3 py-2.5 text-center">
            <p className={cn("text-lg font-bold", d.totalIncidentsOpen > 0 ? "text-amber-400" : "text-emerald-400")}>{d.totalIncidentsOpen}</p>
            <p className="text-[8px] text-[#444]">Incidents</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/2 px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-emerald-400">{d.totalHealed}</p>
            <p className="text-[8px] text-[#444]">Auto-Geheilt</p>
          </div>
          <div className="rounded-xl border border-violet-500/12 bg-violet-500/3 px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-violet-400">{d.readinessPercent}%</p>
            <p className="text-[8px] text-[#444]">Readiness</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/2 px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-blue-400">{d.connectionCounts.connected}</p>
            <p className="text-[8px] text-[#444]">Voll verb.</p>
          </div>
        </div>

        {/* ── BRAIN MODE WARNING ─────────────────────────────────────── */}
        {d.brainMode !== "safe_autonomous" && (
          <div className={cn("rounded-xl border px-4 py-3 flex items-center gap-3",
            d.brainMode === "monitoring" ? "border-blue-500/15 bg-blue-500/3" : "border-amber-500/15 bg-amber-500/3")}>
            <Eye className={cn("w-4 h-4 shrink-0", d.brainMode === "monitoring" ? "text-blue-400" : "text-amber-400")} />
            <div>
              <p className={cn("text-[11px] font-bold", d.brainMode === "monitoring" ? "text-blue-400" : "text-amber-400")}>
                {d.brainMode === "monitoring" ? "Autonomer Modus deaktiviert" : "Eingeschränkter Modus"}
              </p>
              <p className="text-[10px] text-[#555]">{d.brainModeReason}</p>
            </div>
          </div>
        )}

        {/* ── SECTION TABS ───────────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-white/6 pb-0.5">
          {[
            { key: "overview" as const, label: "System-Übersicht", icon: BarChart3 },
            { key: "feed" as const, label: "Founder Intelligence Feed", icon: Activity },
            { key: "actions" as const, label: "Auto-Actions & History", icon: Zap },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveSection(tab.key)}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[10px] font-bold transition-all",
                activeSection === tab.key ? "bg-white/6 text-white border-b-2 border-violet-400" : "text-[#444] hover:text-[#888] hover:bg-white/3")}>
              <tab.icon className="w-3 h-3" />{tab.label}
            </button>
          ))}
        </div>

        {/* ── PRIORITY PANEL ─────────────────────────────────────────── */}
        {d.topPriorities.length > 0 && activeSection === "overview" && (
          <div className="rounded-xl border border-red-500/15 bg-red-500/3 px-4 py-3.5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-3.5 h-3.5 text-red-400" />
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest">Was jetzt Aufmerksamkeit braucht</p>
            </div>
            <div className="space-y-2">
              {d.topPriorities.map((p, i) => {
                const sev = BRAIN_SEV_MAP[p.severity] ?? BRAIN_SEV_MAP.medium;
                const isExpanded = expandedPriority === i;
                return (
                  <div key={i} className="rounded-lg bg-white/3 overflow-hidden">
                    <button onClick={() => setExpandedPriority(isExpanded ? null : i)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 text-left">
                      <span className="text-base font-bold text-red-400/60 mt-0.5">#{p.rank}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-white">{p.title}</p>
                        <p className="text-[10px] text-[#555] mt-0.5">{p.reason}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn("text-[9px] font-bold", sev.color)}>{p.impact}</span>
                          <span className="text-[9px] text-[#333]">Score: {p.score}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", sev.color, sev.bg)}>{sev.label}</span>
                        {p.safeAutoAction && (
                          <button onClick={(e) => { e.stopPropagation(); triggerAction.mutate(p.safeAutoAction!); }}
                            disabled={triggerAction.isPending}
                            className="text-[9px] font-bold text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 px-2 py-0.5 rounded hover:bg-emerald-500/15 transition-colors">
                            Auto-Fix
                          </button>
                        )}
                        <ChevronDown className={cn("w-3 h-3 text-[#444] transition-transform", isExpanded && "rotate-180")} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-white/3 px-3 py-2">
                          <p className="text-[8px] text-[#444] uppercase tracking-widest font-bold mb-1">Was ist passiert</p>
                          <p className="text-[10px] text-white/80">{p.whatHappened}</p>
                        </div>
                        <div className="rounded-lg bg-white/3 px-3 py-2">
                          <p className="text-[8px] text-[#444] uppercase tracking-widest font-bold mb-1">Warum es wichtig ist</p>
                          <p className="text-[10px] text-white/80">{p.whyItMatters}</p>
                        </div>
                        <div className="rounded-lg bg-white/3 px-3 py-2">
                          <p className="text-[8px] text-[#444] uppercase tracking-widest font-bold mb-1">Nächster Schritt</p>
                          <p className="text-[10px] text-white/80">{p.whatShouldHappenNext}</p>
                          {p.whatWasAttempted !== "Noch keine automatische Aktion durchgeführt" && (
                            <p className="text-[9px] text-emerald-400/70 mt-1">Bereits versucht: {p.whatWasAttempted}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {d.priorities.length > 3 && (
              <p className="text-[9px] text-[#444] mt-2 text-center">+ {d.priorities.length - 3} weitere Probleme erkannt</p>
            )}
          </div>
        )}

        {/* ══════ SECTION: OVERVIEW ═══════════════════════════════════ */}
        {activeSection === "overview" && (
          <div className="grid grid-cols-12 gap-4">
            {/* LEFT: System Cards */}
            <div className="col-span-5 space-y-1">
              <p className="text-[9px] text-[#444] uppercase tracking-widest font-bold mb-1">Alle {d.totalSystems} Systeme</p>
              <div className="max-h-[600px] overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-white/5">
                {d.systems.map(sys => {
                  const Icon = BRAIN_SYS_ICONS[sys.id] ?? Shield;
                  const connStyle = BRAIN_CONN_MAP[sys.connectionStatus] ?? BRAIN_CONN_MAP.not_connected;
                  const isSelected = selectedSystem === sys.id;
                  return (
                    <button key={sys.id} onClick={() => setSelectedSystem(isSelected ? null : sys.id)}
                      className={cn("w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all",
                        isSelected ? "bg-white/6 border-violet-500/25 ring-1 ring-violet-500/10"
                          : sys.health === "red" ? "bg-red-500/3 border-red-500/15 hover:bg-red-500/5"
                          : sys.health === "yellow" ? "bg-amber-500/2 border-amber-500/10 hover:bg-amber-500/5"
                          : "bg-white/2 border-white/6 hover:bg-white/4")}>
                      <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                        sys.health === "green" ? "bg-emerald-500/15" : sys.health === "yellow" ? "bg-amber-500/15" : "bg-red-500/15")}>
                        <Icon className={cn("w-3 h-3", sys.health === "green" ? "text-emerald-400" : sys.health === "yellow" ? "text-amber-400" : "text-red-400")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[10px] font-semibold text-white truncate">{sys.name}</p>
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sys.health === "green" ? "bg-emerald-500" : sys.health === "yellow" ? "bg-amber-500" : "bg-red-500")} />
                        </div>
                        <p className="text-[8px] text-[#555] truncate">{sys.summary}</p>
                      </div>
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", connStyle.dot)} title={connStyle.label} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Detail Panel */}
            <div className="col-span-7">
              {!selected ? (
                <div className="rounded-2xl border border-white/6 bg-white/2 h-full flex flex-col items-center justify-center p-8">
                  <Flame className="w-10 h-10 text-violet-400/20 mb-3" />
                  <p className="text-xs text-[#555]">System auswählen für Details</p>
                  <p className="text-[10px] text-[#333] mt-1">Klicke auf ein System links</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
                  {/* Header */}
                  <div className={cn("px-5 py-4 border-b",
                    selected.health === "red" ? "bg-red-500/3 border-red-500/10"
                      : selected.health === "yellow" ? "bg-amber-500/3 border-amber-500/10" : "bg-emerald-500/3 border-emerald-500/10")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {(() => { const I = BRAIN_SYS_ICONS[selected.id] ?? Shield; return <I className={cn("w-5 h-5", selected.health === "green" ? "text-emerald-400" : selected.health === "yellow" ? "text-amber-400" : "text-red-400")} />; })()}
                        <div>
                          <h3 className="text-sm font-bold text-white">{selected.name}</h3>
                          <p className="text-[10px] text-[#555]">{selected.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                          selected.health === "green" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : selected.health === "yellow" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                            : "text-red-400 bg-red-500/10 border-red-500/20")}>
                          {selected.health === "green" ? "Stabil" : selected.health === "yellow" ? "Warnung" : "Kritisch"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-4">
                    {/* Analysis */}
                    <div className={cn("rounded-lg border px-3 py-2.5",
                      selected.health === "red" ? "bg-red-500/5 border-red-500/15"
                        : selected.health === "yellow" ? "bg-amber-500/5 border-amber-500/15" : "bg-emerald-500/5 border-emerald-500/15")}>
                      <p className="text-[9px] text-[#444] uppercase tracking-widest font-bold mb-0.5">Live-Analyse</p>
                      <p className={cn("text-[11px] font-medium",
                        selected.health === "green" ? "text-emerald-400" : selected.health === "yellow" ? "text-amber-400" : "text-red-400")}>{selected.analysis}</p>
                    </div>

                    {/* Connection Verification */}
                    <div>
                      <p className="text-[9px] text-[#444] uppercase tracking-widest font-bold mb-1.5">Verbindungs-Verifikation</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { key: "sendsStatus", label: "Status" },
                          { key: "sendsIncidents", label: "Incidents" },
                          { key: "sendsPerformance", label: "Performance" },
                          { key: "sendsRiskSignals", label: "Risiko" },
                          { key: "returnsHealth", label: "Health" },
                        ].map(check => {
                          const ok = (selected.connectionDetails as any)[check.key];
                          return (
                            <div key={check.key} className={cn("rounded-lg px-2 py-1.5 text-center border",
                              ok ? "border-emerald-500/15 bg-emerald-500/5" : "border-red-500/15 bg-red-500/5")}>
                              <p className={cn("text-[9px] font-bold", ok ? "text-emerald-400" : "text-red-400")}>{ok ? "OK" : "—"}</p>
                              <p className="text-[7px] text-[#444]">{check.label}</p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={cn("w-1.5 h-1.5 rounded-full", BRAIN_CONN_MAP[selected.connectionStatus]?.dot)} />
                        <span className={cn("text-[9px] font-bold", BRAIN_CONN_MAP[selected.connectionStatus]?.color)}>
                          {BRAIN_CONN_MAP[selected.connectionStatus]?.label}
                        </span>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="rounded-lg bg-white/3 px-3 py-2 text-center">
                        <p className={cn("text-sm font-bold", selected.metrics.successRate >= 90 ? "text-emerald-400" : selected.metrics.successRate >= 70 ? "text-amber-400" : "text-red-400")}>{selected.metrics.successRate}%</p>
                        <p className="text-[8px] text-[#444]">Erfolgsrate</p>
                      </div>
                      <div className="rounded-lg bg-white/3 px-3 py-2 text-center">
                        <p className={cn("text-sm font-bold", selected.metrics.errorRate === 0 ? "text-emerald-400" : "text-rose-400")}>{selected.metrics.errorRate}</p>
                        <p className="text-[8px] text-[#444]">Fehler</p>
                      </div>
                      <div className="rounded-lg bg-white/3 px-3 py-2 text-center">
                        <p className="text-sm font-bold text-blue-400">{selected.metrics.activityLevel}</p>
                        <p className="text-[8px] text-[#444]">Aktivität</p>
                      </div>
                      <div className="rounded-lg bg-white/3 px-3 py-2 text-center">
                        <p className={cn("text-sm font-bold", selected.metrics.responseSpeed < 100 ? "text-emerald-400" : selected.metrics.responseSpeed < 500 ? "text-amber-400" : "text-rose-400")}>{selected.metrics.responseSpeed}ms</p>
                        <p className="text-[8px] text-[#444]">Speed</p>
                      </div>
                    </div>

                    {/* Speed Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] text-[#444] font-bold">Performance</p>
                        <p className="text-[9px] text-[#555]">{selected.speed === "fast" ? "Schnell" : selected.speed === "normal" ? "Normal" : "Langsam"}</p>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all",
                          selected.speed === "fast" ? "bg-emerald-500 w-full" : selected.speed === "normal" ? "bg-amber-500 w-2/3" : "bg-rose-500 w-1/3")} />
                      </div>
                    </div>

                    {/* Incidents */}
                    {(selected.incidents.open > 0 || selected.incidents.healed > 0 || selected.incidents.escalated > 0) && (
                      <div className="flex items-center gap-3">
                        <p className="text-[9px] text-[#444] font-bold">Incidents:</p>
                        {selected.incidents.open > 0 && <span className="text-[10px] text-amber-400 font-medium">{selected.incidents.open} offen</span>}
                        {selected.incidents.healed > 0 && <span className="text-[10px] text-emerald-400 font-medium">{selected.incidents.healed} geheilt</span>}
                        {selected.incidents.escalated > 0 && <span className="text-[10px] text-rose-400 font-medium">{selected.incidents.escalated} eskaliert</span>}
                      </div>
                    )}

                    {/* Recommended Action */}
                    <div className="rounded-lg border border-violet-500/15 bg-violet-500/3 px-3 py-2">
                      <p className="text-[9px] text-[#444] uppercase tracking-widest font-bold mb-0.5">Empfohlene Aktion</p>
                      <p className="text-[10px] text-violet-400 font-medium">{selected.recommendedAction}</p>
                    </div>

                    {/* Last Update */}
                    <div className="flex items-center gap-2 text-[9px] text-[#333]">
                      <Clock className="w-2.5 h-2.5" />
                      Letzte Aktualisierung: {new Date(selected.lastUpdate).toLocaleString("de-AT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ SECTION: FOUNDER INTELLIGENCE FEED ══════════════════ */}
        {activeSection === "feed" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/6 bg-white/2 px-4 py-3.5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-3.5 h-3.5 text-violet-400" />
                <p className="text-[11px] font-bold text-violet-400 uppercase tracking-widest">Founder Intelligence Feed</p>
              </div>
              <div className="space-y-1.5">
                {/* Critical incidents */}
                {d.priorities.filter(p => p.severity === "critical" || p.severity === "high").map((p, i) => (
                  <div key={`crit-${i}`} className="flex items-center gap-3 rounded-lg bg-red-500/5 border border-red-500/10 px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-red-400">{p.title}</p>
                      <p className="text-[9px] text-[#555]">{p.whatShouldHappenNext}</p>
                    </div>
                    <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded", BRAIN_SEV_MAP[p.severity]?.color, BRAIN_SEV_MAP[p.severity]?.bg)}>{BRAIN_SEV_MAP[p.severity]?.label}</span>
                  </div>
                ))}
                {/* Auto-fixed items */}
                {d.autoActionHistory.filter(a => a.result === "success").slice(-5).map((a, i) => (
                  <div key={`auto-${i}`} className="flex items-center gap-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-emerald-400">Auto-Fix: {a.action}</p>
                      <p className="text-[9px] text-[#555]">{a.details}</p>
                    </div>
                    <span className="text-[8px] text-[#333]">{new Date(a.timestamp).toLocaleTimeString("de-AT")}</span>
                  </div>
                ))}
                {/* Manual review queue */}
                {d.priorities.filter(p => !p.safeAutoAction && p.severity !== "low").map((p, i) => (
                  <div key={`review-${i}`} className="flex items-center gap-3 rounded-lg bg-amber-500/5 border border-amber-500/10 px-3 py-2">
                    <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-amber-400">Review nötig: {p.title}</p>
                      <p className="text-[9px] text-[#555]">{p.suggestedAction}</p>
                    </div>
                  </div>
                ))}
                {/* Connection warnings */}
                {d.systems.filter(s => s.connectionStatus === "not_connected" || s.connectionStatus === "not_reporting").map((s, i) => (
                  <div key={`conn-${i}`} className="flex items-center gap-3 rounded-lg bg-rose-500/5 border border-rose-500/10 px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-rose-400">Verbindungsproblem: {s.name}</p>
                      <p className="text-[9px] text-[#555]">{BRAIN_CONN_MAP[s.connectionStatus]?.label}</p>
                    </div>
                  </div>
                ))}
                {/* Brain mode decisions */}
                <div className="flex items-center gap-3 rounded-lg bg-white/3 border border-white/6 px-3 py-2">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-blue-400">Brain-Modus: {BRAIN_MODE_MAP[d.brainMode]?.label}</p>
                    <p className="text-[9px] text-[#555]">{d.brainModeReason}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* All priorities with full detail */}
            {d.priorities.length > 0 && (
              <div className="rounded-xl border border-white/6 bg-white/2 px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-3.5 h-3.5 text-violet-400" />
                  <p className="text-[11px] font-bold text-violet-400 uppercase tracking-widest">Auto Decision Engine — Priorisierte Probleme</p>
                </div>
                <div className="space-y-1.5">
                  {d.priorities.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-white/3 px-3 py-2">
                      <span className={cn("text-[10px] font-bold w-6 shrink-0", BRAIN_SEV_MAP[p.severity]?.color)}>#{p.rank}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white font-medium truncate">{p.suggestedAction}</p>
                        <p className="text-[9px] text-[#444] mt-0.5">{d.systems.find(s => s.id === p.system)?.name ?? p.system} · {p.impact}</p>
                      </div>
                      <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0", BRAIN_SEV_MAP[p.severity]?.color, BRAIN_SEV_MAP[p.severity]?.bg)}>{p.score}</span>
                      {p.safeAutoAction && (
                        <button onClick={() => triggerAction.mutate(p.safeAutoAction!)} disabled={triggerAction.isPending}
                          className="text-[9px] font-bold text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 px-2 py-0.5 rounded hover:bg-emerald-500/15 transition-colors shrink-0">Auto</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════ SECTION: AUTO-ACTIONS & HISTORY ═════════════════════ */}
        {activeSection === "actions" && (
          <div className="space-y-4">
            {/* Auto-actions this run */}
            {d.autoActionsThisRun.length > 0 && (
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/3 px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">Auto-Aktionen dieser Analyse</p>
                </div>
                <div className="space-y-1.5">
                  {d.autoActionsThisRun.map((a, i) => (
                    <div key={i} className={cn("flex items-center gap-3 rounded-lg px-3 py-2",
                      a.result === "success" ? "bg-emerald-500/5 border border-emerald-500/10"
                        : a.result === "failed" ? "bg-red-500/5 border border-red-500/10"
                        : "bg-amber-500/5 border border-amber-500/10")}>
                      {a.result === "success" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        : a.result === "failed" ? <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        : <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-white">{a.trigger}</p>
                        <p className="text-[9px] text-[#555]">Aktion: {a.action} · {a.details}</p>
                      </div>
                      {a.needsMoreAction && <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Follow-up</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            <div className="rounded-xl border border-white/6 bg-white/2 px-4 py-3.5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-violet-400" />
                <p className="text-[11px] font-bold text-violet-400 uppercase tracking-widest">Auto-Action History</p>
              </div>
              {d.autoActionHistory.length === 0 ? (
                <p className="text-[10px] text-[#444] text-center py-4">Noch keine automatischen Aktionen durchgeführt</p>
              ) : (
                <div className="space-y-1">
                  {d.autoActionHistory.slice().reverse().map((a, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-white/3 px-3 py-2">
                      {a.result === "success" ? <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                        : <X className="w-3 h-3 text-red-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-white font-medium truncate">{a.action}: {a.trigger}</p>
                        <p className="text-[9px] text-[#444]">{a.details}</p>
                      </div>
                      <span className="text-[8px] text-[#333] shrink-0">{new Date(a.timestamp).toLocaleString("de-AT", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual triggers */}
            <div className="rounded-xl border border-white/6 bg-white/2 px-4 py-3.5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-3.5 h-3.5 text-violet-400" />
                <p className="text-[11px] font-bold text-violet-400 uppercase tracking-widest">Manuelle Aktionen</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { action: "health-check", label: "Health Check", desc: "Alle Systeme prüfen", color: "emerald" },
                  { action: "billing-reconcile", label: "Billing Abgleich", desc: "Zahlungswahrheit prüfen", color: "violet" },
                  { action: "retry-open", label: "Retry Open", desc: "Offene Incidents wiederholen", color: "amber" },
                ].map(btn => (
                  <button key={btn.action} onClick={() => triggerAction.mutate(btn.action)} disabled={triggerAction.isPending}
                    className={cn("rounded-xl border px-4 py-3 text-left transition-all hover:bg-white/4",
                      `border-${btn.color}-500/15 bg-${btn.color}-500/3`)}>
                    <p className={`text-[11px] font-bold text-${btn.color}-400`}>{btn.label}</p>
                    <p className="text-[9px] text-[#555] mt-0.5">{btn.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FOOTER ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/4 bg-white/1 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-3 h-3 text-violet-400/40" />
              <span className="text-[10px] text-[#444] font-semibold">Master Brain v2 — Zentrale Intelligenz</span>
            </div>
            <div className="flex flex-wrap gap-3 text-[9px] text-[#333]">
              <span>{d.totalSystems} Systeme</span>
              <span>Modus: {BRAIN_MODE_MAP[d.brainMode]?.label}</span>
              <span>Readiness: {d.readinessPercent}%</span>
              <span>Ø {d.avgResponseSpeed}ms</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Founder Ops Center (Hardened Mission Control) ───────────────────────────

interface OpsIncident {
  id: number;
  title: string;
  system_area: string;
  severity: string;
  detected_at: string;
  resolved_at: string | null;
  affected_entity: string | null;
  affected_city: string | null;
  technical_summary: string;
  anomaly_detected: string | null;
  billing_truth: string | null;
  platform_truth: string | null;
  auto_action_taken: string | null;
  recovery_result: string | null;
  recommended_action: string | null;
  needs_manual_review: boolean;
  status: string;
  incident_type: string;
  auto_healed: boolean;
  retry_count: number;
  max_retries: number;
  healing_action_type: string | null;
  last_retry_at: string | null;
}

interface OpsSummary {
  health: string;
  counts: {
    total: number;
    open: number;
    resolved: number;
    escalated: number;
    pendingReview: number;
    criticalOpen: number;
    highOpen: number;
    mediumOpen: number;
    lowOpen: number;
    last24h: number;
    last7d: number;
    autoHealedTotal: number;
    autoHealed24h: number;
    retriedTotal: number;
    retryExhausted: number;
  };
  recentCritical: any[];
  systemAreas: any[];
  healingStats: any[];
  scheduledChecks: {
    enabled: boolean;
    intervalMinutes: number;
    lastRun: string | null;
  };
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string; order: number }> = {
  critical: { bg: "bg-red-500/10",   text: "text-red-400",    border: "border-red-500/25",    label: "KRITISCH", order: 0 },
  high:     { bg: "bg-rose-500/10",  text: "text-rose-400",   border: "border-rose-500/25",   label: "HOCH",     order: 1 },
  medium:   { bg: "bg-amber-500/10", text: "text-amber-400",  border: "border-amber-500/25",  label: "MITTEL",   order: 2 },
  low:      { bg: "bg-blue-500/10",  text: "text-blue-400",   border: "border-blue-500/25",   label: "NIEDRIG",  order: 3 },
};

const HEALTH_STYLES: Record<string, { color: string; label: string; icon: string; pulse: string }> = {
  healthy:  { color: "text-emerald-400", label: "Gesund",         icon: "bg-emerald-500", pulse: "shadow-emerald-500/40" },
  warning:  { color: "text-amber-400",   label: "Warnung",        icon: "bg-amber-500",   pulse: "shadow-amber-500/40" },
  degraded: { color: "text-rose-400",    label: "Beeinträchtigt", icon: "bg-rose-500",    pulse: "shadow-rose-500/40" },
  critical: { color: "text-red-400",     label: "Kritisch",       icon: "bg-red-500",     pulse: "shadow-red-500/40" },
};

const AREA_LABELS: Record<string, string> = {
  boost_delivery: "Boost-Auslieferung",
  boost_integrity: "Boost-Integrität",
  billing_integrity: "Billing-Integrität",
  billing_reconciliation: "Billing-Abgleich",
  platform_consistency: "Plattform-Konsistenz",
  data_integrity: "Daten-Integrität",
  city_health: "Stadt-Gesundheit",
  abuse_detection: "Missbrauchs-Erkennung",
  growth_anomaly: "Wachstums-Anomalie",
  revenue_monitoring: "Umsatz-Monitoring",
};

const REVENUE_AREAS = new Set([
  "billing_integrity", "billing_reconciliation", "boost_delivery",
  "boost_integrity", "revenue_monitoring",
]);

const OPS_GROUP_CONFIG: { key: string; label: string; icon: typeof Shield; areas: string[] }[] = [
  { key: "billing", label: "Billing / Zahlungen", icon: Banknote, areas: ["billing_integrity", "billing_reconciliation"] },
  { key: "boost",   label: "Boost / Monetarisierung", icon: Zap, areas: ["boost_delivery", "boost_integrity"] },
  { key: "platform", label: "Plattform-Integrität", icon: Shield, areas: ["platform_consistency", "data_integrity"] },
  { key: "abuse",   label: "Missbrauch / Betrugsrisiko", icon: AlertTriangle, areas: ["abuse_detection"] },
  { key: "growth",  label: "Wachstum / Städte", icon: TrendingUp, areas: ["growth_anomaly", "city_health", "revenue_monitoring"] },
];

const HEALING_LABELS: Record<string, string> = {
  counter_reset: "Counter-Reset",
  pause_boosts_inactive_restaurant: "Boost-Pause (inaktiv)",
  pause_overspend_campaign: "Budget-Schutz-Pause",
  rating_clamp: "Rating-Korrektur",
  info_only: "Nur Info",
};

function isRevenueImpact(inc: OpsIncident): boolean {
  return REVENUE_AREAS.has(inc.system_area) || inc.system_area.includes("billing") || inc.system_area.includes("boost");
}

function getImpactStatement(inc: OpsIncident): string {
  if (inc.system_area === "billing_integrity") return "Direkte Auswirkung auf Umsatz und Abrechnung";
  if (inc.system_area === "billing_reconciliation") return "Abrechnungsstatus stimmt nicht mit Plattform überein";
  if (inc.system_area === "boost_delivery") return "Bezahlte Kampagne liefert nicht — Kundenzufriedenheit gefährdet";
  if (inc.system_area === "boost_integrity") return "Boost-System-Fehler — Monetarisierung betroffen";
  if (inc.system_area === "abuse_detection") return "Möglicher Missbrauch — Plattformintegrität gefährdet";
  if (inc.system_area === "data_integrity") return "Dateninkonsistenz — Vertrauenswürdigkeit betroffen";
  if (inc.system_area === "revenue_monitoring") return "Umsatzanomalie erkannt — Monitoring erforderlich";
  return "Plattformstabilität betroffen";
}

function sortIncidents(list: OpsIncident[]): OpsIncident[] {
  return [...list].sort((a, b) => {
    const sevA = SEVERITY_STYLES[a.severity]?.order ?? 4;
    const sevB = SEVERITY_STYLES[b.severity]?.order ?? 4;
    if (sevA !== sevB) return sevA - sevB;
    return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
  });
}

function FounderOpsCenter({ founderKey }: { founderKey: string }) {
  const headers: Record<string, string> = { "x-founder-key": founderKey, "Content-Type": "application/json" };
  const qc = useQueryClient();
  type OpsFilter = "attention" | "needs_review" | "auto_healed" | "billing" | "open" | "all" | "resolved" | "escalated";
  const [filter, setFilter] = useState<OpsFilter>("attention");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [collapsedLow, setCollapsedLow] = useState(true);

  const invalidateOps = () => {
    qc.invalidateQueries({ queryKey: ["ops-summary"] });
    qc.invalidateQueries({ queryKey: ["ops-incidents"] });
    qc.invalidateQueries({ queryKey: ["ops-all-incidents"] });
  };

  const summaryQuery = useQuery<OpsSummary>({
    queryKey: ["ops-summary"],
    queryFn: async () => {
      const r = await fetch(`${API}/ops/summary`, { headers });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 30_000,
  });

  const incidentsQuery = useQuery<{ incidents: OpsIncident[] }>({
    queryKey: ["ops-incidents", filter],
    queryFn: async () => {
      let url = `${API}/ops/incidents`;
      if (filter === "attention") url += "?status=open";
      else if (filter === "needs_review") url += "?category=needs_review";
      else if (filter === "auto_healed") url += "?category=auto_healed";
      else if (filter === "billing") url += "?category=billing";
      else if (filter === "open") url += "?status=open";
      else if (filter === "resolved") url += "?status=resolved";
      else if (filter === "escalated") url += "?status=escalated";
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 30_000,
  });

  const allIncidentsQuery = useQuery<{ incidents: OpsIncident[] }>({
    queryKey: ["ops-all-incidents"],
    queryFn: async () => {
      const r = await fetch(`${API}/ops/incidents`, { headers });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 30_000,
  });

  const runHealthCheck = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/ops/health-check`, { method: "POST", headers });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: invalidateOps,
  });

  const runBillingReconcile = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/ops/billing-reconcile`, { method: "POST", headers });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: invalidateOps,
  });

  const runRetry = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/ops/retry-open`, { method: "POST", headers });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: invalidateOps,
  });

  const updateIncident = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`${API}/ops/incidents/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: invalidateOps,
  });

  const s = summaryQuery.data;
  const rawIncidents = incidentsQuery.data?.incidents ?? [];
  const incidents = sortIncidents(rawIncidents);
  const allIncidents = allIncidentsQuery.data?.incidents ?? [];
  const healthStyle = HEALTH_STYLES[s?.health ?? "healthy"];

  const attentionItems = allIncidents.filter(
    i => (i.status === "open" && (i.severity === "critical" || i.severity === "high" || i.needs_manual_review)) ||
         i.status === "escalated"
  );
  const sortedAttention = sortIncidents(attentionItems);

  const highPrioIncidents = incidents.filter(i => i.severity !== "low");
  const lowPrioIncidents = incidents.filter(i => i.severity === "low");

  const groupedCounts = OPS_GROUP_CONFIG.map(g => {
    const matching = allIncidents.filter(i => g.areas.includes(i.system_area));
    const open = matching.filter(i => i.status === "open").length;
    const critical = matching.filter(i => i.severity === "critical" && i.status === "open").length;
    const high = matching.filter(i => i.severity === "high" && i.status === "open").length;
    const healed = matching.filter(i => i.auto_healed).length;
    return { ...g, total: matching.length, open, critical, high, healed };
  }).filter(g => g.total > 0);

  function buildSmartSummary(): string[] {
    if (!s) return [];
    const lines: string[] = [];
    if (s.counts.criticalOpen > 0) lines.push(`${s.counts.criticalOpen} kritische${s.counts.criticalOpen > 1 ? " Probleme brauchen" : "s Problem braucht"} sofortige Aufmerksamkeit`);
    else if (s.counts.highOpen > 0) lines.push(`${s.counts.highOpen} Problem${s.counts.highOpen > 1 ? "e" : ""} mit hoher Priorität offen`);
    if (s.counts.pendingReview > 0) lines.push(`${s.counts.pendingReview} Incident${s.counts.pendingReview > 1 ? "s" : ""} warten auf manuelle Prüfung`);
    if (s.counts.autoHealed24h > 0) lines.push(`${s.counts.autoHealed24h} Problem${s.counts.autoHealed24h > 1 ? "e" : ""} heute automatisch repariert`);
    if (s.counts.escalated > 0) lines.push(`${s.counts.escalated} eskaliert${s.counts.escalated > 1 ? "e Incidents" : "er Incident"} — Retry ausgeschöpft`);
    const billingOpen = allIncidents.filter(i => (i.system_area.includes("billing") || i.system_area.includes("boost")) && i.status === "open").length;
    if (billingOpen > 0) lines.push(`${billingOpen} offene${billingOpen > 1 ? " Billing-Probleme" : "s Billing-Problem"} erkannt`);
    if (lines.length === 0) lines.push("System ist stabil — keine Probleme erkannt");
    return lines;
  }

  const filterTabs: { key: OpsFilter; label: string; count?: number; color?: string }[] = [
    { key: "attention",    label: "Aufmerksamkeit",  count: sortedAttention.length, color: sortedAttention.length ? "text-red-400" : undefined },
    { key: "needs_review", label: "Review nötig",    count: s?.counts.pendingReview, color: s?.counts.pendingReview ? "text-amber-400" : undefined },
    { key: "auto_healed",  label: "Auto-Repariert",  count: s?.counts.autoHealedTotal, color: "text-emerald-400" },
    { key: "billing",      label: "Billing" },
    { key: "open",         label: "Offen",           count: s?.counts.open },
    { key: "escalated",    label: "Eskaliert",       count: s?.counts.escalated, color: s?.counts.escalated ? "text-rose-400" : undefined },
    { key: "all",          label: "Alle" },
    { key: "resolved",     label: "Gelöst" },
  ];

  const renderIncidentCard = (inc: OpsIncident) => {
    const sev = SEVERITY_STYLES[inc.severity] ?? SEVERITY_STYLES.low;
    const isExpanded = expandedId === inc.id;
    const revenueTag = isRevenueImpact(inc);

    return (
      <div
        key={inc.id}
        className={cn(
          "rounded-xl border bg-white/2 overflow-hidden transition-all",
          inc.severity === "critical" && inc.status === "open" ? "border-red-500/30 ring-1 ring-red-500/10" :
          inc.severity === "high" && inc.status === "open" ? "border-rose-500/25" :
          inc.auto_healed ? "border-emerald-500/15" :
          inc.status === "resolved" ? "border-white/4 opacity-60" :
          inc.status === "escalated" ? "border-rose-500/20" :
          "border-white/6"
        )}
      >
        <button
          onClick={() => setExpandedId(isExpanded ? null : inc.id)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/2 transition-colors"
        >
          <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0", sev.bg, sev.text, sev.border)}>
            {sev.label}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-white truncate">{inc.title}</p>
              {revenueTag && inc.status === "open" && (
                <span className="text-[8px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-px rounded shrink-0 uppercase tracking-wider">
                  Umsatz
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-[#444]">
                {AREA_LABELS[inc.system_area] ?? inc.system_area}
              </span>
              {inc.affected_entity && (
                <span className="text-[10px] text-[#555] truncate max-w-[140px]">{inc.affected_entity}</span>
              )}
              {inc.affected_city && (
                <span className="text-[10px] text-[#333]">{inc.affected_city}</span>
              )}
              <span className="text-[10px] text-[#333]">
                {new Date(inc.detected_at).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {inc.auto_healed && (
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                AUTO-FIX
              </span>
            )}
            {inc.retry_count > 0 && !inc.auto_healed && (
              <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                RETRY {inc.retry_count}/{inc.max_retries}
              </span>
            )}
            {inc.needs_manual_review && inc.status === "open" && !inc.auto_healed && (
              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                REVIEW
              </span>
            )}
            <span className={cn(
              "text-[9px] font-bold px-2 py-0.5 rounded-full",
              inc.status === "open" ? "text-amber-400 bg-amber-500/8"
              : inc.status === "resolved" ? "text-emerald-400 bg-emerald-500/8"
              : inc.status === "escalated" ? "text-rose-400 bg-rose-500/8"
              : "text-[#444] bg-white/5"
            )}>
              {inc.status === "open" ? "Offen" : inc.status === "resolved" ? "Gelöst" : inc.status === "escalated" ? "Eskaliert" : "Verworfen"}
            </span>
          </div>
          <ChevronDown className={cn("w-3.5 h-3.5 text-[#444] transition-transform shrink-0", isExpanded && "rotate-180")} />
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 pt-1 border-t border-white/4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-[9px] text-[#444] uppercase tracking-widest font-bold mb-1">Was ist passiert</p>
                <p className="text-[11px] text-[#888] leading-relaxed">{inc.technical_summary}</p>
              </div>
              <div>
                <p className="text-[9px] text-[#444] uppercase tracking-widest font-bold mb-1">Warum es wichtig ist</p>
                <p className="text-[11px] text-[#888] leading-relaxed">{getImpactStatement(inc)}</p>
              </div>
              <div>
                <p className="text-[9px] text-[#444] uppercase tracking-widest font-bold mb-1">System-Reaktion</p>
                <p className={cn("text-[11px] leading-relaxed", inc.auto_healed ? "text-emerald-400" : "text-[#888]")}>
                  {inc.auto_action_taken ?? "Keine automatische Aktion"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {inc.anomaly_detected && (
                <div className="rounded-lg bg-white/3 px-3 py-2">
                  <p className="text-[9px] text-[#444] font-bold">Anomalie</p>
                  <p className="text-[10px] text-rose-400 mt-0.5">{inc.anomaly_detected}</p>
                </div>
              )}
              {inc.billing_truth && (
                <div className="rounded-lg bg-white/3 px-3 py-2">
                  <p className="text-[9px] text-[#444] font-bold">Billing-Wahrheit</p>
                  <p className="text-[10px] text-[#888] mt-0.5">{inc.billing_truth}</p>
                </div>
              )}
              {inc.platform_truth && (
                <div className="rounded-lg bg-white/3 px-3 py-2">
                  <p className="text-[9px] text-[#444] font-bold">Plattform-Wahrheit</p>
                  <p className="text-[10px] text-[#888] mt-0.5">{inc.platform_truth}</p>
                </div>
              )}
              {inc.recovery_result && (
                <div className="rounded-lg bg-white/3 px-3 py-2">
                  <p className="text-[9px] text-[#444] font-bold">Ergebnis</p>
                  <p className={cn("text-[10px] mt-0.5", inc.auto_healed ? "text-emerald-400" : inc.recovery_result.includes("fehlgeschlagen") || inc.recovery_result.includes("FEHL") || inc.recovery_result.includes("Eskaliert") ? "text-rose-400" : "text-[#888]")}>{inc.recovery_result}</p>
                </div>
              )}
              {inc.healing_action_type && (
                <div className="rounded-lg bg-white/3 px-3 py-2">
                  <p className="text-[9px] text-[#444] font-bold">Healing-Typ</p>
                  <p className="text-[10px] text-emerald-400 mt-0.5">{HEALING_LABELS[inc.healing_action_type] ?? inc.healing_action_type}</p>
                </div>
              )}
              {inc.retry_count > 0 && (
                <div className="rounded-lg bg-white/3 px-3 py-2">
                  <p className="text-[9px] text-[#444] font-bold">Retry-Status</p>
                  <p className="text-[10px] text-blue-400 mt-0.5">
                    {inc.retry_count}/{inc.max_retries} Versuche
                    {inc.last_retry_at && <> · {new Date(inc.last_retry_at).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</>}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-white/2 border border-white/5 px-3 py-2">
              <p className="text-[9px] text-[#444] uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> Zeitverlauf
              </p>
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span className="text-[#555]">Erkannt:</span>
                  <span className="text-[#888]">{new Date(inc.detected_at).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                </div>
                {inc.auto_action_taken && inc.auto_action_taken !== "Keine" && (
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span className="text-[#555]">Aktion:</span>
                    <span className="text-[#888]">{inc.auto_healed ? "Auto-repariert" : inc.retry_count > 0 ? `Retry ${inc.retry_count}x` : "Versucht"}</span>
                  </div>
                )}
                {inc.resolved_at && (
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[#555]">Gelöst:</span>
                    <span className="text-[#888]">{new Date(inc.resolved_at).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full", inc.status === "open" ? "bg-amber-400" : inc.status === "resolved" ? "bg-emerald-400" : "bg-rose-400")} />
                  <span className="text-[#555]">Status:</span>
                  <span className={cn(inc.status === "resolved" ? "text-emerald-400" : inc.status === "escalated" ? "text-rose-400" : "text-amber-400")}>
                    {inc.status === "open" ? "Offen" : inc.status === "resolved" ? "Gelöst" : inc.status === "escalated" ? "Eskaliert" : "Verworfen"}
                  </span>
                </div>
              </div>
            </div>

            {inc.recommended_action && (
              <div className={cn(
                "rounded-lg border px-3 py-2.5",
                inc.auto_healed
                  ? "bg-emerald-500/5 border-emerald-500/15"
                  : inc.needs_manual_review || inc.status === "escalated"
                  ? "bg-amber-500/5 border-amber-500/15"
                  : "bg-violet-500/5 border-violet-500/15"
              )}>
                <p className={cn(
                  "text-[9px] font-bold uppercase tracking-widest mb-0.5",
                  inc.auto_healed ? "text-emerald-400" : inc.needs_manual_review || inc.status === "escalated" ? "text-amber-400" : "text-violet-400"
                )}>
                  {inc.auto_healed ? "Keine Aktion erforderlich" :
                   inc.status === "escalated" ? "Eskalation — manuelle Prüfung erforderlich" :
                   inc.needs_manual_review ? "Founder-Aktion erforderlich" : "Empfehlung"}
                </p>
                <p className="text-[11px] text-[#888] leading-relaxed">{inc.recommended_action}</p>
              </div>
            )}

            {(inc.status === "open" || inc.status === "escalated") && !inc.auto_healed && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => updateIncident.mutate({ id: inc.id, status: "resolved" })}
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 px-3 py-1.5 rounded-lg hover:bg-emerald-500/15 transition-colors"
                >
                  <CheckCircle className="w-3 h-3" /> Als gelöst markieren
                </button>
                {inc.status !== "escalated" && (
                  <button
                    onClick={() => updateIncident.mutate({ id: inc.id, status: "escalated" })}
                    className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/8 border border-rose-500/20 px-3 py-1.5 rounded-lg hover:bg-rose-500/15 transition-colors"
                  >
                    <AlertTriangle className="w-3 h-3" /> Eskalieren
                  </button>
                )}
                <button
                  onClick={() => updateIncident.mutate({ id: inc.id, status: "dismissed" })}
                  className="flex items-center gap-1 text-[10px] text-[#444] hover:text-[#888] px-2 py-1.5 transition-colors"
                >
                  <X className="w-3 h-3" /> Verwerfen
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-5">

      {/* ── Health Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", healthStyle?.icon ?? "bg-emerald-500")}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a0f] animate-pulse", healthStyle?.icon ?? "bg-emerald-500", healthStyle?.pulse)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Mission Control</h2>
              {s && (
                <span className={cn(
                  "flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                  s.health === "healthy"  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                  s.health === "warning"  ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                  s.health === "degraded" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" :
                  "text-red-400 bg-red-500/10 border-red-500/20"
                )}>
                  {healthStyle?.label}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#444] mt-0.5 flex items-center gap-2">
              Erkennung · Selbstheilung · Billing-Schutz · Revenue Protection
              {s?.scheduledChecks?.enabled && (
                <span className="text-emerald-400/60 flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5" /> Auto-Check {s.scheduledChecks.intervalMinutes}m
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runHealthCheck.mutate()}
            disabled={runHealthCheck.isPending}
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all",
              runHealthCheck.isPending
                ? "text-[#444] border-white/6 bg-white/2"
                : "text-emerald-400 border-emerald-500/20 bg-emerald-500/8 hover:bg-emerald-500/15"
            )}
          >
            <Zap className="w-3 h-3" />
            {runHealthCheck.isPending ? "Prüfe..." : "Health Check"}
          </button>
          <button
            onClick={() => runBillingReconcile.mutate()}
            disabled={runBillingReconcile.isPending}
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all",
              runBillingReconcile.isPending
                ? "text-[#444] border-white/6 bg-white/2"
                : "text-violet-400 border-violet-500/20 bg-violet-500/8 hover:bg-violet-500/15"
            )}
          >
            <Banknote className="w-3 h-3" />
            {runBillingReconcile.isPending ? "Abgleiche..." : "Billing-Abgleich"}
          </button>
          <button
            onClick={() => runRetry.mutate()}
            disabled={runRetry.isPending}
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all",
              runRetry.isPending
                ? "text-[#444] border-white/6 bg-white/2"
                : "text-blue-400 border-blue-500/20 bg-blue-500/8 hover:bg-blue-500/15"
            )}
          >
            <RefreshCw className="w-3 h-3" />
            {runRetry.isPending ? "Retry..." : "Retry offene"}
          </button>
          <button
            onClick={invalidateOps}
            className="flex items-center gap-1.5 text-[11px] text-[#444] hover:text-[#888] transition-colors p-1.5"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Smart Summary Block ───────────────────────────────────────── */}
      {s && (
        <div className={cn(
          "rounded-xl border px-4 py-3",
          s.health === "healthy"  ? "border-emerald-500/15 bg-emerald-500/3" :
          s.health === "critical" ? "border-red-500/20 bg-red-500/5" :
          "border-white/6 bg-white/2"
        )}>
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-1">
              {buildSmartSummary().map((line, i) => (
                <p key={i} className={cn(
                  "text-[11px] font-medium leading-relaxed flex items-center gap-1.5",
                  i === 0 && s.counts.criticalOpen > 0 ? "text-red-400" :
                  i === 0 && s.counts.highOpen > 0 ? "text-rose-400" :
                  line.includes("repariert") ? "text-emerald-400" :
                  line.includes("stabil") ? "text-emerald-400" :
                  "text-[#888]"
                )}>
                  <span className={cn(
                    "w-1 h-1 rounded-full shrink-0",
                    line.includes("kritisch") ? "bg-red-400" :
                    line.includes("repariert") || line.includes("stabil") ? "bg-emerald-400" :
                    line.includes("eskaliert") ? "bg-rose-400" :
                    "bg-amber-400"
                  )} />
                  {line}
                </p>
              ))}
            </div>
            <div className="flex items-center gap-3 text-center shrink-0">
              <div>
                <p className={cn("text-lg font-bold", s.counts.open > 0 ? "text-amber-400" : "text-emerald-400")}>{s.counts.open}</p>
                <p className="text-[8px] text-[#444] uppercase">Offen</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-400">{s.counts.autoHealedTotal}</p>
                <p className="text-[8px] text-[#444] uppercase">Auto-Fix</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-400">{s.counts.resolved}</p>
                <p className="text-[8px] text-[#444] uppercase">Gelöst</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Health Check / Billing / Retry result banners ─────────────── */}
      {runHealthCheck.data && (
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold">
            <CheckCircle className="w-3.5 h-3.5" />
            Health Check abgeschlossen:
            <span className="text-[#888] font-normal">{runHealthCheck.data.checksRun} Checks · {runHealthCheck.data.issuesDetected} erkannt · </span>
            <span className="text-emerald-400">{runHealthCheck.data.autoHealed} auto-repariert</span>
            {runHealthCheck.data.retryResult?.escalated > 0 && (
              <span className="text-rose-400"> · {runHealthCheck.data.retryResult.escalated} eskaliert</span>
            )}
          </div>
        </div>
      )}
      {runBillingReconcile.data && (
        <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-violet-400 font-semibold">
            <Banknote className="w-3.5 h-3.5" />
            Billing-Abgleich:
            <span className="text-[#888] font-normal">{runBillingReconcile.data.issuesFound} Probleme · {runBillingReconcile.data.autoHealed} auto-repariert</span>
          </div>
        </div>
      )}
      {runRetry.data && (
        <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-blue-400 font-semibold">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry:
            <span className="text-[#888] font-normal">{runRetry.data.retried} versucht · {runRetry.data.succeeded} erfolgreich · {runRetry.data.escalated} eskaliert</span>
          </div>
        </div>
      )}

      {/* ── Attention Panel (Top Priority) ────────────────────────────── */}
      {sortedAttention.length > 0 && filter === "attention" && (
        <div className="rounded-xl border border-red-500/15 bg-red-500/3 px-4 py-3">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest">
              Sofortige Aufmerksamkeit ({sortedAttention.length})
            </p>
          </div>
          <div className="space-y-1.5">
            {sortedAttention.slice(0, 5).map(inc => {
              const sev = SEVERITY_STYLES[inc.severity] ?? SEVERITY_STYLES.low;
              return (
                <button
                  key={inc.id}
                  onClick={() => setExpandedId(expandedId === inc.id ? null : inc.id)}
                  className="w-full flex items-center gap-2 rounded-lg bg-white/3 hover:bg-white/5 px-3 py-2 text-left transition-colors"
                >
                  <span className={cn("text-[8px] font-bold px-1.5 py-px rounded border shrink-0", sev.bg, sev.text, sev.border)}>
                    {sev.label}
                  </span>
                  <p className="text-[11px] text-white font-medium truncate flex-1">{inc.title}</p>
                  {isRevenueImpact(inc) && (
                    <span className="text-[8px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-px rounded shrink-0">Umsatz</span>
                  )}
                  {inc.status === "escalated" && (
                    <span className="text-[8px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-px rounded shrink-0">ESKALIERT</span>
                  )}
                  {inc.needs_manual_review && inc.status === "open" && (
                    <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-px rounded shrink-0">REVIEW</span>
                  )}
                  <ChevronRight className="w-3 h-3 text-[#444] shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Incident Grouping by Category ─────────────────────────────── */}
      {groupedCounts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {groupedCounts.map(g => {
            const Icon = g.icon;
            return (
              <div key={g.key} className={cn(
                "rounded-xl border px-3 py-2.5",
                g.critical > 0 ? "border-red-500/20 bg-red-500/3" :
                g.open > 0 ? "border-amber-500/15 bg-amber-500/3" :
                "border-white/6 bg-white/2"
              )}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className={cn("w-3 h-3", g.open > 0 ? "text-amber-400" : "text-[#555]")} />
                  <p className="text-[10px] font-bold text-[#888] truncate">{g.label}</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-base font-bold", g.open > 0 ? "text-amber-400" : "text-emerald-400")}>{g.open}</span>
                  <span className="text-[9px] text-[#444]">offen</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[9px]">
                  {g.critical > 0 && <span className="text-red-400 font-bold">{g.critical} krit.</span>}
                  {g.high > 0 && <span className="text-rose-400 font-bold">{g.high} hoch</span>}
                  {g.healed > 0 && <span className="text-emerald-400">{g.healed} geheilt</span>}
                  {g.open === 0 && g.healed === 0 && <span className="text-[#333]">{g.total} gesamt</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Auto-Fix Visibility ───────────────────────────────────────── */}
      {s && (s.counts.autoHealedTotal > 0 || s.counts.retryExhausted > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-emerald-500/12 bg-emerald-500/3 px-3 py-2.5 text-center">
            <p className="text-sm font-bold text-emerald-400">{s.counts.autoHealedTotal}</p>
            <p className="text-[9px] text-[#555] font-medium mt-0.5">Auto-Repariert</p>
            {s.healingStats && s.healingStats.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 mt-1.5">
                {(s.healingStats as any[]).filter((h: any) => parseInt(h.succeeded) > 0).map((h: any) => (
                  <span key={h.healing_action_type} className="text-[8px] text-emerald-400/70">
                    {HEALING_LABELS[h.healing_action_type] ?? h.healing_action_type} ({h.succeeded})
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-amber-500/12 bg-amber-500/3 px-3 py-2.5 text-center">
            <p className="text-sm font-bold text-amber-400">{s.counts.pendingReview}</p>
            <p className="text-[9px] text-[#555] font-medium mt-0.5">Fix versucht — Review nötig</p>
          </div>
          <div className="rounded-xl border border-rose-500/12 bg-rose-500/3 px-3 py-2.5 text-center">
            <p className="text-sm font-bold text-rose-400">{s.counts.escalated + s.counts.retryExhausted}</p>
            <p className="text-[9px] text-[#555] font-medium mt-0.5">Nicht lösbar — Eskaliert</p>
          </div>
        </div>
      )}

      {/* ── Filter Tabs ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1 border-b border-white/5 pb-2">
        {filterTabs.map(({ key, label, count, color }) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setExpandedId(null); }}
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all",
              filter === key
                ? "bg-white/10 text-white border border-white/15"
                : "text-[#444] hover:text-[#888] hover:bg-white/4"
            )}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={cn("text-[9px] font-bold", color ?? "text-[#555]")}>({count})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Incident Feed ─────────────────────────────────────────────── */}
      {incidentsQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-white/3 animate-pulse" />)}
        </div>
      ) : incidents.length === 0 ? (
        <div className="rounded-2xl border border-white/6 bg-white/2 p-8 text-center">
          <Shield className="w-8 h-8 text-emerald-400/30 mx-auto mb-3" />
          <p className="text-sm text-[#555]">
            {filter === "attention" ? "Keine Probleme erfordern Aufmerksamkeit — Plattform ist stabil." :
             filter === "needs_review" ? "Keine Incidents benötigen manuelle Prüfung." :
             filter === "auto_healed" ? "Noch keine Auto-Reparaturen durchgeführt." :
             filter === "billing" ? "Keine Billing-Incidents vorhanden." :
             filter === "open" ? "Keine offenen Incidents — Plattform ist gesund." :
             filter === "escalated" ? "Keine eskalierten Incidents." :
             "Keine Incidents in dieser Kategorie."}
          </p>
          <p className="text-[10px] text-[#333] mt-1">
            Health Check durchführen um die Plattform zu prüfen.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {highPrioIncidents.map(renderIncidentCard)}
          {lowPrioIncidents.length > 0 && (
            <>
              <button
                onClick={() => setCollapsedLow(!collapsedLow)}
                className="w-full flex items-center gap-2 text-[10px] text-[#444] hover:text-[#888] py-1.5 transition-colors"
              >
                <div className="flex-1 h-px bg-white/5" />
                <span className="font-medium shrink-0">
                  {lowPrioIncidents.length} niedrige Priorität {collapsedLow ? "anzeigen" : "ausblenden"}
                </span>
                <ChevronDown className={cn("w-3 h-3 transition-transform shrink-0", !collapsedLow && "rotate-180")} />
                <div className="flex-1 h-px bg-white/5" />
              </button>
              {!collapsedLow && lowPrioIncidents.map(renderIncidentCard)}
            </>
          )}
        </div>
      )}

      {/* ── System Footer ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/4 bg-white/1 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-3 h-3 text-[#333]" />
            <span className="text-[10px] text-[#444] font-semibold">Self-Healing Ops Layer v2</span>
          </div>
          <div className="flex flex-wrap gap-3 text-[9px] text-[#333]">
            <span>6 Check-Kategorien</span>
            <span>5 Healing-Aktionstypen</span>
            <span>Auto-Retry bis 3x</span>
            <span>10-Min Auto-Checks</span>
            <span>Billing vs Plattform Wahrheit</span>
            <span>Keine destruktiven Auto-Aktionen</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Founder Cities Dashboard ─────────────────────────────────────────────────

interface CityData {
  city: string;
  bizCount: number;
  restaurantCount: number;
  cafeCount: number;
  barCount: number;
  avgRating: number;
  new30d: number;
  claims30d: number;
  activeBoosts: number;
  totalBoosts: number;
  activeBudgetPerDay: number;
  totalImpressions: number;
  totalClicks: number;
  bookingCount: number;
  premiumEstimate: number;
  premiumRate: number;
  boostRate: number;
  conversionRate: number;
  score: number;
  stage: string;
  stageColor: string;
  stageEN: string;
  expansionPriority: number;
}

interface CityDashboard {
  cities: CityData[];
  insights: {
    dominantCity: string | null;
    highestRevenueCity: string | null;
    fastestGrowingCity: string | null;
    highestCompCity: string | null;
    nextFocusCity: string | null;
    totalCities: number;
    totalBizAcrossAll: number;
  };
}

const CITY_STAGE_STYLES: Record<string, string> = {
  Dominant: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Stark:    "text-blue-400   bg-blue-500/10   border-blue-500/20",
  Wachstum: "text-amber-400  bg-amber-500/10  border-amber-500/20",
  Früh:     "text-rose-400   bg-rose-500/10   border-rose-500/20",
};

const CITY_SCORE_BAR: Record<string, string> = {
  Dominant: "from-emerald-500 to-teal-500",
  Stark:    "from-blue-500 to-indigo-500",
  Wachstum: "from-amber-500 to-orange-500",
  Früh:     "from-rose-500 to-pink-500",
};

const CITY_EMOJI: Record<string, string> = {
  Wien:      "🇦🇹",
  Graz:      "🏙️",
  Salzburg:  "🎵",
  Linz:      "🏭",
  Innsbruck: "⛷️",
};

const EXPANSION_ACTION: Record<string, { label: string; color: string; sub: string }> = {
  Dominant: { label: "Weiter dominieren",       color: "text-emerald-400", sub: "Premium & Boost-Adoption steigern" },
  Stark:    { label: "Premium konvertieren",     color: "text-blue-400",   sub: "Freie Betriebe zu Premium bewegen" },
  Wachstum: { label: "Supply aktivieren",        color: "text-amber-400",  sub: "Mehr Betriebe onboarden" },
  Früh:     { label: "Markt erschließen",        color: "text-rose-400",   sub: "Früh einsteigen — hohe Sichtbarkeit" },
};

function FounderCitiesView({ founderKey }: { founderKey: string }) {
  const headers = { "x-founder-key": founderKey };
  const qc = useQueryClient();

  const dashQuery = useQuery<CityDashboard>({
    queryKey: ["founder-cities"],
    queryFn: async () => {
      const r = await fetch(`${API}/cities/dashboard`, { headers });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const d = dashQuery.data;

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#555]">
              City Expansion Engine — Founder Dashboard
            </span>
          </div>
          <p className="text-[11px] text-[#333]">
            Stadtweite Expansion: Health Score, Aktivierungsstand und nächste strategische Maßnahmen pro Stadt.
          </p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["founder-cities"] })}
          className="flex items-center gap-1.5 text-[11px] text-[#444] hover:text-[#888] transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Aktualisieren
        </button>
      </div>

      {dashQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-white/3 animate-pulse" />
          ))}
        </div>
      ) : !d ? (
        <div className="rounded-2xl border border-white/6 p-8 text-center text-[#333] text-sm">
          Keine Daten verfügbar
        </div>
      ) : (
        <>
          {/* ── Insights summary ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Plattform-Städte",      value: String(d.insights.totalCities),             color: "text-violet-400" },
              { label: "Betriebe gesamt",        value: String(d.insights.totalBizAcrossAll),       color: "text-white" },
              { label: "Stärkste Stadt",         value: d.insights.dominantCity ?? "—",            color: "text-emerald-400" },
              { label: "Nächste Fokusstadt",     value: d.insights.nextFocusCity ?? "—",           color: "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl border border-white/6 bg-white/2 px-4 py-3 text-center">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-[#555] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* ── City cards ───────────────────────────────────────────────── */}
          <div className="space-y-3">
            {d.cities.map((city) => {
              const action = EXPANSION_ACTION[city.stage] ?? EXPANSION_ACTION.Früh;
              return (
                <div
                  key={city.city}
                  className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden"
                >
                  {/* City header */}
                  <div className="flex items-center gap-4 px-5 py-3 border-b border-white/4">
                    <div className="text-xl shrink-0">
                      {CITY_EMOJI[city.city] ?? "🏙️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{city.city}</span>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          CITY_STAGE_STYLES[city.stage]
                        )}>
                          {city.stageEN}
                        </span>
                        {d.insights.fastestGrowingCity === city.city && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                            SCHNELLSTES WACHSTUM
                          </span>
                        )}
                        {d.insights.highestRevenueCity === city.city && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                            HÖCHSTER UMSATZ
                          </span>
                        )}
                        {d.insights.nextFocusCity === city.city && city.stage !== "Dominant" && (
                          <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full font-bold">
                            NÄCHSTE PRIORITÄT
                          </span>
                        )}
                      </div>
                      {/* Health score bar */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 bg-white/6 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full bg-gradient-to-r", CITY_SCORE_BAR[city.stage])}
                            style={{ width: `${city.score}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#555] shrink-0">{city.score}/100</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("text-xs font-bold", action.color)}>{action.label}</p>
                      <p className="text-[10px] text-[#333] mt-0.5 max-w-[140px]">{action.sub}</p>
                    </div>
                  </div>

                  {/* City metrics row */}
                  <div className="grid grid-cols-4 md:grid-cols-8 divide-x divide-white/4">
                    {[
                      { label: "Betriebe",       value: String(city.bizCount) },
                      { label: "Restaurants",    value: String(city.restaurantCount) },
                      { label: "Cafés",          value: String(city.cafeCount) },
                      { label: "Bars",           value: String(city.barCount) },
                      { label: "Ø Rating",       value: city.avgRating.toFixed(1) },
                      { label: "Premium",        value: `${city.premiumEstimate} (${city.premiumRate}%)` },
                      { label: "Aktive Boosts",  value: String(city.activeBoosts) },
                      { label: "Budget/Tag",     value: `€${city.activeBudgetPerDay.toFixed(2)}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="px-3 py-2 text-center">
                        <p className="text-xs font-semibold text-white">{value}</p>
                        <p className="text-[9px] text-[#444] mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Expansion decision matrix ─────────────────────────────────── */}
          <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/6">
              <span className="text-xs font-semibold text-[#888]">Expansions-Entscheidungsmatrix</span>
            </div>
            <div className="divide-y divide-white/4">
              {[...d.cities]
                .sort((a, b) => b.expansionPriority - a.expansionPriority)
                .map((city) => {
                  const DECISIONS: Record<string, { focus: string; action: string; risk: string }> = {
                    Dominant: {
                      focus:  "Retention & Monetisierung",
                      action: "Premium-Rate und Boost-Adoption erhöhen",
                      risk:   "Markt gesättigt — Wachstum durch Tiefe, nicht Breite",
                    },
                    Stark: {
                      focus:  "Premium-Konversion",
                      action: "Freie Betriebe zu Premium konvertieren",
                      risk:   "Mittlere Konkurrenz — Boost-Motivation steigern",
                    },
                    Wachstum: {
                      focus:  "Supply-Aktivierung",
                      action: "Neue Betriebe onboarden + Self-Serve aktivieren",
                      risk:   "Noch niedrige Nutzerdichte — Demand-Seite aufbauen",
                    },
                    Früh: {
                      focus:  "Markteröffnung",
                      action: "Früh-Adopter gewinnen + hohe Sichtbarkeit versprechen",
                      risk:   "Niedrige Aktivität — Henne/Ei-Problem",
                    },
                  };
                  const dec = DECISIONS[city.stage] ?? DECISIONS.Früh;
                  return (
                    <div key={city.city} className="flex items-start gap-4 px-4 py-3">
                      <div className="w-6 text-center text-base shrink-0 mt-0.5">
                        {CITY_EMOJI[city.city] ?? "🏙️"}
                      </div>
                      <div className="w-20 shrink-0">
                        <p className="text-xs font-bold text-white">{city.city}</p>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                          CITY_STAGE_STYLES[city.stage]
                        )}>
                          {city.stage}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-[#888]">{dec.focus}</p>
                        <p className="text-[10px] text-[#555] mt-0.5">{dec.action}</p>
                        <p className="text-[10px] text-[#333] mt-0.5 italic">{dec.risk}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-[#444]">{city.bizCount} Betriebe</p>
                        <p className="text-[10px] text-[#333]">€{city.activeBudgetPerDay.toFixed(2)}/Tag</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* ── Scalable growth loop note ─────────────────────────────────── */}
          <div className="rounded-2xl border border-white/4 bg-white/1 px-5 py-4">
            <p className="text-[11px] text-[#444] leading-relaxed">
              <span className="text-[#666] font-semibold">Expansions-Loop:</span>
              {" "}Stadt erschließen → Supply aktivieren → Demand aufbauen → Premium konvertieren → Wettbewerb aktivieren → Umsatz steigern → Nächste Stadt.
              Fokus auf Dichte, nicht auf Breite — eine Stadt dominieren, dann expandieren.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Founder Competition Insights ─────────────────────────────────────────────

interface CompetitionInsights {
  summary: {
    totalActive: number;
    totalBudgetPerDay: number;
    totalImpressions: number;
    competitionIntensity: string;
  };
  activeBoosts: any[];
  boostTrend: any[];
  byBusinessType: any[];
}

function FounderCompetitionInsights({ founderKey }: { founderKey: string }) {
  const headers = { "x-founder-key": founderKey };
  const qc = useQueryClient();

  const insightsQuery = useQuery<CompetitionInsights>({
    queryKey: ["competition-insights"],
    queryFn: async () => {
      const r = await fetch(`${API}/competition/insights`, { headers });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const d = insightsQuery.data;

  const intensityColor = (i: string) =>
    i === "hoch" ? "text-rose-400" : i === "mittel" ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#555]">
              Wettbewerbs-Engine — Founder Insights
            </span>
            <span className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold">
              LIVE
            </span>
          </div>
          <p className="text-[11px] text-[#333]">
            Echtzeit-Wettbewerbsdaten: Wie viele Betriebe boosten, welche Typen am aktivsten sind und wie hoch der Wettbewerbsdruck ist.
          </p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["competition-insights"] })}
          className="flex items-center gap-1.5 text-[11px] text-[#444] hover:text-[#888] transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Aktualisieren
        </button>
      </div>

      {insightsQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-2xl bg-white/3 animate-pulse" />
          ))}
        </div>
      ) : !d ? (
        <div className="rounded-2xl border border-white/6 p-8 text-center text-[#333] text-sm">
          Keine Daten verfügbar
        </div>
      ) : (
        <>
          {/* ── KPI summary ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Aktive Boosts",
                value: String(d.summary.totalActive),
                sub: "gerade aktiv",
                color: d.summary.totalActive > 0 ? "text-rose-400" : "text-emerald-400",
              },
              {
                label: "Budget / Tag",
                value: `€${d.summary.totalBudgetPerDay.toFixed(2)}`,
                sub: "Plattform gesamt",
                color: "text-amber-400",
              },
              {
                label: "Impressionen",
                value: d.summary.totalImpressions.toLocaleString("de"),
                sub: "gesamt",
                color: "text-blue-400",
              },
              {
                label: "Wettbewerbsdruck",
                value: d.summary.competitionIntensity.toUpperCase(),
                sub: "aktuell",
                color: intensityColor(d.summary.competitionIntensity),
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="rounded-2xl border border-white/6 bg-white/2 px-4 py-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-[#555] mt-0.5">{label}</p>
                <p className="text-[9px] text-[#333]">{sub}</p>
              </div>
            ))}
          </div>

          {/* ── By business type ─────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/6">
              <span className="text-xs font-semibold text-[#888]">Wettbewerb nach Betriebstyp</span>
            </div>
            <div className="divide-y divide-white/4">
              {(d.byBusinessType as any[]).map((row: any) => {
                const BizIcon = BIZ_ICONS[row.business_type] ?? Store;
                const bName   = BIZ_LABELS[row.business_type] ?? row.business_type;
                const budget  = parseFloat(row.total_daily_budget ?? "0");
                return (
                  <div key={row.business_type} className="flex items-center gap-4 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <BizIcon className="w-4 h-4 text-[#888]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{bName}s</p>
                        <span className="text-[10px] text-[#444]">
                          {row.total_promotions ?? 0} Boosts gesamt · {row.active_promotions ?? 0} aktiv
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-[#555]">Ø Rating: {row.avg_rating ?? "—"}</span>
                        <span className="text-[10px] text-amber-400 font-semibold">
                          €{budget.toFixed(2)}/Tag Budget
                        </span>
                        <span className="text-[10px] text-[#444]">
                          {parseInt(row.total_impressions ?? "0").toLocaleString("de")} Impressionen
                        </span>
                      </div>
                    </div>
                    {/* Relative competition bar */}
                    <div className="w-24 shrink-0">
                      <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-600"
                          style={{ width: `${Math.min(100, parseInt(row.total_impressions ?? "0") / 10)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Active boosts table ───────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#888]">Aktive & vergangene Boosts</span>
              <span className="text-[10px] text-[#333]">{d.activeBoosts.length} Boosts insgesamt</span>
            </div>
            {d.activeBoosts.length === 0 ? (
              <div className="p-8 text-center text-[#333] text-sm">
                <Zap className="w-6 h-6 text-[#222] mx-auto mb-2" />
                Noch keine Boosts aktiviert
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/4">
                      {["Betrieb", "Typ", "Status", "Impressionen", "Klicks", "Budget/Tag", "Gestartet"].map(h => (
                        <th key={h} className="py-2 px-4 text-left text-[10px] font-bold uppercase tracking-widest text-[#444]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {(d.activeBoosts as any[]).map((boost: any) => (
                      <tr key={boost.id} className="hover:bg-white/2">
                        <td className="py-2 px-4 text-white font-medium">{boost.name}</td>
                        <td className="py-2 px-4 text-[#888]">
                          {BOOST_LABELS[boost.type] ?? boost.type}
                        </td>
                        <td className="py-2 px-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            boost.status === "active"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                              : "bg-white/5 text-[#555] border border-white/8"
                          }`}>
                            {boost.status === "active" ? "Aktiv" : boost.status}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-[#888]">
                          {parseInt(boost.impressions ?? "0").toLocaleString("de")}
                        </td>
                        <td className="py-2 px-4 text-[#888]">{boost.clicks ?? 0}</td>
                        <td className="py-2 px-4 text-amber-400 font-semibold">
                          €{parseFloat(boost.daily_budget ?? "0").toFixed(2)}
                        </td>
                        <td className="py-2 px-4 text-[#444]">
                          {new Date(boost.started_at).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Competition context note ──────────────────────────────────── */}
          <div className="rounded-2xl border border-white/4 bg-white/1 px-5 py-4">
            <p className="text-[11px] text-[#444] leading-relaxed">
              <span className="text-[#666] font-semibold">Fairness-Garantie:</span> Die Sichtbarkeitslogik berücksichtigt Relevanz, Rating und Qualität.
              Boosts erhöhen die Erscheinungswahrscheinlichkeit — sie garantieren keine Top-Position und können keine niedrige Qualität überbrücken.
              Das System ist darauf ausgelegt, den Wettbewerb gesund und fair zu halten.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function Founder() {
  const [authed, setAuthed] = useState<boolean>(() => {
    return localStorage.getItem(FOUNDER_KEY_STORAGE) === CORRECT_KEY;
  });
  const [view, setView] = useState<"dashboard" | "pipeline" | "conversion" | "competition" | "cities" | "ops" | "brain">("dashboard");

  if (!authed) {
    return <AuthGate onAuth={() => setAuthed(true)} />;
  }

  return (
    <div>
      {/* ── Tab Navigation ── */}
      <div className="sticky top-0 z-50 bg-[#080810]/98 backdrop-blur-xl border-b border-white/6">
        <div className="max-w-screen-2xl mx-auto px-6 flex items-center gap-1 h-12">
          <button
            onClick={() => setView("dashboard")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              view === "dashboard"
                ? "bg-white/10 text-white border border-white/15"
                : "text-[#444] hover:text-[#888] hover:bg-white/4"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Command Center
          </button>
          <button
            onClick={() => setView("pipeline")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              view === "pipeline"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                : "text-[#444] hover:text-[#888] hover:bg-white/4"
            )}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Wien Sales Pipeline
            <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">NEU</span>
          </button>
          <button
            onClick={() => setView("conversion")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              view === "conversion"
                ? "bg-violet-500/15 text-violet-400 border border-violet-500/25"
                : "text-[#444] hover:text-[#888] hover:bg-white/4"
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Conversion Intelligence
            <span className="bg-violet-500/20 text-violet-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">NEU</span>
          </button>
          <button
            onClick={() => setView("competition")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              view === "competition"
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/25"
                : "text-[#444] hover:text-[#888] hover:bg-white/4"
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            Wettbewerb
            <span className="bg-rose-500/20 text-rose-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">LIVE</span>
          </button>
          <button
            onClick={() => setView("cities")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              view === "cities"
                ? "bg-violet-500/15 text-violet-400 border border-violet-500/25"
                : "text-[#444] hover:text-[#888] hover:bg-white/4"
            )}
          >
            <MapPin className="w-3.5 h-3.5" />
            Städte
            <span className="bg-violet-500/20 text-violet-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">NEU</span>
          </button>
          <button
            onClick={() => setView("brain")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              view === "brain"
                ? "bg-violet-500/15 text-violet-400 border border-violet-500/25"
                : "text-[#444] hover:text-[#888] hover:bg-white/4"
            )}
          >
            <Flame className="w-3.5 h-3.5" />
            Master Brain
          </button>
          <button
            onClick={() => setView("ops")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              view === "ops"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                : "text-[#444] hover:text-[#888] hover:bg-white/4"
            )}
          >
            <Shield className="w-3.5 h-3.5" />
            Ops
          </button>
          <div className="ml-auto text-[10px] text-[#222]">Founder · Streng vertraulich</div>
        </div>
      </div>
      {view === "dashboard" && <Dashboard founderKey={CORRECT_KEY} />}
      {view === "pipeline" && <WienPipelineView founderKey={CORRECT_KEY} />}
      {view === "conversion" && (
        <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-12">
          <PremiumConversionPanel />
          <div className="border-t border-white/6 pt-10">
            <VariantOptimizationPanel />
          </div>
        </div>
      )}
      {view === "competition" && <FounderCompetitionInsights founderKey={CORRECT_KEY} />}
      {view === "cities" && <FounderCitiesView founderKey={CORRECT_KEY} />}
      {view === "brain" && <FounderBrainCenter founderKey={CORRECT_KEY} />}
      {view === "ops" && <FounderOpsCenter founderKey={CORRECT_KEY} />}
    </div>
  );
}
