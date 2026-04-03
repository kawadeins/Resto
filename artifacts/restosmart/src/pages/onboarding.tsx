import { useState, useEffect } from "react";
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

const STEPS = [
  { label: "Your restaurant", icon: Store },
  { label: "Menu", icon: UtensilsCrossed },
  { label: "Staff", icon: Users },
  { label: "Bookings", icon: BookOpen },
  { label: "Discount", icon: Megaphone },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8 justify-center overflow-x-auto pb-1">
      {STEPS.map((step, i) => {
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
            {i < STEPS.length - 1 && (
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

// ─── Step 1: Restaurant info ──────────────────────────────────────────────────

function Step1({
  onNext,
  isPending,
}: {
  onNext: (data: Record<string, string>) => void;
  isPending: boolean;
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
        <h3 className="text-xl font-bold">Tell us about your restaurant</h3>
        <p className="text-sm text-muted-foreground mt-1">
          This information will appear on the customer marketplace.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Restaurant name *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. La Bella Cucina"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Cuisine type *</Label>
          <Input
            value={form.cuisine}
            onChange={(e) => setForm((f) => ({ ...f, cuisine: e.target.value }))}
            placeholder="e.g. Italian, Indian, Japanese"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Street address *</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="e.g. 42 High Street"
          />
        </div>
        <div className="space-y-1.5">
          <Label>City *</Label>
          <Input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="e.g. London"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Phone number *</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="e.g. 020 7946 0958"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="hello@yourrestaurant.com"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Short description</Label>
        <Input
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="What makes your restaurant special? (optional)"
        />
      </div>

      <div className="flex justify-end">
        <Button
          className="gap-2"
          onClick={() => onNext(form)}
          disabled={!isValid || isPending}
        >
          Save & Continue
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
}: {
  onNext: () => void;
  onBack: () => void;
  menuCount: number;
}) {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">Add your menu</h3>
        <p className="text-sm text-muted-foreground mt-1">
          At least one active menu item is required before customers can see your restaurant.
        </p>
      </div>

      <div className="rounded-lg border border-border p-5 bg-muted/20 flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <UtensilsCrossed className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">
            {menuCount === 0
              ? "No menu items yet"
              : `${menuCount} menu item${menuCount !== 1 ? "s" : ""} added`}
          </p>
          <p className="text-sm text-muted-foreground">
            {menuCount === 0
              ? "Add dishes, drinks, or set menus so customers know what to expect."
              : "Great start! You can add more items any time from the Menu page."}
          </p>
        </div>
        {menuCount > 0 && <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />}
      </div>

      {menuCount === 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground mb-3">
            Head to the Menu page to add your first dish. Come back here when you're done.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/menu")} className="gap-1.5">
            <UtensilsCrossed className="h-4 w-4" />
            Go to Menu
          </Button>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onNext}>
            Skip for now
          </Button>
          <Button onClick={onNext} disabled={menuCount === 0} className="gap-2">
            Continue
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
        <h3 className="text-xl font-bold">Add your team</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Set up your staff so you can assign shifts and manage your team.
        </p>
      </div>

      <div className="rounded-lg border border-border p-5 bg-muted/20 flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <Users className="h-6 w-6 text-blue-500" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">
            {staffCount === 0
              ? "No staff members yet"
              : `${staffCount} team member${staffCount !== 1 ? "s" : ""} added`}
          </p>
          <p className="text-sm text-muted-foreground">
            {staffCount === 0
              ? "Add your chefs, servers, and managers to start scheduling shifts."
              : "Your team is set up. You can add more staff from the Staff page anytime."}
          </p>
        </div>
        {staffCount > 0 && <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />}
      </div>

      {staffCount === 0 && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-sm text-muted-foreground mb-3">
            Go to the Staff page to add your first team member, then come back here.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/staff")} className="gap-1.5">
            <Users className="h-4 w-4" />
            Go to Staff
          </Button>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onNext}>
            Skip for now
          </Button>
          <Button onClick={onNext} className="gap-2">
            {staffCount > 0 ? "Continue" : "Skip & Continue"}
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
}: {
  onNext: () => void;
  onBack: () => void;
  bookingsEnabled: boolean;
  onEnable: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">Enable online bookings</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Once enabled, customers can find and book your restaurant through the marketplace. This is required before you go live.
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
              {bookingsEnabled ? "Online bookings are enabled" : "Online bookings are disabled"}
            </p>
            <p className="text-sm text-muted-foreground">
              {bookingsEnabled
                ? "Customers can now discover and book your restaurant in the marketplace."
                : "Enable this to let customers book directly from the marketplace — no calls needed."}
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
              Enable Bookings Now
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!bookingsEnabled} className="gap-2">
          Continue
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
        <h3 className="text-xl font-bold">Attract your first customers</h3>
        <p className="text-sm text-muted-foreground mt-1">
          A launch discount is the fastest way to get your first bookings. You can skip this and create one later.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3 mb-4">
          <Zap className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-400">Why offer a launch discount?</p>
            <p className="text-sm text-muted-foreground mt-1">
              New restaurants that launch with a 15–25% opening offer typically get 3× more bookings in their first week than those that don't.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 bg-card flex items-center gap-4 mb-4">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">
              {discountCount === 0 ? "No discounts yet" : `${discountCount} discount${discountCount !== 1 ? "s" : ""} created`}
            </p>
            <p className="text-xs text-muted-foreground">
              {discountCount === 0 ? "Create a flash deal or scheduled discount from the Marketing page." : "You're ready to go. Manage your offers from Marketing anytime."}
            </p>
          </div>
          {discountCount > 0 && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
        </div>

        <Button variant="outline" size="sm" onClick={() => navigate("/marketing")} className="gap-1.5">
          <Megaphone className="h-4 w-4" />
          Go to Marketing
        </Button>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onNext}>
            Skip for now
          </Button>
          <Button onClick={onNext} className="gap-2">
            {discountCount > 0 ? "Continue" : "Skip & Continue"}
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
        <h3 className="text-2xl font-bold">You're almost live</h3>
        <p className="text-muted-foreground mt-2">
          Review your setup summary, then go live to start accepting bookings.
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
          Go Live Now
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate("/")}>
          Go to Dashboard
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
      <span className="text-xs text-muted-foreground self-center">Quick add:</span>
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);

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
      onError: () => toast({ title: "Failed to save restaurant info", variant: "destructive" }),
    },
  });

  const enableBookings = useEnableBookings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOnboardingStatusQueryKey() });
        toast({ title: "Bookings enabled", description: "Customers can now book your restaurant." });
      },
      onError: () => toast({ title: "Failed to enable bookings", variant: "destructive" }),
    },
  });

  const completeOnboarding = useCompleteOnboarding({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOnboardingStatusQueryKey() });
        toast({ title: "You're live!", description: "Your restaurant is now visible in the marketplace." });
        navigate("/");
      },
      onError: () => toast({ title: "Something went wrong", variant: "destructive" }),
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
        <h2 className="text-3xl font-bold tracking-tight">Restaurant Setup</h2>
        <p className="text-muted-foreground mt-1">
          Get your restaurant live in under 5 minutes.
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
        {step < 6 && <StepIndicator current={step} />}
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
                />
              )}
              {step === 2 && (
                <Step2
                  onNext={handleStep2Next}
                  onBack={() => advance(1)}
                  menuCount={menuCount}
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
