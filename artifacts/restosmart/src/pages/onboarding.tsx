import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getBizType, BizType,
  BIZ_STEP1_LABEL, BIZ_STEP2_LABEL,
  BIZ_ONBOARDING_TITLE, BIZ_NAME_LABEL, BIZ_CUISINE_LABEL,
  BIZ_DESCRIPTION_PLACEHOLDER, BIZ_EMAIL_PLACEHOLDER,
  BIZ_MENU_ONBOARDING_TITLE, BIZ_MENU_ONBOARDING_SUBTITLE,
  BIZ_MENU_EMPTY_STATE, BIZ_MENU_ADD_HINT, BIZ_MENU_PAGE_LINK_LABEL,
  BIZ_MARKETPLACE_ACTIVATE_DESC, BIZ_MARKETPLACE_ACTIVE_DESC,
  BIZ_LIVE_TOAST, BIZ_SETUP_TITLE, BIZ_SETUP_SUBTITLE,
  BIZ_POSSESSIVE,
} from "@/lib/biz-copy";
import {
  useGetOnboardingStatus,
  getGetOnboardingStatusQueryKey,
  useGetMyRestaurant,
  getGetMyRestaurantQueryKey,
  useUpdateMyRestaurant,
  useUpdateOnboardingStep,
  useEnableBookings,
  useCompleteOnboarding,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  UtensilsCrossed,
  Users,
  BookOpen,
  Megaphone,
  Store,
  Zap,
} from "lucide-react";

// ─── Step indicator ───────────────────────────────────────────────────────────

function getSteps(biz: BizType) {
  return [
    { label: BIZ_STEP1_LABEL[biz], icon: Store },
    { label: BIZ_STEP2_LABEL[biz], icon: UtensilsCrossed },
    { label: "Personal", icon: Users },
    { label: "Buchungen", icon: BookOpen },
    { label: "Rabatt", icon: Megaphone },
  ];
}

