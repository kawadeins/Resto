import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Users, Plus, Trash2, ChevronRight, MapPin, Star,
  Clock, Zap, Bell, User, X, Check, Sparkles, UtensilsCrossed,
  ChefHat, Calendar, Loader2, Share2, Pencil, Search, Link2,
  CheckCircle, Building2,
} from "lucide-react";
import { Link } from "wouter";
import { SmartPlanGenerator, SmartPlanTriggerButton } from "@/components/smart-plan-generator";

const API = ((import.meta.env.VITE_API_URL as string | undefined) ?? "") + "/api";

const TODAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];

type TFn = (key: string) => string;

function getDays(t: TFn) {
  return [
    { id: "Monday",    short: t("meal_plan.day_short_monday"),    label: t("meal_plan.day_monday") },
    { id: "Tuesday",   short: t("meal_plan.day_short_tuesday"),   label: t("meal_plan.day_tuesday") },
    { id: "Wednesday", short: t("meal_plan.day_short_wednesday"), label: t("meal_plan.day_wednesday") },
    { id: "Thursday",  short: t("meal_plan.day_short_thursday"),  label: t("meal_plan.day_thursday") },
    { id: "Friday",    short: t("meal_plan.day_short_friday"),    label: t("meal_plan.day_friday") },
    { id: "Saturday",  short: t("meal_plan.day_short_saturday"),  label: t("meal_plan.day_saturday") },
    { id: "Sunday",    short: t("meal_plan.day_short_sunday"),    label: t("meal_plan.day_sunday") },
  ];
}

function getMealSlots(t: TFn) {
  return [
    { id: "lunch",  label: t("meal_plan.slot_lunch"),  emoji: "☀️" },
    { id: "dinner", label: t("meal_plan.slot_dinner"), emoji: "🌙" },
  ];
}

function getFoodTypes(t: TFn) {
  return [
    { id: "burger",   emoji: "🍔", label: t("meal_plan.food_burger"),   from: "from-amber-400", to: "to-orange-500" },
    { id: "pizza",    emoji: "🍕", label: t("meal_plan.food_pizza"),    from: "from-red-400",   to: "to-rose-500" },
    { id: "meat",     emoji: "🥩", label: t("meal_plan.food_meat"),     from: "from-orange-500",to: "to-red-600" },
    { id: "fish",     emoji: "🐟", label: t("meal_plan.food_fish"),     from: "from-blue-400",  to: "to-cyan-500" },
    { id: "pasta",    emoji: "🍝", label: t("meal_plan.food_pasta"),    from: "from-yellow-400",to: "to-amber-500" },
    { id: "sushi",    emoji: "🍣", label: t("meal_plan.food_sushi"),    from: "from-rose-400",  to: "to-pink-600" },
    { id: "vegan",    emoji: "🌱", label: t("meal_plan.food_vegan"),    from: "from-green-400", to: "to-emerald-600" },
    { id: "desserts", emoji: "🍰", label: t("meal_plan.food_desserts"), from: "from-pink-400",  to: "to-fuchsia-500" },
    { id: "salat",    emoji: "🥗", label: t("meal_plan.food_salat"),    from: "from-lime-400",  to: "to-green-500" },
    { id: "mexican",  emoji: "🌮", label: t("meal_plan.food_mexican"),  from: "from-amber-300", to: "to-orange-400" },
    { id: "asian",    emoji: "🍜", label: t("meal_plan.food_asian"),    from: "from-red-300",   to: "to-orange-500" },
    { id: "oriental", emoji: "🥙", label: t("meal_plan.food_oriental"), from: "from-amber-400", to: "to-yellow-500" },
  ];
}

function getFoodThemeGroups(t: TFn) {
  return [
    { id: "burger",   emoji: "🍔", label: t("meal_plan.theme_burger"),   from: "from-amber-400", to: "to-orange-500" },
    { id: "pizza",    emoji: "🍕", label: t("meal_plan.theme_pizza"),    from: "from-red-400",   to: "to-rose-500" },
    { id: "sushi",    emoji: "🍣", label: t("meal_plan.theme_sushi"),    from: "from-rose-400",  to: "to-pink-600" },
    { id: "meat",     emoji: "🥩", label: t("meal_plan.theme_meat"),     from: "from-orange-500",to: "to-red-600" },
    { id: "fish",     emoji: "🐟", label: t("meal_plan.theme_fish"),     from: "from-blue-400",  to: "to-cyan-500" },
    { id: "pasta",    emoji: "🍝", label: t("meal_plan.theme_pasta"),    from: "from-yellow-400",to: "to-amber-500" },
    { id: "vegan",    emoji: "🌱", label: t("meal_plan.theme_vegan"),    from: "from-green-400", to: "to-emerald-600" },
    { id: "asian",    emoji: "🍜", label: t("meal_plan.theme_asian"),    from: "from-red-300",   to: "to-orange-500" },
    { id: "oriental", emoji: "🥙", label: t("meal_plan.theme_oriental"), from: "from-amber-400", to: "to-yellow-500" },
    { id: "mexican",  emoji: "🌮", label: t("meal_plan.theme_mexican"),  from: "from-amber-300", to: "to-orange-400" },
  ];
}

function getReminderOptions(t: TFn) {
  return [
    { id: "1_hour_before", label: t("meal_plan.reminder_1_hour_before") },
    { id: "1_day_before",  label: t("meal_plan.reminder_1_day_before") },
    { id: "both",          label: t("meal_plan.reminder_both") },
  ];
}

function getMealSlotOptions(t: TFn) {
  return [
    { id: "lunch",  label: `${t("meal_plan.slot_lunch")} ☀️` },
    { id: "dinner", label: `${t("meal_plan.slot_dinner")} 🌙` },
    { id: "brunch", label: `${t("meal_plan.slot_brunch")} 🥐` },
  ];
}

function getSendTimingOptions(t: TFn) {
  return [
    { id: "sofort",        label: t("meal_plan.send_now") },
    { id: "3_days_before", label: t("meal_plan.send_3d_before") },
    { id: "2_days_before", label: t("meal_plan.send_2d_before") },
    { id: "1_day_before",  label: t("meal_plan.send_1d_before") },
    { id: "manual",        label: t("meal_plan.send_manual") },
  ];
}

