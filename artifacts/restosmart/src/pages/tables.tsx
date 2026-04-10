import { useState, useEffect } from "react";
import { useSession } from "@/contexts/session-context";
import { format } from "date-fns";
import { Armchair, Users, Clock, TrendingUp, PauseCircle, PlayCircle, Save, Settings, BarChart2, Calendar, Zap, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "";

type AvailabilityStatus = "available" | "limited" | "nearly_full" | "full" | "closed" | "paused";

interface SlotInfo {
  time: string;
  status: AvailabilityStatus;
  bookedGuests: number;
  seatingCapacity: number;
  availableSeats: number;
  percentage: number;
}

interface Settings {
  tableCapacity: number;
  seatingCapacity: number;
  slotDurationMinutes: number;
  maxPartySize: number;
  walkInsEnabled: boolean;
  availabilityPaused: boolean;
  availabilityPausedUntil: string | null;
}

interface Overview {
  date: string;
  seatingCapacity: number;
  slotDurationMinutes: number;
  tableCapacity: number;
  slots: SlotInfo[];
  summary: {
    totalReservations: number;
    totalGuests: number;
    peakSlot: string | null;
    peakOccupancy: number;
    remainingCapacity: number;
  };
  weeklyPattern: Array<{ day: string; short: string; totalBookings: number; avgGuests: number }>;
  fastestSlots: Array<{ time: string; guests: number }>;
}

function statusColor(s: AvailabilityStatus) {
  switch (s) {
    case "available": return "bg-emerald-500";
    case "limited": return "bg-amber-400";
    case "nearly_full": return "bg-orange-500";
    case "full": return "bg-red-500";
    default: return "bg-muted";
  }
}

function statusLabel(s: AvailabilityStatus) {
  switch (s) {
    case "available": return "Verfügbar";
    case "limited": return "Begrenzt";
    case "nearly_full": return "Fast voll";
    case "full": return "Voll";
    case "closed": return "Geschlossen";
    case "paused": return "Pausiert";
  }
}

function StatusBadge({ status }: { status: AvailabilityStatus }) {
  const classes: Record<AvailabilityStatus, string> = {
    available: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    limited: "bg-amber-400/15 text-amber-400 border-amber-400/30",
    nearly_full: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    full: "bg-red-500/15 text-red-400 border-red-500/30",
    closed: "bg-muted/50 text-muted-foreground border-border",
    paused: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${classes[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusColor(status)}`} />
      {statusLabel(status)}
    </span>
  );
}

export default function Tables() {
  const { toast } = useToast();
  const { csrfToken } = useSession();
  const csrfHdr = csrfToken ? { "X-CSRF-Token": csrfToken } : {};
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [saving, setSaving] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [pauseDuration, setPauseDuration] = useState("60");
  const [loading, setLoading] = useState(true);

  async function fetchAll(date: string) {
    setLoading(true);
    try {
      const [sRes, oRes] = await Promise.all([
        fetch(`${API}/api/availability/settings`),
        fetch(`${API}/api/availability/overview?date=${date}`),
      ]);
      if (sRes.ok) {
        const s = await sRes.json();
        setSettings(s);
        setForm(s);
      }
      if (oRes.ok) {
        const o = await oRes.json();
        setOverview(o);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll(selectedDate);
  }, [selectedDate]);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/availability/settings`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHdr },
        body: JSON.stringify({
          tableCapacity: form.tableCapacity,
          seatingCapacity: form.seatingCapacity,
          slotDurationMinutes: form.slotDurationMinutes,
          maxPartySize: form.maxPartySize,
          walkInsEnabled: form.walkInsEnabled,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setForm(updated);
        toast({ title: "Einstellungen gespeichert", description: "Kapazitätseinstellungen wurden aktualisiert." });
        fetchAll(selectedDate);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePause(pause: boolean) {
    setPausing(true);
    try {
      const res = await fetch(`${API}/api/availability/pause`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHdr },
        body: JSON.stringify({ paused: pause, durationMinutes: pause ? parseInt(pauseDuration) : 0 }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: pause ? "Verfügbarkeit pausiert" : "Verfügbarkeit fortgesetzt",
          description: pause
            ? `Walk-ins und Buchungen pausiert${data.pausedUntil ? " für " + pauseDuration + " Min." : ""}.`
            : "Das Restaurant nimmt wieder Buchungen an.",
        });
        fetchAll(selectedDate);
      }
    } finally {
      setPausing(false);
    }
  }

  const isPaused = settings?.availabilityPaused ?? false;
  const pausedUntil = settings?.availabilityPausedUntil;

  const nowSlot = (() => {
    if (!overview) return null;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return overview.slots.find((s) => {
      const [h, m] = s.time.split(":").map(Number);
      return h * 60 + m <= nowMins && h * 60 + m + (overview.slotDurationMinutes ?? 90) > nowMins;
    }) ?? null;
  })();

  const maxWeekly = Math.max(...(overview?.weeklyPattern.map((w) => w.avgGuests) ?? [1]), 1);

  const wochentage = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

  return (
    <div className="space-y-8">
      {/* Kopfzeile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Armchair className="w-8 h-8 text-primary" />
            Tische & Verfügbarkeit
          </h1>
          <p className="text-muted-foreground mt-1">Kapazitätseinstellungen verwalten und Auslastung live überwachen</p>
        </div>

        {/* Pause / Fortsetzen */}
        <div className="flex items-center gap-3">
          {isPaused ? (
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="animate-pulse px-3 py-1">
                <PauseCircle className="w-3.5 h-3.5 mr-1" />
                Buchungen pausiert
                {pausedUntil && (
                  <span className="ml-1 opacity-75">· bis {format(new Date(pausedUntil), "HH:mm")} Uhr</span>
                )}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => handlePause(false)} disabled={pausing} className="gap-1.5">
                <PlayCircle className="w-4 h-4" />
                Fortsetzen
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Select value={pauseDuration} onValueChange={setPauseDuration}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 Min. pausieren</SelectItem>
                  <SelectItem value="60">1 Std. pausieren</SelectItem>
                  <SelectItem value="120">2 Std. pausieren</SelectItem>
                  <SelectItem value="0">Unbegrenzt pausieren</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="gap-1.5 text-orange-400 border-orange-400/40 hover:bg-orange-500/10" onClick={() => handlePause(true)} disabled={pausing}>
                <PauseCircle className="w-4 h-4" />
                Pausieren
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Live-Übersichtskarten */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Jetzt</div>
            <div className="flex items-end gap-2">
              <StatusBadge status={nowSlot?.status ?? (isPaused ? "paused" : "closed")} />
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              {nowSlot ? `${nowSlot.availableSeats} Plätze frei` : "Kein aktiver Zeitslot"}
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Heutige Gäste</div>
            <div className="text-2xl font-bold">{overview.summary.totalGuests}</div>
            <div className="text-xs text-muted-foreground">{overview.summary.totalReservations} Reservierungen</div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Spitzenzeit</div>
            <div className="text-2xl font-bold">{overview.summary.peakSlot ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{overview.summary.peakOccupancy}% Auslastung</div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Noch verfügbar</div>
            <div className="text-2xl font-bold">{overview.summary.remainingCapacity}</div>
            <div className="text-xs text-muted-foreground">von {overview.seatingCapacity} Plätzen</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kapazitätseinstellungen */}
        <div className="bg-card border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-base">Kapazitätseinstellungen</h2>
          </div>

          {form && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tische gesamt</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={form.tableCapacity}
                  onChange={(e) => setForm({ ...form, tableCapacity: parseInt(e.target.value) || 1 })}
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Sitzkapazität (Gäste)</Label>
                <Input
                  type="number"
                  min={1}
                  max={2000}
                  value={form.seatingCapacity}
                  onChange={(e) => setForm({ ...form, seatingCapacity: parseInt(e.target.value) || 1 })}
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Slotdauer (Min.)</Label>
                <Select
                  value={String(form.slotDurationMinutes)}
                  onValueChange={(v) => setForm({ ...form, slotDurationMinutes: parseInt(v) })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">60 Min. (1 Std.)</SelectItem>
                    <SelectItem value="90">90 Min. (1,5 Std.)</SelectItem>
                    <SelectItem value="120">120 Min. (2 Std.)</SelectItem>
                    <SelectItem value="150">150 Min. (2,5 Std.)</SelectItem>
                    <SelectItem value="180">180 Min. (3 Std.)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Wie lange ein Tisch pro Buchung belegt ist</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Max. Gruppengröße</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.maxPartySize}
                  onChange={(e) => setForm({ ...form, maxPartySize: parseInt(e.target.value) || 1 })}
                  className="bg-background"
                />
              </div>

              <div className="flex items-center justify-between py-1 border-t border-border">
                <div>
                  <div className="text-sm font-medium">Walk-ins akzeptieren</div>
                  <div className="text-xs text-muted-foreground">Walk-in-Verfügbarkeit für Kunden anzeigen</div>
                </div>
                <Switch
                  checked={form.walkInsEnabled}
                  onCheckedChange={(v) => setForm({ ...form, walkInsEnabled: v })}
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                <Save className="w-4 h-4" />
                {saving ? "Wird gespeichert..." : "Einstellungen speichern"}
              </Button>
            </>
          )}
        </div>

        {/* Slot-Heatmap */}
        <div className="lg:col-span-2 bg-card border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-base">Slot-Auslastung</h2>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 text-sm bg-background w-36"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-8 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : overview && overview.slots.length > 0 ? (
            <div className="space-y-2">
              {/* Legende */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 flex-wrap">
                {(["available", "limited", "nearly_full", "full"] as AvailabilityStatus[]).map((s) => (
                  <span key={s} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${statusColor(s)}`} />
                    {statusLabel(s)}
                  </span>
                ))}
              </div>

              {overview.slots.map((slot) => {
                const isNow = nowSlot?.time === slot.time;
                return (
                  <div key={slot.time} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${isNow ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}>
                    <span className={`text-xs font-mono w-12 shrink-0 ${isNow ? "text-primary font-bold" : "text-muted-foreground"}`}>
                      {slot.time}
                      {isNow && <span className="ml-1 text-[10px]">jetzt</span>}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-4 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${statusColor(slot.status)} opacity-80`}
                        style={{ width: `${Math.max(slot.percentage, slot.percentage > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 w-36 shrink-0 justify-end">
                      <span className="text-xs text-muted-foreground">{slot.bookedGuests}/{slot.seatingCapacity}</span>
                      <StatusBadge status={slot.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Calendar className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Keine Slot-Daten für dieses Datum</p>
            </div>
          )}
        </div>
      </div>

      {/* Wochenmuster + Schnellste Slots */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Wöchentliches Auslastungsmuster */}
          <div className="bg-card border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-base">Wöchentliches Auslastungsmuster</h2>
              <span className="text-xs text-muted-foreground ml-auto">Ø letzte 4 Wochen</span>
            </div>
            <div className="flex items-end gap-2 h-28">
              {overview.weeklyPattern.map((day) => {
                const height = maxWeekly > 0 ? Math.round((day.avgGuests / maxWeekly) * 100) : 0;
                const isToday = day.day === wochentage[new Date().getDay()];
                return (
                  <div key={day.short} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs text-muted-foreground">{day.avgGuests > 0 ? day.avgGuests : ""}</div>
                    <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
                      <div
                        className={`w-full max-w-[28px] rounded-sm transition-all ${isToday ? "bg-primary" : "bg-primary/30"}`}
                        style={{ height: `${Math.max(height, height > 0 ? 5 : 0)}%` }}
                      />
                    </div>
                    <div className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day.short}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Schnellste Slots */}
          <div className="bg-card border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="font-semibold text-base">Schnellst ausgebuchte Slots</h2>
              <span className="text-xs text-muted-foreground ml-auto">historisch am stärksten</span>
            </div>
            {overview.fastestSlots.length > 0 ? (
              <div className="space-y-3">
                {overview.fastestSlots.map((slot, i) => (
                  <div key={slot.time} className="flex items-center gap-4 p-3 bg-background rounded-xl border">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-400/20 text-amber-400" : "bg-muted text-muted-foreground"}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{slot.time}</div>
                      <div className="text-xs text-muted-foreground">{slot.guests} Gäste gesamt im Zeitraum</div>
                    </div>
                    {i === 0 && <Badge className="bg-amber-400/15 text-amber-400 border-amber-400/30 text-xs">Spitze</Badge>}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1">Erwägen Sie, zu Stoßzeiten zusätzliche Tische zu öffnen oder einen Deal zu starten, um die Auslastung zu maximieren.</p>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Noch nicht genug historische Daten
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
