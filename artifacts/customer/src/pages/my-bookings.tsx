import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { format, isPast, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarCheck, Mail, Clock, Users, Star, ShieldCheck, Trophy } from "lucide-react";
import { useListMyBookings, useGetLoyaltyBalance } from "@workspace/api-client-react";
import { getListMyBookingsQueryKey, getGetLoyaltyBalanceQueryKey } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useSeo } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export default function MyBookings() {
  const { t } = useTranslation();

  useSeo({
    title: t("booking.my_title"),
    description: t("booking.title"),
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [emailInput, setEmailInput] = useState("");
  const [activeEmail, setActiveEmail] = useState<string>("");
  const [reviewingBookingId, setReviewingBookingId] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittedReviewIds, setSubmittedReviewIds] = useState<Set<number>>(new Set());
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("restosmart_email");
      if (saved) {
        setActiveEmail(saved);
        setEmailInput(saved);
      }
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    setActiveEmail(emailInput);
    if (typeof window !== 'undefined') {
      localStorage.setItem("restosmart_email", emailInput);
    }
  };

  const handleLogout = () => {
    setActiveEmail("");
    setEmailInput("");
    if (typeof window !== 'undefined') {
      localStorage.removeItem("restosmart_email");
      window.dispatchEvent(new StorageEvent("storage", { key: "restosmart_email", newValue: null }));
    }
  };

  const { data: bookings, isLoading } = useListMyBookings(
    { email: activeEmail },
    {
      query: {
        enabled: !!activeEmail,
        queryKey: getListMyBookingsQueryKey({ email: activeEmail })
      }
    }
  );

  const submitReviewMutation = useMutation({
    mutationFn: (data: { bookingId: number; restaurantId: number }) =>
      fetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          restaurantId: data.restaurantId,
          customerName: activeEmail.split("@")[0] || "Gast",
          customerEmail: activeEmail,
          bookingId: data.bookingId,
          rating: reviewRating,
          comment: reviewComment,
        }),
      }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: (_, vars) => {
      toast({ title: t("booking.review_success_toast") });
      setSubmittedReviewIds(prev => new Set(prev).add(vars.bookingId));
      setReviewingBookingId(null);
      setReviewComment("");
      setReviewRating(5);
    },
    onError: () => toast({ title: t("booking.review_error_toast"), variant: "destructive" }),
  });

  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: number) =>
      fetch(`${API_BASE}/api/marketplace/bookings/${bookingId}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: activeEmail }),
      }).then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error ?? t("booking.cancel_error"));
        }
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: t("booking.cancel_success_toast") });
      setCancelConfirmId(null);
      queryClient.invalidateQueries({ queryKey: getListMyBookingsQueryKey({ email: activeEmail }) });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
      setCancelConfirmId(null);
    },
  });

  const { data: loyaltyBalance } = useGetLoyaltyBalance(
    activeEmail,
    {
      query: {
        enabled: !!activeEmail,
        queryKey: getGetLoyaltyBalanceQueryKey(activeEmail)
      }
    }
  );

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
      case "seated":
      case "completed":
        return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">{t("booking.status_confirmed")}</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">{t("booking.status_pending")}</Badge>;
      case "rejected":
      case "cancelled":
        return <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">{t("booking.status_cancelled")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRatingLabel = (rating: number) => {
    if (rating === 5) return "Ausgezeichnet";
    if (rating === 4) return "Gut";
    if (rating === 3) return "Mittel";
    if (rating === 2) return "Schlecht";
    return "Sehr schlecht";
  };

  if (!activeEmail) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-muted/30 px-4">
        <div className="max-w-md w-full bg-card p-8 rounded-2xl shadow-xl border">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CalendarCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-center mb-2">{t("booking.my_title")}</h1>
          <p className="text-center text-muted-foreground mb-8">
            {t("booking.email_hint")}
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="ihre@email.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 rounded-full font-bold bg-gradient-to-r from-primary to-accent text-white border-0 hover:opacity-90 transition-opacity shadow-md">
              <CalendarCheck className="w-4 h-4 mr-2" />
              {t("booking.find_cta")}
            </Button>
            <div className="flex items-center justify-center gap-3 pt-1">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                {t("booking.no_registration")}
              </span>
              <span className="text-muted-foreground/40 text-[11px]">·</span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                {t("booking.your_only")}
              </span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const upcoming = bookings?.filter(b => {
    try {
      const bookingDate = new Date(`${b.date}T${b.time}`);
      return !isPast(bookingDate) && b.status !== "cancelled" && b.status !== "rejected";
    } catch {
      return true;
    }
  }) || [];

  const past = bookings?.filter(b => {
    try {
      const bookingDate = new Date(`${b.date}T${b.time}`);
      return isPast(bookingDate) || b.status === "cancelled" || b.status === "rejected";
    } catch {
      return false;
    }
  }) || [];

  return (
    <div className="container mx-auto px-4 max-w-4xl py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="font-serif text-4xl font-bold mb-2">{t("booking.my_title")}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            {t("booking.logged_in_as")} <span className="font-medium text-foreground">{activeEmail}</span>
            <button onClick={handleLogout} className="text-xs text-primary hover:underline ml-2">
              {t("booking.change")}
            </button>
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/explore">{t("booking.book_another")}</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-[200px] w-full rounded-2xl" />
          <Skeleton className="h-[200px] w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-8">

          {loyaltyBalance && (
            <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10 pointer-events-none ${
                loyaltyBalance.tier.toLowerCase() === 'gold' ? 'bg-yellow-500' :
                loyaltyBalance.tier.toLowerCase() === 'silver' ? 'bg-slate-400' : 'bg-amber-700'
              }`} />

              <div className={`w-20 h-20 rounded-full flex items-center justify-center shrink-0 border-4 shadow-inner ${
                loyaltyBalance.tier.toLowerCase() === 'gold' ? 'bg-yellow-100 border-yellow-300 text-yellow-600' :
                loyaltyBalance.tier.toLowerCase() === 'silver' ? 'bg-slate-100 border-slate-300 text-slate-600' :
                'bg-amber-100 border-amber-200 text-amber-700'
              }`}>
                <Trophy className="w-8 h-8" />
              </div>

              <div className="flex-1 text-center md:text-left z-10">
                <div className="flex flex-col md:flex-row md:items-end gap-2 mb-1 justify-center md:justify-start">
                  <h2 className="font-serif text-3xl font-bold">{loyaltyBalance.points} {t("booking.points")}</h2>
                  <Badge variant="outline" className={`font-bold mb-1 border-2 ${
                    loyaltyBalance.tier.toLowerCase() === 'gold' ? 'border-yellow-400 text-yellow-600 bg-yellow-50' :
                    loyaltyBalance.tier.toLowerCase() === 'silver' ? 'border-slate-400 text-slate-600 bg-slate-50' :
                    'border-amber-400 text-amber-700 bg-amber-50'
                  }`}>
                    {loyaltyBalance.tier === "gold" ? "GOLD" : loyaltyBalance.tier === "silver" ? "SILBER" : "BRONZE"} RANG
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">{t("booking.total_earned", { count: loyaltyBalance.totalEarned })}</p>

                <div className="mt-4 max-w-md mx-auto md:mx-0">
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span>{t("booking.current_tier")}</span>
                    <span>{t("booking.next_tier")}</span>
                  </div>
                  <Progress
                    value={loyaltyBalance.tier.toLowerCase() === 'gold' ? 100 :
                          loyaltyBalance.tier.toLowerCase() === 'silver' ? (loyaltyBalance.points / 500) * 100 :
                          (loyaltyBalance.points / 200) * 100}
                    className="h-2 bg-muted"
                  />
                  <div className="text-xs text-muted-foreground mt-2">
                    {loyaltyBalance.tier.toLowerCase() === 'gold' ? t("booking.max_tier") :
                     loyaltyBalance.tier.toLowerCase() === 'silver' ? t("booking.points_to_gold", { count: Math.max(0, 500 - loyaltyBalance.points) }) :
                     t("booking.points_to_silver", { count: Math.max(0, 200 - loyaltyBalance.points) })}
                  </div>
                </div>
              </div>

              <div className="md:border-l md:pl-6 text-sm text-muted-foreground flex flex-col gap-2 shrink-0 md:w-48 z-10">
                <div className="font-bold text-foreground">{t("booking.how_to_earn")}</div>
                <div className="flex items-start gap-2">
                  <CalendarCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{t("booking.earn_per_visit")}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{t("booking.earn_per_review")}</span>
                </div>
              </div>
            </div>
          )}

          {bookings && bookings.length > 0 ? (
            <div className="space-y-12">

              {upcoming.length > 0 && (
                <section>
                  <h2 className="font-serif text-2xl font-bold mb-6 flex items-center gap-2">
                    {t("booking.upcoming_long")}
                    <Badge variant="secondary" className="rounded-full">{upcoming.length}</Badge>
                  </h2>
                  <div className="space-y-4">
                    {upcoming.map(booking => (
                      <div key={booking.id} className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-2 h-full bg-primary" />

                        <div className="md:w-32 shrink-0 flex flex-col items-center justify-center bg-muted/50 rounded-xl p-4 text-center">
                          <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                            {format(parseISO(booking.date), "MMM", { locale: de })}
                          </div>
                          <div className="font-serif text-4xl font-bold text-primary my-1">
                            {format(parseISO(booking.date), "d")}
                          </div>
                          <div className="text-sm font-medium">
                            {format(parseISO(booking.date), "EEEE", { locale: de })}
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-center">
                          <div className="flex items-start justify-between mb-2">
                            <Link href={`/restaurant/${booking.restaurant?.id}`} className="font-serif text-2xl font-bold hover:text-primary transition-colors">
                              {booking.restaurant?.name || "Restaurant"}
                            </Link>
                            {getStatusBadge(booking.status)}
                          </div>

                          <div className="text-sm text-muted-foreground mb-4">
                            {booking.restaurant?.cuisine && (
                              <span>{booking.restaurant.cuisine}</span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-primary" />
                              <span className="font-medium">{booking.time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-primary" />
                              <span className="font-medium">{t("booking.persons", { count: booking.partySize })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                              <CalendarCheck className="w-4 h-4" />
                              <span>{t("booking.booked_for", { name: booking.customerName })}</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-center gap-2 md:border-l md:pl-6">
                          <Button asChild variant="ghost" className="w-full md:w-auto rounded-full hover:bg-primary hover:text-white transition-colors">
                            <Link href={`/restaurant/${booking.restaurant?.id}`}>
                              {t("booking.view_restaurant")}
                            </Link>
                          </Button>
                          {cancelConfirmId === booking.id ? (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">{t("booking.confirm_cancel_short")}</span>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="rounded-full h-7 px-3 text-xs"
                                disabled={cancelBookingMutation.isPending}
                                onClick={() => cancelBookingMutation.mutate(booking.id)}
                              >
                                {cancelBookingMutation.isPending ? "..." : t("common.yes")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full h-7 px-3 text-xs"
                                onClick={() => setCancelConfirmId(null)}
                              >
                                {t("common.no")}
                              </Button>
                            </div>
                          ) : (
                            <button
                              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() => setCancelConfirmId(booking.id)}
                            >
                              {t("booking.cancel_cta")}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {past.length > 0 && (
                <section>
                  <h2 className="font-serif text-2xl font-bold mb-6 text-muted-foreground">{t("booking.past_long")}</h2>
                  <div className="space-y-3">
                    {past.map(booking => {
                      const isCompleted = booking.status === "completed" || booking.status === "seated" || booking.status === "confirmed";
                      const hasReviewed = submittedReviewIds.has(booking.id);
                      const isReviewing = reviewingBookingId === booking.id;

                      return (
                        <div key={booking.id} className="bg-card border rounded-xl overflow-hidden">
                          <div className="p-5 flex gap-4">
                            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                              {booking.restaurant?.heroImage ? (
                                <img src={booking.restaurant.heroImage} alt="" className="w-full h-full object-cover grayscale" />
                              ) : (
                                <CalendarCheck className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-bold line-clamp-1">{booking.restaurant?.name}</h4>
                                {getStatusBadge(booking.status)}
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {format(parseISO(booking.date), "dd.MM.yyyy")} · {booking.time} · {t("booking.persons", { count: booking.partySize })}
                              </p>
                            </div>

                            {isCompleted && !hasReviewed && !isReviewing && booking.status !== "cancelled" && booking.status !== "rejected" && (
                              <button
                                onClick={() => { setReviewingBookingId(booking.id); setReviewRating(5); setReviewComment(""); }}
                                className="shrink-0 flex flex-col items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
                              >
                                <span className="flex items-center gap-1">
                                  <Star className="w-3.5 h-3.5" />
                                  {t("booking.add_review")}
                                </span>
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">+5 Pkt.</span>
                              </button>
                            )}
                            {hasReviewed && (
                              <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-emerald-600">
                                <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                                {t("restaurant.review_success")}
                              </span>
                            )}
                          </div>

                          {isReviewing && (
                            <div className="px-5 pb-5 border-t border-border/50 pt-4 space-y-3 bg-muted/30">
                              <div className="text-sm font-semibold">
                                {t("booking.review_experience", { name: booking.restaurant?.name })}
                              </div>

                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <button
                                    key={star}
                                    onClick={() => setReviewRating(star)}
                                    className="transition-transform hover:scale-110"
                                  >
                                    <Star className={`w-7 h-7 ${star <= reviewRating ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
                                  </button>
                                ))}
                                <span className="ml-2 text-sm text-muted-foreground self-center">
                                  {getRatingLabel(reviewRating)}
                                </span>
                              </div>

                              <Textarea
                                placeholder={t("booking.review_describe")}
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                className="min-h-[80px] text-sm"
                                autoFocus
                              />

                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setReviewingBookingId(null)}
                                >
                                  {t("common.cancel")}
                                </Button>
                                <Button
                                  size="sm"
                                  className="rounded-full bg-gradient-to-r from-primary to-accent text-white border-0"
                                  disabled={submitReviewMutation.isPending}
                                  onClick={() => submitReviewMutation.mutate({ bookingId: booking.id, restaurantId: booking.restaurantId })}
                                >
                                  {submitReviewMutation.isPending ? t("common.loading") : t("restaurant.review_submit")}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <CalendarCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{t("booking.no_upcoming")}</p>
              <Button asChild className="mt-4 rounded-full" variant="outline">
                <Link href="/explore">{t("booking.book_another")}</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