const FOOD_META: Record<string, { emoji: string; from: string; to: string }> = {
  burger:   { emoji: "🍔", from: "from-amber-400", to: "to-orange-500" },
  pizza:    { emoji: "🍕", from: "from-red-400",   to: "to-rose-500" },
  meat:     { emoji: "🥩", from: "from-orange-500",to: "to-red-600" },
  fish:     { emoji: "🐟", from: "from-blue-400",  to: "to-cyan-500" },
  pasta:    { emoji: "🍝", from: "from-yellow-400",to: "to-amber-500" },
  sushi:    { emoji: "🍣", from: "from-rose-400",  to: "to-pink-600" },
  vegan:    { emoji: "🌱", from: "from-green-400", to: "to-emerald-600" },
  desserts: { emoji: "🍰", from: "from-pink-400",  to: "to-fuchsia-500" },
  salat:    { emoji: "🥗", from: "from-lime-400",  to: "to-green-500" },
  mexican:  { emoji: "🌮", from: "from-amber-300", to: "to-orange-400" },
  asian:    { emoji: "🍜", from: "from-red-300",   to: "to-orange-500" },
  oriental: { emoji: "🥙", from: "from-amber-400", to: "to-yellow-500" },
};

function getFoodTypeData(id: string) {
  const m = FOOD_META[id];
  return m ? { id, ...m, label: id } : undefined;
}