function StepIndicator({ current, steps }: { current: number; steps: ReturnType<typeof getSteps> }) {
  return (
    <div className="flex items-center gap-0 mb-8 justify-center overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const done = current > stepNum;
        const active = current === stepNum;
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all text-sm font-bold ${
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/30 text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={`text-[10px] font-medium whitespace-nowrap ${
                  active ? "text-foreground" : done ? "text-emerald-500" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 mb-5 transition-colors ${
                  current > stepNum ? "bg-emerald-500" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Business info ───────────────────────────────────────────────────

function Step1({
  onNext,
  isPending,
  biz,
}: {
  onNext: (data: Record<string, string>) => void;
  isPending: boolean;
  biz: BizType;
}) {
  const { data: restaurant, isLoading } = useGetMyRestaurant({
    query: { queryKey: getGetMyRestaurantQueryKey() },
  });

  const [form, setForm] = useState({
    name: "",
    cuisine: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    description: "",
  });

  useEffect(() => {
    if (restaurant) {
      setForm({
        name: restaurant.name ?? "",
        cuisine: restaurant.cuisine ?? "",
        address: restaurant.address ?? "",
        city: restaurant.city ?? "",
        phone: restaurant.phone ?? "",
        email: restaurant.email ?? "",
        description: restaurant.description ?? "",
      });
    }
  }, [restaurant]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const isValid = form.name.trim() && form.cuisine.trim() && form.address.trim() && form.phone.trim();

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">{BIZ_ONBOARDING_TITLE[biz]}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Diese Informationen erscheinen im Kunden-Marktplatz.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{BIZ_NAME_LABEL[biz]} *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="z. B. La Bella Cucina"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{BIZ_CUISINE_LABEL[biz]} *</Label>
          <Input
            value={form.cuisine}
            onChange={(e) => setForm((f) => ({ ...f, cuisine: e.target.value }))}
            placeholder="z.B. Italienisch, Indisch, Japanisch"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Straße und Hausnummer *</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="z. B. Musterstr. 42"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Stadt *</Label>
          <Input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="z. B. Wien"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Telefonnummer *</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="z. B. +43 1 234 5678"
          />
        </div>
        <div className="space-y-1.5">
          <Label>E-Mail</Label>
          <Input
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder={BIZ_EMAIL_PLACEHOLDER[biz]}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Kurzbeschreibung</Label>
        <Input
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder={BIZ_DESCRIPTION_PLACEHOLDER[biz]}
        />
      </div>

      <div className="flex justify-end">
        <Button
          className="gap-2"
          onClick={() => onNext(form)}
          disabled={!isValid || isPending}
        >
          Speichern & Weiter
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Menu ─────────────────────────────────────────────────────────────

function Step2({
  onNext,
  onBack,
  menuCount,
  biz,
}: {
  onNext: () => void;
  onBack: () => void;
  menuCount: number;
  biz: BizType;
}) {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">{BIZ_MENU_ONBOARDING_TITLE[biz]}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {BIZ_MENU_ONBOARDING_SUBTITLE[biz]}
        </p>
      </div>

      <div className="rounded-lg border border-border p-5 bg-muted/20 flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <UtensilsCrossed className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">
            {menuCount === 0
              ? BIZ_MENU_EMPTY_STATE[biz]
              : `${menuCount} Eintrag${menuCount !== 1 ? " hinzugefügt" : " hinzugefügt"}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {menuCount === 0
              ? "Einträge hinzufügen, damit Kunden wissen, was sie erwartet."
              : "Guter Start! Sie können jederzeit weitere Einträge hinzufügen."}
          </p>
        </div>
        {menuCount > 0 && <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />}
      </div>

      {menuCount === 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground mb-3">
            {BIZ_MENU_ADD_HINT[biz]}
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/menu")} className="gap-1.5">
            <UtensilsCrossed className="h-4 w-4" />
            {BIZ_MENU_PAGE_LINK_LABEL[biz]}
          </Button>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onNext}>
            Überspringen
          </Button>
          <Button onClick={onNext} disabled={menuCount === 0} className="gap-2">
            Weiter
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Staff ────────────────────────────────────────────────────────────

function Step3({
  onNext,
  onBack,
  staffCount,
}: {
  onNext: () => void;
  onBack: () => void;
  staffCount: number;
}) {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">Team hinzufügen</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Richten Sie Ihr Personal ein, um Schichten zuzuweisen und Ihr Team zu verwalten.
        </p>
      </div>

      <div className="rounded-lg border border-border p-5 bg-muted/20 flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <Users className="h-6 w-6 text-blue-500" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">
            {staffCount === 0
              ? "Noch keine Mitarbeiter"
              : `${staffCount} Teammitglied${staffCount !== 1 ? "er" : ""} hinzugefügt`}
          </p>
          <p className="text-sm text-muted-foreground">
            {staffCount === 0
              ? "Fügen Sie Köche, Kellner und Manager hinzu, um mit der Schichtplanung zu beginnen."
              : "Ihr Team ist eingerichtet. Sie können jederzeit weiteres Personal hinzufügen."}
          </p>
        </div>
        {staffCount > 0 && <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />}
      </div>

      {staffCount === 0 && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-sm text-muted-foreground mb-3">
            Gehen Sie zur Personalseite, um Ihr erstes Teammitglied hinzuzufügen.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/staff")} className="gap-1.5">
            <Users className="h-4 w-4" />
            Zum Personal
          </Button>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onNext}>
            Überspringen
          </Button>
          <Button onClick={onNext} className="gap-2">
            {staffCount > 0 ? "Weiter" : "Überspringen & Weiter"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Bookings ─────────────────────────────────────────────────────────

function Step4({
  onNext,
  onBack,
  bookingsEnabled,
  onEnable,
  isPending,
  biz,
}: {
  onNext: () => void;
  onBack: () => void;
  bookingsEnabled: boolean;
  onEnable: () => void;
  isPending: boolean;
  biz: BizType;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">Online-Buchungen aktivieren</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {BIZ_MARKETPLACE_ACTIVATE_DESC[biz]} Dies ist erforderlich, bevor Sie live gehen.
        </p>
      </div>

      <div
        className={`rounded-lg border p-5 transition-colors ${
          bookingsEnabled ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/20"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${
              bookingsEnabled ? "bg-emerald-500/10" : "bg-muted"
            }`}
          >
            <BookOpen className={`h-6 w-6 ${bookingsEnabled ? "text-emerald-500" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1">
            <p className="font-semibold">
              {bookingsEnabled ? "Online-Buchungen sind aktiviert" : "Online-Buchungen sind deaktiviert"}
            </p>
            <p className="text-sm text-muted-foreground">
              {bookingsEnabled
                ? BIZ_MARKETPLACE_ACTIVE_DESC[biz]
                : "Aktivieren Sie dies, damit Kunden direkt über den Marktplatz buchen können — ohne Anruf."}
            </p>
          </div>
          {bookingsEnabled && <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />}
        </div>

        {!bookingsEnabled && (
          <div className="mt-4">
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 w-full sm:w-auto"
              onClick={onEnable}
              disabled={isPending}
            >
              <BookOpen className="h-4 w-4" />
              Buchungen jetzt aktivieren
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
        <Button onClick={onNext} disabled={!bookingsEnabled} className="gap-2">
          Weiter
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 5: Discount ─────────────────────────────────────────────────────────

function Step5({
  onNext,
  onBack,
  discountCount,
}: {
  onNext: () => void;
  onBack: () => void;
  discountCount: number;
}) {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">Erste Kunden gewinnen</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Ein Eröffnungsrabatt ist der schnellste Weg zu Ihren ersten Buchungen. Sie können dies überspringen.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3 mb-4">
          <Zap className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-400">Warum einen Eröffnungsrabatt anbieten?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Neue Restaurants, die mit einem 15–25%-Angebot starten, erhalten in der ersten Woche typischerweise 3× mehr Buchungen.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 bg-card flex items-center gap-4 mb-4">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">
              {discountCount === 0 ? "Noch keine Rabatte" : `${discountCount} Rabatt${discountCount !== 1 ? "e" : ""} erstellt`}
            </p>
            <p className="text-xs text-muted-foreground">
              {discountCount === 0 ? "Erstellen Sie ein Blitzangebot oder geplanten Rabatt auf der Marketingseite." : "Sie sind startklar. Verwalten Sie Ihre Angebote jederzeit über Marketing."}
            </p>
          </div>
          {discountCount > 0 && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
        </div>

        <Button variant="outline" size="sm" onClick={() => navigate("/marketing")} className="gap-1.5">
          <Megaphone className="h-4 w-4" />
          Zum Marketing
        </Button>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onNext}>
            Überspringen
          </Button>
          <Button onClick={onNext} className="gap-2">
            {discountCount > 0 ? "Weiter" : "Überspringen & Weiter"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 6: Success ──────────────────────────────────────────────────────────

function StepSuccess({
  checklist,
  onGoLive,
  isPending,
}: {
  checklist: { id: string; label: string; completed: boolean }[];
  onGoLive: () => void;
  isPending: boolean;
}) {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-9 w-9 text-emerald-500" />
        </div>
        <h3 className="text-2xl font-bold">Fast startklar</h3>
        <p className="text-muted-foreground mt-2">
          Überprüfen Sie Ihre Einrichtung, dann gehen Sie live und beginnen Sie mit der Annahme von Buchungen.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        {checklist.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            {item.completed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <span className={`text-sm ${item.completed ? "text-foreground" : "text-muted-foreground"}`}>
              {item.label}
            </span>
            {!item.completed && (
              <Badge variant="outline" className="ml-auto text-xs text-muted-foreground">
                Optional
              </Badge>
              
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
          onClick={onGoLive}
          disabled={isPending}
        >
          <Zap className="h-4 w-4" />
          Jetzt live gehen
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate("/")}>
          Zum Dashboard
        </Button>
      </div>
    </div>
  );
}

// ─── Quick action bar (top of page when resuming) ────────────────────────────

function QuickActions({
  checklist,
}: {
  checklist: { id: string; label: string; completed: boolean; href: string | null }[];
}) {
  const [, navigate] = useLocation();
  const incomplete = checklist.filter((c) => !c.completed && c.href);
  if (incomplete.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <span className="text-xs text-muted-foreground self-center">Schnell hinzufügen:</span>
      {incomplete.map((item) => (
        <Button
          key={item.id}
          size="sm"
          variant="outline"
          className="text-xs h-7"
          onClick={() => navigate(item.href!)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const biz = getBizType();
  const bizSteps = getSteps(biz);

  const { data: status, isLoading } = useGetOnboardingStatus({
    query: { queryKey: getGetOnboardingStatusQueryKey() },
  });

  useEffect(() => {
    if (status) {
      const savedStep = status.onboardingStep;
      if (savedStep > 0 && savedStep <= 5 && step === 1) {
        setStep(savedStep);
      } else if (status.onboardingCompleted && step <= 5) {
        navigate("/");
      }
    }
  }, [status]);

  const updateStep = useUpdateOnboardingStep({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetOnboardingStatusQueryKey() }),
    },
  });

  const updateRestaurant = useUpdateMyRestaurant({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyRestaurantQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOnboardingStatusQueryKey() });
      },
      onError: () => toast({ title: "Betriebsdaten konnten nicht gespeichert werden", variant: "destructive" }),
    },
  });

  const enableBookings = useEnableBookings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOnboardingStatusQueryKey() });
        toast({ title: "Buchungssystem aktiviert", description: BIZ_MARKETPLACE_ACTIVE_DESC[getBizType()] });
      },
      onError: () => toast({ title: "Buchungssystem konnte nicht aktiviert werden", variant: "destructive" }),
    },
  });

  const completeOnboarding = useCompleteOnboarding({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOnboardingStatusQueryKey() });
        toast({ title: "Sie sind live!", description: BIZ_LIVE_TOAST[getBizType()] });
        navigate("/");
      },
      onError: () => toast({ title: "Etwas ist schiefgelaufen", variant: "destructive" }),
    },
  });

  function advance(nextStep: number) {
    setStep(nextStep);
    updateStep.mutate({ data: { step: nextStep } });
  }

  // ── Step handlers
  function handleStep1(data: Record<string, string>) {
    updateRestaurant.mutate({ data }, {
      onSuccess: () => advance(2),
    });
  }

  function handleStep2Next() { advance(3); }
  function handleStep3Next() { advance(4); }
  function handleStep4Next() { advance(5); }
  function handleStep5Next() { advance(6); }
  function handleGoLive() { completeOnboarding.mutate({}); }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const checklist = status?.checklist ?? [];
  const menuItem = checklist.find((c) => c.id === "menu_item");
  const staffItem = checklist.find((c) => c.id === "staff");
  const discountItem = checklist.find((c) => c.id === "discount");
  const menuCount = menuItem?.completed ? 1 : 0;
  const staffCount = staffItem?.completed ? 1 : 0;
  const discountCount = discountItem?.completed ? 1 : 0;

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight">{BIZ_SETUP_TITLE[biz]}</h2>
        <p className="text-muted-foreground mt-1">
          {BIZ_SETUP_SUBTITLE[biz]}
        </p>
      </div>

      {step < 6 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Step {step} of 5</span>
            <span className="text-xs font-medium text-primary">
              {status?.progressPercent ?? 0}% complete
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${status?.progressPercent ?? 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-6 mb-2">
        {step < 6 && <StepIndicator current={step} steps={bizSteps} />}
        {step < 6 && checklist.length > 0 && (
          <QuickActions checklist={checklist} />
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 1 && (
                <Step1
                  onNext={handleStep1}
                  isPending={updateRestaurant.isPending}
                  biz={biz}
                />
              )}
              {step === 2 && (
                <Step2
                  onNext={handleStep2Next}
                  onBack={() => advance(1)}
                  menuCount={menuCount}
                  biz={biz}
                />
              )}
              {step === 3 && (
                <Step3
                  onNext={handleStep3Next}
                  onBack={() => advance(2)}
                  staffCount={staffCount}
                />
              )}
              {step === 4 && (
                <Step4
                  onNext={handleStep4Next}
                  onBack={() => advance(3)}
                  bookingsEnabled={status?.bookingsEnabled ?? false}
                  onEnable={() => enableBookings.mutate({})}
                  isPending={enableBookings.isPending}
                  biz={biz}
                />
              )}
              {step === 5 && (
                <Step5
                  onNext={handleStep5Next}
                  onBack={() => advance(4)}
                  discountCount={discountCount}
                />
              )}
              {step === 6 && (
                <StepSuccess
                  checklist={checklist}
                  onGoLive={handleGoLive}
                  isPending={completeOnboarding.isPending}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