function SmartMatchCard({ restaurant, foodType }: { restaurant: any; foodType: string }) {
  const { t } = useTranslation();
  const ft = getFoodTypeData(foodType);
  return (
    <Link href={`/restaurant/${restaurant.id}`}>
      <div className="flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md transition-all press-scale cursor-pointer">
        {restaurant.heroImage ? (
          <img src={restaurant.heroImage} className="w-14 h-14 rounded-xl object-cover shrink-0" alt={restaurant.name} />
        ) : (
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${ft?.from ?? "from-primary"} ${ft?.to ?? "to-accent"} flex items-center justify-center text-2xl shrink-0`}>
            {ft?.emoji ?? "🍽️"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{restaurant.name}</p>
          <p className="text-xs text-muted-foreground truncate">{restaurant.address}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{restaurant.rating.toFixed(1)}
            </span>
            {restaurant.isOpenNow ? (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{t("meal_plan.open_label")}</span>
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{t("meal_plan.closed_label")}</span>
            )}
            {restaurant.hasActiveFlash && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                <Zap className="w-2.5 h-2.5" />-{restaurant.flashPercentage}%
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
}

function SlotPicker({
  day, slot, currentFoodType, onSelect, onClear,
}: {
  day: string; slot: { id: string; label: string; emoji: string };
  currentFoodType: string | null; onSelect: (foodType: string) => void; onClear: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const FOOD_TYPES = getFoodTypes(t);
  const selected = FOOD_TYPES.find((f) => f.id === currentFoodType);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <span className="text-base">{slot.emoji}</span> {slot.label}
        </span>
        {selected && (
          <button onClick={onClear} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 press-scale">
            <X className="w-3 h-3" /> {t("meal_plan.delete_slot")}
          </button>
        )}
      </div>

      {selected ? (
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r ${selected.from} ${selected.to} text-white shadow-md press-scale`}
        >
          <span className="text-2xl">{selected.emoji}</span>
          <div className="text-left">
            <p className="font-bold text-sm">{selected.label}</p>
            <p className="text-xs opacity-80">{t("meal_plan.tap_to_change")}</p>
          </div>
          <Check className="w-4 h-4 ml-auto" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 p-3 rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/40 text-muted-foreground hover:text-primary transition-all press-scale text-sm"
        >
          <Plus className="w-4 h-4" />
          {t("meal_plan.plan_meal")}
        </button>
      )}

      {open && (
        <div className="mt-3 p-3 rounded-2xl border border-border/60 bg-muted/30 backdrop-blur-sm">
          <div className="grid grid-cols-4 gap-2">
            {FOOD_TYPES.map((ft) => (
              <button
                key={ft.id}
                onClick={() => { onSelect(ft.id); setOpen(false); }}
                className={`relative flex flex-col items-center gap-1.5 press-scale group`}
              >
                <div className={`w-full aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
                  currentFoodType === ft.id
                    ? `bg-gradient-to-br ${ft.from} ${ft.to} shadow-sm`
                    : "bg-background border border-border/60 group-hover:border-primary/30"
                }`}>
                  {ft.emoji}
                </div>
                <span className="text-[10px] font-bold text-center text-muted-foreground leading-tight">{ft.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TodayMatchesSection({ plans, email }: { plans: any[]; email: string }) {
  const { t } = useTranslation();
  const todayPlans = plans.filter((p) => p.dayOfWeek === TODAY_EN);
  if (!todayPlans.length) return null;

  return (
    <div className="mt-6 bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-sm">{t("meal_plan.today_matches")}</h3>
          <p className="text-xs text-muted-foreground">{t("meal_plan.today_matches_subtitle")}</p>
        </div>
      </div>
      {todayPlans.map((plan) => (
        <TodaySlotMatches key={`${plan.dayOfWeek}-${plan.mealSlot}`} plan={plan} email={email} />
      ))}
    </div>
  );
}

function TodaySlotMatches({ plan, email }: { plan: any; email: string }) {
  const { t } = useTranslation();
  const MEAL_SLOTS = getMealSlots(t);
  const slot = MEAL_SLOTS.find((s) => s.id === plan.mealSlot);
  const ft = getFoodTypeData(plan.foodType);
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["meal-suggestions", plan.foodType],
    queryFn: async () => {
      const r = await fetch(`${API}/meal-plan/${encodeURIComponent(email)}/suggestions?foodType=${plan.foodType}`);
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{slot?.emoji}</span>
        <span className="text-xs font-semibold text-muted-foreground">{slot?.label}</span>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${ft?.from} ${ft?.to}`}>
          {ft?.emoji} {ft?.label}
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
          <Loader2 className="w-4 h-4 animate-spin" /> {t("meal_plan.searching_restaurants")}
        </div>
      ) : suggestions?.length > 0 ? (
        <div className="space-y-2">
          {suggestions.slice(0, 3).map((r: any) => (
            <SmartMatchCard key={r.id} restaurant={r} foodType={plan.foodType} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2 px-3 bg-muted/40 rounded-xl">{t("meal_plan.no_matches")}</p>
      )}
    </div>
  );
}

interface GroupParticipant { name: string; phone: string; }
interface RestaurantRef { id: number; name: string; address: string; heroImage?: string; }
interface GroupPlan {
  id: number;
  title: string;
  date: string;
  time: string;
  mealSlot: string;
  foodTheme: string;
  participants: GroupParticipant[];
  groupSize: number;
  reminderTiming: string;
  organizerName: string;
  restaurantId?: number | null;
  restaurant?: RestaurantRef | null;
}

// ─── Reservation Request types + constants ───────────────────────────────────

interface ReservationRequest {
  id: number;
  groupPlanId: number;
  restaurantId: number;
  restaurantName: string;
  partySize: number;
  requestedDate: string;
  requestedTime: string;
  note: string;
  sendTiming: string;
  status: string;
  scheduledSendAt?: string | null;
  sentAt?: string | null;
}

const RESERVATION_STATUS_STYLES: Record<string, { cls: string; dotCls: string }> = {
  planned:   { cls: "bg-muted/60 text-muted-foreground border-border/60",        dotCls: "bg-slate-400" },
  sent:      { cls: "bg-blue-500/10 text-blue-600 border-blue-500/20",          dotCls: "bg-blue-500 animate-pulse" },
  confirmed: { cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",  dotCls: "bg-emerald-500" },
  rejected:  { cls: "bg-rose-500/10 text-rose-600 border-rose-500/20",           dotCls: "bg-rose-500" },
  cancelled: { cls: "bg-muted/40 text-muted-foreground/60 border-border/30",     dotCls: "bg-slate-300" },
};

function getReservationStatus(status: string, t: TFn) {
  const styles = RESERVATION_STATUS_STYLES[status] ?? RESERVATION_STATUS_STYLES.planned;
  const labelKey = `meal_plan.status_${status}_label` as const;
  return { ...styles, label: t(labelKey) };
}

// ─── Setup Reservation Modal ──────────────────────────────────────────────────

function SetupReservationModal({
  plan, onClose, onSaved,
}: { plan: GroupPlan; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [partySize, setPartySize] = useState(plan.groupSize.toString());
  const [date, setDate] = useState(plan.date);
  const [time, setTime] = useState(plan.time);
  const [note, setNote] = useState("");
  const [sendTiming, setSendTiming] = useState("sofort");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const SEND_TIMING_OPTIONS = getSendTimingOptions(t);

  const email = localStorage.getItem("restosmart_email") ?? "";
  const userName = localStorage.getItem("restosmart_user_name") ?? "";

  const handleSubmit = async () => {
    if (!plan.restaurant) { setError(t("meal_plan.no_restaurant_selected")); return; }
    if (!date || !time) { setError(t("meal_plan.date_time_required")); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API}/meal-plan/reservation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          groupPlanId: plan.id,
          restaurantId: plan.restaurant.id,
          restaurantName: plan.restaurant.name,
          organizerEmail: email,
          organizerName: userName,
          partySize: parseInt(partySize) || plan.groupSize,
          requestedDate: date,
          requestedTime: time,
          note: note.trim(),
          sendTiming,
        }),
      });
      if (!res.ok) throw new Error("Fehler");
      onSaved();
      onClose();
    } catch {
      setError(t("meal_plan.create_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-background rounded-3xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="h-1.5 bg-gradient-to-r from-primary to-accent" />
        <div className="p-5 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base">{t("meal_plan.reservation_title")}</h2>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{plan.restaurant?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.date_label")}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.time_label")} *</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("common.party_size") || "Personenzahl"}</label>
            <input type="number" value={partySize} onChange={e => setPartySize(e.target.value)} min={1} max={100}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.send_timing_label")}</label>
            <div className="grid grid-cols-1 gap-2">
              {SEND_TIMING_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setSendTiming(opt.id)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all press-scale text-left ${sendTiming === opt.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${sendTiming === opt.id ? "border-primary" : "border-muted-foreground/40"}`}>
                    {sendTiming === opt.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.request_note_label")}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder={t("meal_plan.request_note_placeholder")}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>

          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{error}</p>}

          {sendTiming === "sofort" && (
            <div className="flex items-start gap-2 bg-blue-500/8 border border-blue-500/20 rounded-xl px-3 py-2.5">
              <Zap className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-600">{t("meal_plan.sending_request")}</p>
            </div>
          )}
          {sendTiming === "manual" && (
            <div className="flex items-start gap-2 bg-muted/50 border border-border/60 rounded-xl px-3 py-2.5">
              <Bell className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">{t("meal_plan.save_request")}</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t shrink-0 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-border text-sm font-bold hover:bg-muted/50 transition-colors press-scale">
            {t("common.cancel")}
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-primary to-accent text-white text-sm font-bold shadow-md shadow-primary/25 press-scale flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
            {saving ? t("common.loading") : sendTiming === "manual" ? t("meal_plan.save_request") : t("meal_plan.send_request")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Share Plan Sheet ─────────────────────────────────────────────────────────

function SharePlanSheet({ plan, onClose }: { plan: GroupPlan; onClose: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const planUrl = `${window.location.origin}${import.meta.env.BASE_URL}plan/${plan.id}`;
  const dateStr = new Date(plan.date).toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "short" });
  const msgText = [
    `Hey! Unser Gruppenplan 🍽️`,
    plan.restaurant ? `📍 ${plan.restaurant.name}` : "",
    plan.restaurant ? `🗺️ ${plan.restaurant.address}` : "",
    `📅 ${dateStr} um ${plan.time} Uhr`,
    `👥 ${plan.groupSize} Personen`,
    `\n${planUrl}`,
  ].filter(Boolean).join("\n");

  const handleNative = async () => {
    try {
      if (navigator.share && navigator.canShare?.({ url: planUrl })) {
        await navigator.share({ title: plan.title, text: msgText, url: planUrl });
        onClose();
        return;
      }
    } catch { /* fallthrough to options below */ }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(planUrl); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareOptions = [
    {
      label: t("meal_plan.share_via_whatsapp"),
      icon: "💬",
      cls: "bg-[#25D366]/10 text-[#128C7E] border-[#25D366]/30 hover:bg-[#25D366]/20",
      href: `https://wa.me/?text=${encodeURIComponent(msgText)}`,
    },
    {
      label: t("meal_plan.share_via_email"),
      icon: "✉️",
      cls: "bg-primary/8 text-primary border-primary/20 hover:bg-primary/15",
      href: `mailto:?subject=${encodeURIComponent(`Gruppenplan: ${plan.title}`)}&body=${encodeURIComponent(msgText)}`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-background rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1.5 bg-gradient-to-r from-primary to-accent" />
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-bold text-base">{t("meal_plan.share_btn")}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-muted-foreground">{t("common.share_hint") || "Teile diesen Plan mit deinen Freunden."}</p>
          {shareOptions.map(o => (
            <a key={o.label} href={o.href} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-3 p-3.5 rounded-2xl border font-semibold text-sm transition-all ${o.cls}`}>
              <span className="text-xl leading-none">{o.icon}</span>
              <span>{o.label}</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </a>
          ))}
          <button onClick={copy}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-muted/40 font-semibold text-sm hover:bg-muted/70 transition-all">
            {copied
              ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              : <Link2 className="w-5 h-5 text-muted-foreground shrink-0" />
            }
            <span className={copied ? "text-emerald-600" : "text-foreground"}>
              {copied ? t("meal_plan.link_copied") : t("common.copy_link") || "Link kopieren"}
            </span>
          </button>
          <button onClick={handleNative}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-primary/20 bg-primary/5 font-semibold text-sm hover:bg-primary/10 transition-all text-primary">
            <Share2 className="w-5 h-5 shrink-0" />
            <span>{t("common.more_options") || "Mehr Optionen\u2026"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Restaurant Picker ────────────────────────────────────────────────────────

function RestaurantPickerSection({
  selected, onSelect, onClear,
}: {
  selected: RestaurantRef | null;
  onSelect: (r: RestaurantRef) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: allRestaurants = [] } = useQuery<any[]>({
    queryKey: ["restaurants-picker"],
    queryFn: async () => {
      const r = await fetch(`${API}/marketplace/restaurants`);
      return r.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const filtered = search.trim().length > 0
    ? allRestaurants.filter((r: any) =>
        r.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.address?.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 6)
    : allRestaurants.slice(0, 6);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("meal_plan.reservation_to") || "Restaurant (optional)"}</label>
        {selected && (
          <button onClick={onClear} className="text-xs text-destructive hover:opacity-70 transition-opacity">{t("common.remove")}</button>
        )}
      </div>

      {selected ? (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/20">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground truncate">{selected.name}</p>
            <p className="text-xs text-muted-foreground truncate">{selected.address}</p>
          </div>
          <button onClick={() => setOpen(!open)} className="text-xs text-primary font-semibold hover:opacity-70 press-scale shrink-0">
            {open ? t("common.done") : t("common.change")}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 p-3 rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/40 text-muted-foreground hover:text-primary transition-all press-scale text-sm"
        >
          <Building2 className="w-4 h-4" /> {t("meal_plan.search_restaurant")}
        </button>
      )}

      {open && (
        <div className="mt-2 rounded-2xl border border-border/60 bg-muted/30 backdrop-blur-sm overflow-hidden">
          <div className="p-2 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t("meal_plan.search_restaurant")}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">{t("meal_plan.no_matches")}</p>
            )}
            {filtered.map((r: any) => (
              <button
                key={r.id}
                onClick={() => { onSelect({ id: r.id, name: r.name, address: r.address }); setOpen(false); setSearch(""); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
              >
                {r.heroImage
                  ? <img src={r.heroImage} className="w-10 h-10 rounded-xl object-cover shrink-0" alt={r.name} />
                  : <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 text-lg">🍽️</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.address}</p>
                </div>
                {r.rating && (
                  <div className="flex items-center gap-0.5 text-xs text-amber-500 font-semibold shrink-0">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{Number(r.rating).toFixed(1)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupPlanCard({
  plan, onDelete, onEdit, reservationRequest, onReservationChange,
}: {
  plan: GroupPlan; onDelete: () => void; onEdit: () => void;
  reservationRequest: ReservationRequest | null; onReservationChange: () => void;
}) {
  const { t } = useTranslation();
  const [showShare, setShowShare] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSetupReservation, setShowSetupReservation] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const FOOD_THEME_GROUPS = getFoodThemeGroups(t);
  const REMINDER_OPTIONS = getReminderOptions(t);
  const ft = FOOD_THEME_GROUPS.find((f) => f.id === plan.foodTheme);
  const dateObj = new Date(plan.date);
  const isUpcoming = dateObj >= new Date(new Date().setHours(0,0,0,0));

  const handleSendNow = async () => {
    if (!reservationRequest) return;
    setSendingNow(true);
    try {
      await fetch(`${API}/meal-plan/reservation/${reservationRequest.id}/send`, { method: "POST", credentials: "include" });
      onReservationChange();
    } finally { setSendingNow(false); }
  };

  const handleCancelRequest = async () => {
    if (!reservationRequest) return;
    setCancelling(true);
    try {
      await fetch(`${API}/meal-plan/reservation/${reservationRequest.id}`, { method: "DELETE", credentials: "include" });
      onReservationChange();
    } finally { setCancelling(false); }
  };

  const rs = reservationRequest ? getReservationStatus(reservationRequest.status, t) : null;

  const { data: suggestions } = useQuery({
    queryKey: ["group-suggestions", plan.id],
    queryFn: async () => {
      const r = await fetch(`${API}/meal-plan/group/${plan.id}/suggestions`);
      return r.json();
    },
    enabled: showSuggestions,
  });

  const reminder = REMINDER_OPTIONS.find((r) => r.id === plan.reminderTiming);
  const participants = Array.isArray(plan.participants) ? plan.participants : [];

  return (
    <>
      <div className={`rounded-2xl border overflow-hidden transition-all ${isUpcoming ? "border-primary/20 bg-card" : "border-border/50 bg-muted/20 opacity-70"}`}>
        <div className={`h-2 bg-gradient-to-r ${ft?.from ?? "from-primary"} ${ft?.to ?? "to-accent"}`} />
        <div className="p-4">
          {/* Title + theme */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ft?.from ?? "from-primary"} ${ft?.to ?? "to-accent"} flex items-center justify-center text-xl shrink-0`}>
                {ft?.emoji ?? "🍽️"}
              </div>
              <div>
                <h3 className="font-bold text-sm">{plan.title}</h3>
                <p className="text-xs text-muted-foreground">{ft?.label ?? plan.foodTheme}</p>
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{dateObj.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>{plan.time} Uhr</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span>{plan.groupSize} Personen</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bell className="w-3.5 h-3.5 text-primary" />
              <span>{reminder?.label ?? plan.reminderTiming}</span>
            </div>
          </div>

          {/* Restaurant */}
          {plan.restaurant && (
            <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/15 rounded-2xl p-3 mb-3">
              <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary mb-0.5">{t("common.meeting_point") || "Treffpunkt"}</p>
                <p className="text-sm font-bold text-foreground truncate">{plan.restaurant.name}</p>
                <p className="text-xs text-muted-foreground truncate">{plan.restaurant.address}</p>
              </div>
            </div>
          )}

          {/* Participants */}
          {participants.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t("meal_plan.participants_label")}</p>
              <div className="flex flex-wrap gap-1.5">
                {participants.map((p, i) => (
                  <div key={i} className="flex items-center gap-1 bg-primary/5 border border-primary/10 rounded-full px-2.5 py-1">
                    <User className="w-3 h-3 text-primary" />
                    <span className="text-[11px] font-semibold">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reservation Request Section */}
          {plan.restaurant && (
            <div className="mb-3">
              {!reservationRequest ? (
                <button
                  onClick={() => setShowSetupReservation(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/60 text-primary text-xs font-bold hover:bg-primary/5 transition-all press-scale"
                >
                  <CalendarDays className="w-4 h-4" /> {t("meal_plan.reservation_title")}
                </button>
              ) : (
                <div className={`rounded-2xl border p-3 ${rs!.cls}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${rs!.dotCls}`} />
                    <p className="text-xs font-extrabold uppercase tracking-widest">{t("common.reservation_status") || "Reservierungsstatus"}</p>
                    <span className="ml-auto text-xs font-bold">{rs!.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs opacity-80 mb-2">
                    <span>{new Date(reservationRequest.requestedDate).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })}</span>
                    <span>·</span>
                    <span>{reservationRequest.requestedTime} Uhr</span>
                    <span>·</span>
                    <span>{reservationRequest.partySize} Personen</span>
                  </div>
                  {reservationRequest.note && (
                    <p className="text-xs italic opacity-70 mb-2 line-clamp-1">{reservationRequest.note}</p>
                  )}
                  <div className="flex gap-2 mt-1">
                    {reservationRequest.status === "planned" && reservationRequest.sendTiming === "manual" && (
                      <button onClick={handleSendNow} disabled={sendingNow}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold press-scale disabled:opacity-60">
                        {sendingNow ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        {t("meal_plan.send_now")}
                      </button>
                    )}
                    {["planned", "sent"].includes(reservationRequest.status) && (
                      <button onClick={handleCancelRequest} disabled={cancelling}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-current/20 bg-current/5 text-[11px] font-bold press-scale disabled:opacity-60">
                        {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        {t("common.cancel_request") || "Stornieren"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Suggest restaurants */}
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary py-2 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors press-scale mb-3"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {showSuggestions ? t("meal_plan.hide_suggestions") : t("meal_plan.show_suggestions")}
          </button>

          {showSuggestions && suggestions && (
            <div className="mb-3 space-y-2">
              {suggestions.length > 0 ? (
                suggestions.slice(0, 3).map((r: any) => (
                  <SmartMatchCard key={r.id} restaurant={r} foodType={plan.foodTheme} />
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">{t("meal_plan.no_matches")}</p>
              )}
            </div>
          )}

          {/* Action row */}
          <div className="flex gap-2 pt-1 border-t border-border/40">
            <button
              onClick={() => setShowShare(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 transition-colors press-scale"
            >
              <Share2 className="w-3.5 h-3.5" /> {t("common.share")}
            </button>
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-muted-foreground bg-muted/40 hover:bg-muted/70 transition-colors press-scale"
            >
              <Pencil className="w-3.5 h-3.5" /> {t("common.edit")}
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors press-scale"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showShare && <SharePlanSheet plan={plan} onClose={() => setShowShare(false)} />}
      {showSetupReservation && (
        <SetupReservationModal
          plan={plan}
          onClose={() => setShowSetupReservation(false)}
          onSaved={() => { setShowSetupReservation(false); onReservationChange(); }}
        />
      )}
    </>
  );
}

function CreateGroupPlanModal({ onClose, onCreated, email, userName }: {
  onClose: () => void; onCreated: () => void; email: string; userName: string;
}) {
  const { t } = useTranslation();
  const MEAL_SLOT_OPTIONS = getMealSlotOptions(t);
  const FOOD_THEME_GROUPS = getFoodThemeGroups(t);
  const REMINDER_OPTIONS = getReminderOptions(t);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [mealSlot, setMealSlot] = useState("dinner");
  const [foodTheme, setFoodTheme] = useState("");
  const [reminderTiming, setReminderTiming] = useState("1_hour_before");
  const [participants, setParticipants] = useState<GroupParticipant[]>([{ name: "", phone: "" }]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantRef | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [savedPlanId, setSavedPlanId] = useState<number | null>(null);
  const [showShareAfterSave, setShowShareAfterSave] = useState(false);

  const addParticipant = () => setParticipants([...participants, { name: "", phone: "" }]);
  const removeParticipant = (i: number) => setParticipants(participants.filter((_, j) => j !== i));
  const updateParticipant = (i: number, field: "name" | "phone", value: string) => {
    const next = [...participants];
    next[i][field] = value;
    setParticipants(next);
  };

  const canSave = !!title.trim() && !!date && !!foodTheme;

  const doCreate = async (): Promise<number | null> => {
    if (!canSave) { setError(t("meal_plan.required_fields_error")); return null; }
    setError("");
    const validParticipants = participants.filter((p) => p.name.trim());
    const res = await fetch(`${API}/meal-plan/group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        organizerEmail: email,
        organizerName: userName,
        title: title.trim(),
        date, time, mealSlot, foodTheme,
        participants: validParticipants,
        groupSize: validParticipants.length + 1,
        reminderTiming,
        restaurantId: selectedRestaurant?.id ?? null,
      }),
    });
    if (!res.ok) throw new Error("Fehler");
    const data = await res.json();
    return data.id ?? null;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await doCreate();
      onCreated();
      onClose();
    } catch {
      setError(t("meal_plan.create_error"));
    } finally {
      setSaving(false);
    }
  };

  const handleShareAndCreate = async () => {
    setSharing(true);
    try {
      const id = await doCreate();
      if (id) {
        setSavedPlanId(id);
        onCreated();
        setShowShareAfterSave(true);
      }
    } catch {
      setError(t("meal_plan.create_error"));
    } finally {
      setSharing(false);
    }
  };

  if (showShareAfterSave && savedPlanId !== null) {
    const tempPlan: GroupPlan = {
      id: savedPlanId, title, date, time, mealSlot, foodTheme,
      participants: participants.filter(p => p.name.trim()),
      groupSize: participants.filter(p => p.name.trim()).length + 1,
      reminderTiming, organizerName: userName, restaurant: selectedRestaurant,
    };
    return <SharePlanSheet plan={tempPlan} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-background rounded-3xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 bg-gradient-to-r from-primary to-accent" />
        <div className="p-5 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-bold text-base">{t("meal_plan.create_group_plan_title")}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              {t("meal_plan.title_label")}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("meal_plan.title_placeholder")}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.date_label")}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.time_label")}</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.meal_label")}</label>
            <div className="grid grid-cols-3 gap-2">
              {MEAL_SLOT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setMealSlot(opt.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all press-scale ${
                    mealSlot === opt.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              {t("meal_plan.food_theme_label")}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {FOOD_THEME_GROUPS.map((ft) => (
                <button
                  key={ft.id}
                  onClick={() => setFoodTheme(ft.id)}
                  className="relative flex flex-col items-center gap-1.5 press-scale"
                >
                  <div className={`w-full aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
                    foodTheme === ft.id
                      ? `bg-gradient-to-br ${ft.from} ${ft.to} shadow-sm`
                      : "bg-muted/50 border border-border/60"
                  }`}>
                    {ft.emoji}
                  </div>
                  {foodTheme === ft.id && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <Check className="w-2.5 h-2.5 text-primary" />
                    </div>
                  )}
                  <span className="text-[9px] font-bold text-center text-muted-foreground leading-tight line-clamp-2">{ft.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.reminder_label")}</label>
            <div className="grid grid-cols-3 gap-2">
              {REMINDER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setReminderTiming(opt.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all press-scale ${
                    reminderTiming === opt.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("meal_plan.participants_label")}</label>
              <button
                onClick={addParticipant}
                className="text-xs font-semibold text-primary flex items-center gap-1 press-scale"
              >
                <Plus className="w-3.5 h-3.5" /> {t("meal_plan.add_btn")}
              </button>
            </div>
            <div className="space-y-2">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                    {i + 1}
                  </div>
                  <input
                    value={p.name}
                    onChange={(e) => updateParticipant(i, "name", e.target.value)}
                    placeholder={t("meal_plan.name_placeholder")}
                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <input
                    value={p.phone}
                    onChange={(e) => updateParticipant(i, "phone", e.target.value)}
                    placeholder={t("meal_plan.phone_placeholder")}
                    type="tel"
                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {participants.length > 1 && (
                    <button onClick={() => removeParticipant(i)} className="p-1 hover:text-destructive press-scale">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Restaurant picker */}
          <RestaurantPickerSection
            selected={selectedRestaurant}
            onSelect={setSelectedRestaurant}
            onClear={() => setSelectedRestaurant(null)}
          />

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {/* 3-button sticky action bar */}
        <div className="p-5 border-t shrink-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-border text-sm font-bold text-foreground hover:bg-muted/50 transition-colors press-scale"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || sharing || !canSave}
            className="flex-1 py-3 rounded-2xl bg-muted text-foreground text-sm font-bold press-scale flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-muted/80 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t("common.save")}
          </button>
          <button
            onClick={handleShareAndCreate}
            disabled={saving || sharing || !canSave}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-accent text-white text-sm font-bold shadow-md shadow-primary/25 press-scale flex items-center justify-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            {t("common.share")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Group Plan Modal ────────────────────────────────────────────────────

function EditGroupPlanModal({ plan, onClose, onUpdated, email }: {
  plan: GroupPlan; onClose: () => void; onUpdated: () => void; email: string;
}) {
  const { t } = useTranslation();
  const MEAL_SLOT_OPTIONS = getMealSlotOptions(t);
  const FOOD_THEME_GROUPS = getFoodThemeGroups(t);
  const REMINDER_OPTIONS = getReminderOptions(t);
  const [title, setTitle] = useState(plan.title);
  const [date, setDate] = useState(plan.date);
  const [time, setTime] = useState(plan.time);
  const [mealSlot, setMealSlot] = useState(plan.mealSlot);
  const [foodTheme, setFoodTheme] = useState(plan.foodTheme);
  const [reminderTiming, setReminderTiming] = useState(plan.reminderTiming);
  const [participants, setParticipants] = useState<GroupParticipant[]>(
    Array.isArray(plan.participants) && plan.participants.length > 0
      ? plan.participants
      : [{ name: "", phone: "" }]
  );
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantRef | null>(plan.restaurant ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addParticipant = () => setParticipants([...participants, { name: "", phone: "" }]);
  const removeParticipant = (i: number) => setParticipants(participants.filter((_, j) => j !== i));
  const updateParticipant = (i: number, field: "name" | "phone", value: string) => {
    const next = [...participants]; next[i][field] = value; setParticipants(next);
  };

  const handleUpdate = async () => {
    if (!title.trim() || !date || !foodTheme) { setError(t("meal_plan.required_fields_error")); return; }
    setSaving(true); setError("");
    try {
      const validParticipants = participants.filter(p => p.name.trim());
      const res = await fetch(`${API}/meal-plan/group/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), date, time, mealSlot, foodTheme,
          participants: validParticipants,
          groupSize: validParticipants.length + 1,
          reminderTiming,
          restaurantId: selectedRestaurant?.id ?? null,
        }),
      });
      if (!res.ok) throw new Error("Fehler");
      onUpdated();
    } catch {
      setError(t("meal_plan.save_error_mp"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-background rounded-3xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="h-1.5 bg-gradient-to-r from-primary to-accent" />
        <div className="p-5 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Pencil className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-bold text-base">{t("meal_plan.edit_plan_title")}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.title_label")}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t("meal_plan.title_placeholder")}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.date_label")}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.time_label")}</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.meal_label")}</label>
            <div className="grid grid-cols-3 gap-2">
              {MEAL_SLOT_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setMealSlot(opt.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all press-scale ${mealSlot === opt.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.food_theme_label")}</label>
            <div className="grid grid-cols-4 gap-2">
              {FOOD_THEME_GROUPS.map(ft => (
                <button key={ft.id} onClick={() => setFoodTheme(ft.id)} className="relative flex flex-col items-center gap-1.5 press-scale">
                  <div className={`w-full aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${foodTheme === ft.id ? `bg-gradient-to-br ${ft.from} ${ft.to} shadow-sm` : "bg-muted/50 border border-border/60"}`}>{ft.emoji}</div>
                  {foodTheme === ft.id && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <Check className="w-2.5 h-2.5 text-primary" />
                    </div>
                  )}
                  <span className="text-[9px] font-bold text-center text-muted-foreground leading-tight line-clamp-2">{ft.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{t("meal_plan.reminder_label")}</label>
            <div className="grid grid-cols-3 gap-2">
              {REMINDER_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setReminderTiming(opt.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all press-scale ${reminderTiming === opt.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("meal_plan.participants_label")}</label>
              <button onClick={addParticipant} className="text-xs font-semibold text-primary flex items-center gap-1 press-scale">
                <Plus className="w-3.5 h-3.5" /> {t("meal_plan.add_btn")}
              </button>
            </div>
            <div className="space-y-2">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">{i + 1}</div>
                  <input value={p.name} onChange={e => updateParticipant(i, "name", e.target.value)} placeholder={t("meal_plan.name_placeholder")}
                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <input value={p.phone} onChange={e => updateParticipant(i, "phone", e.target.value)} placeholder={t("meal_plan.phone_placeholder")} type="tel"
                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  {participants.length > 1 && (
                    <button onClick={() => removeParticipant(i)} className="p-1 hover:text-destructive press-scale"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <RestaurantPickerSection selected={selectedRestaurant} onSelect={setSelectedRestaurant} onClear={() => setSelectedRestaurant(null)} />

          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{error}</p>}
        </div>

        <div className="p-5 border-t shrink-0 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-border text-sm font-bold hover:bg-muted/50 transition-colors press-scale">
            {t("common.cancel")}
          </button>
          <button onClick={handleUpdate} disabled={saving}
            className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-primary to-accent text-white text-sm font-bold shadow-md shadow-primary/25 press-scale flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-opacity">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? t("meal_plan.saving") : t("common.update")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MealPlan() {
  const { t } = useTranslation();
  const DAYS = getDays(t);
  const MEAL_SLOTS = getMealSlots(t);
  const [email, setEmail] = useState(() => localStorage.getItem("restosmart_email") ?? "");
  const [inputEmail, setInputEmail] = useState("");

  useEffect(() => {
    const sync = () => setEmail(localStorage.getItem("restosmart_email") ?? "");
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const [activeTab, setActiveTab] = useState<"personal" | "group">("personal");
  const [selectedDay, setSelectedDay] = useState(TODAY_EN);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [smartPlanOpen, setSmartPlanOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<GroupPlan | null>(null);
  const qc = useQueryClient();

  const isLoggedIn = !!email;

  const { data: reservationRequests = [] } = useQuery<ReservationRequest[]>({
    queryKey: ["group-reservation-requests", email],
    queryFn: async () => {
      const r = await fetch(`${API}/meal-plan/reservation/organizer/${encodeURIComponent(email)}`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: isLoggedIn,
    staleTime: 30 * 1000,
  });

  const refreshReservations = () => qc.invalidateQueries({ queryKey: ["group-reservation-requests", email] });

  const { data: plans = [], isLoading: plansLoading } = useQuery<any[]>({
    queryKey: ["meal-plan", email],
    queryFn: async () => {
      const r = await fetch(`${API}/meal-plan/${encodeURIComponent(email)}`);
      return r.json();
    },
    enabled: isLoggedIn,
    staleTime: 30 * 1000,
  });

  const { data: profile } = useQuery<any>({
    queryKey: ["profile", email],
    queryFn: async () => {
      const r = await fetch(`${API}/customer-profile/${encodeURIComponent(email)}`);
      return r.json();
    },
    enabled: isLoggedIn,
  });

  const { data: groupPlans = [], isLoading: groupLoading } = useQuery<GroupPlan[]>({
    queryKey: ["group-plans", email],
    queryFn: async () => {
      const r = await fetch(`${API}/meal-plan/group/${encodeURIComponent(email)}`);
      return r.json();
    },
    enabled: isLoggedIn,
    staleTime: 30 * 1000,
  });

  const upsertSlot = useMutation({
    mutationFn: async ({ dayOfWeek, mealSlot, foodType }: { dayOfWeek: string; mealSlot: string; foodType: string }) => {
      const r = await fetch(`${API}/meal-plan/${encodeURIComponent(email)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek, mealSlot, foodType }),
      });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meal-plan", email] }),
  });

  const deleteSlot = useMutation({
    mutationFn: async ({ dayOfWeek, mealSlot }: { dayOfWeek: string; mealSlot: string }) => {
      const r = await fetch(`${API}/meal-plan/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dayOfWeek, mealSlot }),
      });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meal-plan", email] }),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API}/meal-plan/group/${id}`, { method: "DELETE", credentials: "include" });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group-plans", email] }),
  });

  const handleLogin = () => {
    if (!inputEmail.trim()) return;
    localStorage.setItem("restosmart_email", inputEmail.trim());
    setEmail(inputEmail.trim());
  };

  function getPlanForSlot(day: string, slot: string) {
    return plans.find((p) => p.dayOfWeek === day && p.mealSlot === slot) ?? null;
  }

  function countPlannedDay(day: string) {
    return plans.filter((p) => p.dayOfWeek === day).length;
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl shadow-primary/30 mb-4">
          <CalendarDays className="w-8 h-8 text-white" />
        </div>
        <h1 className="font-bold text-2xl mb-2">{t("meal_plan.login_title")}</h1>
        <p className="text-muted-foreground text-sm mb-6 max-w-xs">
          {t("meal_plan.login_subtitle")}
        </p>
        <div className="w-full max-w-xs space-y-3">
          <input
            type="email"
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder={t("meal_plan.login_email_placeholder")}
            className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
          />
          <button
            onClick={handleLogin}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-sm shadow-lg shadow-primary/25 press-scale"
          >
            {t("meal_plan.login_btn_mp")}
          </button>
        </div>
      </div>
    );
  }

  const userName = profile?.name ?? email.split("@")[0];
  const upcomingGroupPlans = (groupPlans as GroupPlan[]).filter(
    (p) => new Date(p.date) >= new Date(new Date().setHours(0, 0, 0, 0))
  );
  const pastGroupPlans = (groupPlans as GroupPlan[]).filter(
    (p) => new Date(p.date) < new Date(new Date().setHours(0, 0, 0, 0))
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/25">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl leading-tight">{t("meal_plan.login_title")}</h1>
            <p className="text-xs text-muted-foreground">{t("meal_plan.greeting", { name: userName })}</p>
          </div>
        </div>
      </div>

      {/* Smart Plan CTA */}
      <div className="mb-5">
        <SmartPlanTriggerButton onOpen={() => setSmartPlanOpen(true)} variant="card" />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 bg-muted/40 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab("personal")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all press-scale ${
            activeTab === "personal"
              ? "bg-white shadow-sm text-primary"
              : "text-muted-foreground"
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" /> {t("meal_plan.tab_personal")}
        </button>
        <button
          onClick={() => setActiveTab("group")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all press-scale ${
            activeTab === "group"
              ? "bg-white shadow-sm text-primary"
              : "text-muted-foreground"
          }`}
        >
          <Users className="w-4 h-4" /> {t("meal_plan.tab_group")}
          {upcomingGroupPlans.length > 0 && (
            <span className="ml-0.5 w-4 h-4 bg-gradient-to-br from-primary to-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {upcomingGroupPlans.length}
            </span>
          )}
        </button>
      </div>

      {/* Personal Plan Tab */}
      {activeTab === "personal" && (
        <div>
          {/* Day selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
            {DAYS.map((day) => {
              const isToday = day.id === TODAY_EN;
              const isSelected = day.id === selectedDay;
              const count = countPlannedDay(day.id);
              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedDay(day.id)}
                  className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl transition-all press-scale shrink-0 relative ${
                    isSelected
                      ? "bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30"
                      : isToday
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  <span className="text-[10px] font-semibold">{day.short}</span>
                  {count > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/70" : "bg-primary"}`} />
                  )}
                  {!count && <span className="w-1.5 h-1.5" />}
                </button>
              );
            })}
          </div>

          {/* Selected day label */}
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-bold text-base">
              {DAYS.find((d) => d.id === selectedDay)?.label}
              {selectedDay === TODAY_EN && (
                <span className="ml-2 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{t("common.today")}</span>
              )}
            </h2>
          </div>

          {/* Meal slots */}
          {plansLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="bg-card border border-border/60 rounded-2xl p-4">
              {MEAL_SLOTS.map((slot, i) => {
                const plan = getPlanForSlot(selectedDay, slot.id);
                return (
                  <div key={slot.id}>
                    <SlotPicker
                      day={selectedDay}
                      slot={slot}
                      currentFoodType={plan?.foodType ?? null}
                      onSelect={(foodType) => upsertSlot.mutate({ dayOfWeek: selectedDay, mealSlot: slot.id, foodType })}
                      onClear={() => deleteSlot.mutate({ dayOfWeek: selectedDay, mealSlot: slot.id })}
                    />
                    {i < MEAL_SLOTS.length - 1 && <hr className="border-border/40 my-2" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Weekly overview strip */}
          {plans.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("meal_plan.week_overview")}</h3>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map((day) => {
                  const dayPlans = plans.filter((p) => p.dayOfWeek === day.id);
                  const isToday = day.id === TODAY_EN;
                  return (
                    <button
                      key={day.id}
                      onClick={() => setSelectedDay(day.id)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all press-scale ${
                        selectedDay === day.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/40"
                      }`}
                    >
                      <span className={`text-[9px] font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        {day.short}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        {MEAL_SLOTS.map((slot) => {
                          const plan = dayPlans.find((p) => p.mealSlot === slot.id);
                          const ft = plan ? getFoodTypeData(plan.foodType) : null;
                          return (
                            <div
                              key={slot.id}
                              className={`w-6 h-4 rounded-md flex items-center justify-center text-[8px] ${
                                ft ? `bg-gradient-to-br ${ft.from} ${ft.to}` : "bg-muted/50 border border-dashed border-border/40"
                              }`}
                            >
                              {ft ? ft.emoji : ""}
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Today's matches */}
          {plans.length > 0 && <TodayMatchesSection plans={plans} email={email} />}

          {plans.length === 0 && !plansLoading && (
            <div className="mt-6 text-center py-8 text-muted-foreground">
              <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">{t("meal_plan.no_meals_planned")}</p>
              <p className="text-xs mt-1">{t("meal_plan.no_meals_hint")}</p>
            </div>
          )}
        </div>
      )}

      {/* Group Plan Tab */}
      {activeTab === "group" && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-base">{t("meal_plan.group_plans_title")}</h2>
              <p className="text-xs text-muted-foreground">{t("meal_plan.group_plans_subtitle")}</p>
            </div>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white text-sm font-bold shadow-lg shadow-primary/25 press-scale"
            >
              <Plus className="w-4 h-4" /> {t("common.new")}
            </button>
          </div>

          {groupLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : groupPlans.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary/40" />
              </div>
              <p className="font-semibold text-sm text-muted-foreground">{t("meal_plan.group_empty")}</p>
              <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
                {t("meal_plan.group_empty_subtitle")}
              </p>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-sm shadow-lg shadow-primary/25 press-scale"
              >
                {t("meal_plan.create_first_plan")}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingGroupPlans.length > 0 && (
                <>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("meal_plan.upcoming_section")}</p>
                  {upcomingGroupPlans.map((plan) => (
                    <GroupPlanCard
                      key={plan.id}
                      plan={plan}
                      onDelete={() => deleteGroup.mutate(plan.id)}
                      onEdit={() => setEditPlan(plan)}
                      reservationRequest={reservationRequests.find(r => r.groupPlanId === plan.id) ?? null}
                      onReservationChange={refreshReservations}
                    />
                  ))}
                </>
              )}
              {pastGroupPlans.length > 0 && (
                <>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-4">{t("meal_plan.past_section")}</p>
                  {pastGroupPlans.map((plan) => (
                    <GroupPlanCard
                      key={plan.id}
                      plan={plan}
                      onDelete={() => deleteGroup.mutate(plan.id)}
                      onEdit={() => setEditPlan(plan)}
                      reservationRequest={reservationRequests.find(r => r.groupPlanId === plan.id) ?? null}
                      onReservationChange={refreshReservations}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showCreateGroup && (
        <CreateGroupPlanModal
          email={email}
          userName={userName}
          onClose={() => setShowCreateGroup(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["group-plans", email] })}
        />
      )}

      {editPlan && (
        <EditGroupPlanModal
          plan={editPlan}
          email={email}
          onClose={() => setEditPlan(null)}
          onUpdated={() => {
            setEditPlan(null);
            qc.invalidateQueries({ queryKey: ["group-plans", email] });
          }}
        />
      )}

      {/* ── SMART PLAN GENERATOR MODAL ── */}
      <SmartPlanGenerator
        open={smartPlanOpen}
        onClose={() => setSmartPlanOpen(false)}
        email={email}
        onConvertToGroupPlan={() => {
          setSmartPlanOpen(false);
          setActiveTab("group");
          setShowCreateGroup(true);
        }}
      />
    </div>
  );
}
