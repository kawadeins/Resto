import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Star, Clock, MapPin, Phone, Mail, Calendar, Users, ChevronLeft, CheckCircle2, User as UserIcon, Instagram, Facebook, Globe, ExternalLink, PlayCircle, ChevronRight, X, ShieldCheck, Store, MessageCircle, Send, Edit2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";

import { 
  useGetMarketplaceRestaurant, 
  useCreateCustomerBooking,
  useListReviews,
  useGetReviewStats,
  useCreateReview
} from "@workspace/api-client-react";
import { 
  getGetMarketplaceRestaurantQueryKey,
  getListReviewsQueryKey,
  getGetReviewStatsQueryKey
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useSeo } from "@/hooks/use-seo";
import { recordHabitEvent } from "@/lib/habit-engine";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const DAY_DE: Record<string, string> = {
  Monday: "Mo", Tuesday: "Di", Wednesday: "Mi", Thursday: "Do",
  Friday: "Fr", Saturday: "Sa", Sunday: "So",
};

const DAYS_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const CUISINE_DE: Record<string, string> = {
  Austrian:      "Österreichisch",
  Burgers:       "Burger",
  French:        "Französisch",
  Indian:        "Indisch",
  International: "International",
  Italian:       "Italienisch",
  Japanese:      "Japanisch",
  Vegetarian:    "Vegetarisch",
  Cocktails:     "Cocktails",
  "Café":        "Café",
};

function formatOpenDays(days: string[] | undefined): string {
  if (!days || days.length === 0) return "–";
  const sorted = [...days].sort((a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b));
  if (sorted.length === 7) return "Täglich";
  const ranges: string[] = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur && DAYS_ORDER.indexOf(cur) === DAYS_ORDER.indexOf(prev) + 1) {
      prev = cur;
    } else {
      ranges.push(start === prev ? DAY_DE[start] : `${DAY_DE[start]}–${DAY_DE[prev]}`);
      start = cur; prev = cur;
    }
  }
  return ranges.join(", ");
}

interface SlotInfo {
  time: string;
  status: "available" | "limited" | "nearly_full" | "full" | "closed" | "paused";
  bookedGuests: number;
  seatingCapacity: number;
  availableSeats: number;
  percentage: number;
}

interface SlotData {
  openTime: string;
  closeTime: string;
  seatingCapacity: number;
  slots: SlotInfo[];
  walkInsEnabled: boolean;
}

function slotLabel(status: string) {
  switch (status) {
    case "limited": return " · Wenige Plätze";
    case "nearly_full": return " · Fast ausgebucht";
    case "full": return " · Ausgebucht";
    default: return "";
  }
}

function slotClass(status: string) {
  switch (status) {
    case "available": return "";
    case "limited": return "text-amber-600";
    case "nearly_full": return "text-orange-500";
    case "full": return "opacity-40 line-through";
    default: return "";
  }
}

const bookingSchema = z.object({
  customerName: z.string().min(2, "Name muss mindestens 2 Zeichen haben"),
  customerEmail: z.string().email("Ungültige E-Mail-Adresse"),
  customerPhone: z.string().min(5, "Telefonnummer erforderlich"),
  date: z.string().min(1, "Datum erforderlich"),
  time: z.string().min(1, "Uhrzeit erforderlich"),
  partySize: z.coerce.number().min(1, "Mindestens 1 Person").max(20, "Maximal 20 Personen"),
  notes: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

const reviewSchema = z.object({
  customerName: z.string().min(2, "Name erforderlich"),
  customerEmail: z.string().email("Ungültige E-Mail"),
  rating: z.number().min(1).max(5),
  comment: z.string().min(5, "Kommentar muss mindestens 5 Zeichen haben")
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return match?.[1] ?? "";
}

function PhotoGallery({ photos, restaurantName }: { photos: string[]; restaurantName: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const prev = () => setLightbox((i) => (i !== null ? (i - 1 + photos.length) % photos.length : null));
  const next = () => setLightbox((i) => (i !== null ? (i + 1) % photos.length : null));

  return (
    <>
      <div className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
        <h2 className="font-serif text-3xl font-bold mb-5">Galerie</h2>
        <div className={`grid gap-3 ${photos.length === 1 ? "grid-cols-1" : photos.length === 2 ? "grid-cols-2" : photos.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
          {photos.map((photo, idx) => (
            <button
              key={idx}
              onClick={() => setLightbox(idx)}
              className={`group relative overflow-hidden rounded-xl bg-muted transition-transform hover:scale-[1.02] cursor-pointer ${idx === 0 && photos.length >= 4 ? "sm:col-span-2 sm:row-span-2" : ""}`}
              style={{ aspectRatio: idx === 0 && photos.length >= 4 ? "1/1" : "4/3" }}
            >
              <img src={photo} alt={`${restaurantName} ${idx + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="w-8 h-8" />
          </button>
          <button className="absolute left-4 text-white/80 hover:text-white p-2" onClick={(e) => { e.stopPropagation(); prev(); }}>
            <ChevronLeft className="w-8 h-8" />
          </button>
          <img
            src={photos[lightbox]}
            alt={`${restaurantName} ${lightbox + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button className="absolute right-4 text-white/80 hover:text-white p-2" onClick={(e) => { e.stopPropagation(); next(); }}>
            <ChevronRight className="w-8 h-8" />
          </button>
          <div className="absolute bottom-4 text-white/60 text-sm">
            {lightbox + 1} / {photos.length}
          </div>
        </div>
      )}
    </>
  );
}

function LiveMap({
  lat, lng, name, address, city, googleMapsUrl,
}: {
  lat: number; lng: number; name: string; address: string; city: string; googleMapsUrl?: string;
}) {
  const delta = 0.008;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  const fullLink = googleMapsUrl || `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`;

  return (
    <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-serif text-2xl font-bold leading-tight">Standort</h2>
            <p className="text-sm text-muted-foreground">{address}, {city}</p>
          </div>
        </div>
        <a
          href={fullLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ExternalLink className="w-4 h-4" />
          In Maps öffnen
        </a>
      </div>
      <div className="h-64 sm:h-80 w-full relative">
        <iframe
          src={osmUrl}
          className="w-full h-full border-0"
          title={`Karte von ${name}`}
          loading="lazy"
        />
        <div className="absolute bottom-3 right-3">
          <a
            href={fullLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-background/90 backdrop-blur-sm border rounded-lg text-xs font-semibold shadow-md hover:bg-background transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-red-500" />
            Route planen
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Restaurant() {
  const { id } = useParams<{ id: string }>();
  const restaurantId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewEligibility, setReviewEligibility] = useState<{
    loading: boolean; checked: boolean; eligible: boolean; bookingId: number | null;
  }>({ loading: false, checked: false, eligible: false, bookingId: null });
  const [recoveryDialog, setRecoveryDialog] = useState<{ open: boolean; formData: ReviewFormValues | null }>({ open: false, formData: null });
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [recoveryReview, setRecoveryReview] = useState<{ id: number; status: string; businessResponse: string | null; rating: number } | null>(null);
  const [publishEditRating, setPublishEditRating] = useState<number | null>(null);
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: restaurant, isLoading } = useGetMarketplaceRestaurant(restaurantId, {
    query: {
      enabled: !!restaurantId,
      queryKey: getGetMarketplaceRestaurantQueryKey(restaurantId)
    }
  });

  useSeo({
    title: restaurant?.name || "Restaurant",
    description: restaurant?.description || "Tisch buchen",
    image: restaurant?.heroImage || undefined,
  });

  // Record explore visit habit event once per page load
  useEffect(() => {
    if (restaurantId) recordHabitEvent("explore_visit");
  }, [restaurantId]);

  const { data: reviews } = useListReviews(
    { restaurantId },
    {
      query: {
        enabled: !!restaurantId,
        queryKey: getListReviewsQueryKey({ restaurantId })
      }
    }
  );

  const { data: reviewStats } = useGetReviewStats(
    { restaurantId },
    {
      query: {
        enabled: !!restaurantId,
        queryKey: getGetReviewStatsQueryKey({ restaurantId })
      }
    }
  );

  const createReview = useCreateReview({
    mutation: {
      onSuccess: () => {
        recordHabitEvent("review_submit");
        toast({ title: "Bewertung eingereicht!", description: "Danke für Ihr Feedback." });
        setShowReviewForm(false);
        reviewForm.reset();
        setReviewRating(5);
        queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey({ restaurantId }) });
        queryClient.invalidateQueries({ queryKey: getGetReviewStatsQueryKey({ restaurantId }) });
        queryClient.invalidateQueries({ queryKey: getGetMarketplaceRestaurantQueryKey(restaurantId) });
      },
      onError: () => {
        toast({ title: "Fehler", description: "Bewertung konnte nicht eingereicht werden.", variant: "destructive" });
      }
    }
  });

  const createBooking = useCreateCustomerBooking({
    mutation: {
      onSuccess: () => {
        setBookingSuccess(true);
        recordHabitEvent("booking_complete");
        toast({
          title: "Buchung bestätigt! 🎉",
          description: "Bestätigung per E-Mail. Treuepunkte werden nach Ihrem Besuch gutgeschrieben.",
        });
        // Record social activity (fire-and-forget — non-blocking)
        const userEmail = typeof window !== "undefined"
          ? localStorage.getItem("restosmart_email") || ""
          : "";
        if (userEmail && restaurant) {
          fetch(`${API_BASE}/api/social/activity`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userEmail,
              activityType: "booking",
              restaurantId,
              restaurantName: restaurant.name,
              restaurantEmoji: restaurant.emoji ?? "🍽️",
              visibility: "friends",
            }),
          }).catch(() => {});
        }
      },
      onError: () => {
        toast({
          title: "Buchung fehlgeschlagen",
          description: "Bei der Buchung Ihrer Reservierung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
          variant: "destructive"
        });
      }
    }
  });

  // Fetch slot availability whenever the selected date changes
  useEffect(() => {
    if (!restaurantId || !selectedDate) return;
    fetch(`${API_BASE}/api/marketplace/slots?restaurantId=${restaurantId}&date=${selectedDate}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setSlotData(data))
      .catch(() => {});
  }, [restaurantId, selectedDate]);

  // Load email from localStorage if available
  const savedEmail = typeof window !== 'undefined' ? localStorage.getItem("restosmart_email") || "" : "";

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      customerName: "",
      customerEmail: savedEmail,
      customerPhone: "",
      date: format(new Date(), "yyyy-MM-dd"),
      time: "19:00",
      partySize: 2,
      notes: "",
    }
  });

  const reviewForm = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      customerName: "",
      customerEmail: savedEmail,
      rating: 5,
      comment: ""
    }
  });

  const onReviewSubmit = (data: ReviewFormValues) => {
    const ratingToUse = reviewRating;
    if (!reviewEligibility.bookingId) {
      toast({ title: "Reservierung erforderlich", description: "Für eine Bewertung ist eine abgeschlossene Reservierung notwendig.", variant: "destructive" });
      return;
    }
    if (ratingToUse <= 3) {
      setRecoveryDialog({ open: true, formData: { ...data, rating: ratingToUse } });
      return;
    }
    createReview.mutate({ data: { ...data, rating: ratingToUse, restaurantId, bookingId: reviewEligibility.bookingId } });
  };

  const submitWithRecovery = useCallback(async (startRecovery: boolean) => {
    if (!recoveryDialog.formData) return;
    setRecoverySubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...recoveryDialog.formData, restaurantId, startRecovery, bookingId: reviewEligibility.bookingId }),
      });
      const data = await res.json();
      setRecoveryDialog({ open: false, formData: null });
      setShowReviewForm(false);
      reviewForm.reset();
      setReviewRating(5);
      queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey({ restaurantId }) });
      queryClient.invalidateQueries({ queryKey: getGetReviewStatsQueryKey({ restaurantId }) });
      queryClient.invalidateQueries({ queryKey: getGetMarketplaceRestaurantQueryKey(restaurantId) });
      if (startRecovery) {
        setRecoveryReview({ id: data.id, status: "pending", businessResponse: null, rating: data.rating });
        toast({ title: "Problem gemeldet", description: "Der Betrieb wurde benachrichtigt und wird sich melden." });
      } else {
        toast({ title: "Bewertung eingereicht!", description: "Danke f\u00FCr Ihr Feedback." });
      }
    } catch {
      toast({ title: "Fehler", description: "Bewertung konnte nicht eingereicht werden.", variant: "destructive" });
    } finally {
      setRecoverySubmitting(false);
    }
  }, [recoveryDialog.formData, restaurantId, reviewForm, queryClient, reviewEligibility.bookingId]);

  const pollRecoveryStatus = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/reviews?restaurantId=${restaurantId}`);
      const list = await res.json();
      const found = list.find((r: { id: number }) => r.id === id)
        ?? await fetch(`${API_BASE}/api/reviews/insights?restaurantId=${restaurantId}`)
            .then(r => r.json())
            .then((ins: { pendingRecovery?: Array<{ id: number; businessResponse: string | null }> }) =>
              ins.pendingRecovery?.find((r: { id: number }) => r.id === id));
      if (found) {
        setRecoveryReview(prev => prev ? { ...prev, status: found.recoveryStatus ?? prev.status, businessResponse: found.businessResponse ?? prev.businessResponse } : prev);
      }
    } catch {}
  }, [restaurantId]);

  const publishRecoveryReview = useCallback(async () => {
    if (!recoveryReview) return;
    try {
      await fetch(`${API_BASE}/api/reviews/${recoveryReview.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(publishEditRating ? { rating: publishEditRating } : {}),
      });
      setRecoveryReview(null);
      setPublishEditRating(null);
      toast({ title: "Bewertung ver\u00F6ffentlicht" });
      queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey({ restaurantId }) });
      queryClient.invalidateQueries({ queryKey: getGetReviewStatsQueryKey({ restaurantId }) });
    } catch {}
  }, [recoveryReview, publishEditRating, restaurantId, queryClient]);

  const closeRecoveryReview = useCallback(async () => {
    if (!recoveryReview) return;
    try {
      await fetch(`${API_BASE}/api/reviews/${recoveryReview.id}/close`, { method: "POST" });
    } catch {}
    setRecoveryReview(null);
    toast({ title: "Angelegenheit abgeschlossen" });
  }, [recoveryReview]);

  useEffect(() => {
    if (!recoveryReview || recoveryReview.status !== "pending") return;
    const interval = setInterval(() => pollRecoveryStatus(recoveryReview.id), 20_000);
    return () => clearInterval(interval);
  }, [recoveryReview, pollRecoveryStatus]);

  const onSubmit = (data: BookingFormValues) => {
    // Save email for convenience
    if (typeof window !== 'undefined') {
      localStorage.setItem("restosmart_email", data.customerEmail);
    }
    
    createBooking.mutate({
      data: {
        ...data,
        restaurantId
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="w-full h-[40vh] md:h-[50vh]" />
        <div className="container mx-auto px-4 max-w-6xl -mt-16 relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
          <div className="lg:col-span-2 space-y-8">
            <Skeleton className="w-full h-48 rounded-2xl" />
            <Skeleton className="w-full h-96 rounded-2xl" />
          </div>
          <div>
            <Skeleton className="w-full h-[500px] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
        <h1 className="font-serif text-4xl font-bold mb-4">Restaurant nicht gefunden</h1>
        <p className="text-muted-foreground mb-8">Dieses Restaurant wurde möglicherweise entfernt oder ist derzeit nicht verfügbar.</p>
        <Button asChild>
          <Link href="/explore">Alle Restaurants durchsuchen</Link>
        </Button>
      </div>
    );
  }

  // Group menu items by category
  const menuByCategory = restaurant.menu?.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof restaurant.menu>) || {};

  const categories = Object.keys(menuByCategory);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Image */}
      <div className="relative w-full h-[40vh] md:h-[50vh] bg-muted">
        {restaurant.heroImage ? (
          <img 
            src={restaurant.heroImage} 
            alt={restaurant.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary text-secondary-foreground font-serif text-6xl opacity-50">
            {restaurant.name.charAt(0)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
        
        <Link href="/explore" className="absolute top-6 left-6 inline-flex items-center justify-center w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-background transition-colors shadow-sm">
          <ChevronLeft className="w-5 h-5" />
        </Link>
      </div>

      <div className="container mx-auto px-4 max-w-6xl -mt-24 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
        
        {/* Main Content */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-8">
          
          {/* Header Card */}
          <div className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-2xl">{restaurant.cuisineEmoji}</span>
                  <Badge variant="secondary" className="font-medium text-sm">
                    {CUISINE_DE[restaurant.cuisine] ?? restaurant.cuisine}
                  </Badge>
                  <span className="text-muted-foreground font-medium">{"€".repeat(restaurant.priceRange || 2)}</span>
                  {restaurant.isOpenNow && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">Jetzt geöffnet</Badge>
                  )}
                  {/* Verified operator badge — only for registered platform partners */}
                  {restaurant.isPartner && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/8 border border-primary/25 px-2.5 py-1 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Geprüfter Betreiber
                    </span>
                  )}
                </div>
                <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight text-foreground mb-2">
                  {restaurant.name}
                </h1>
                
                {/* Flash Deal Alert */}
                {restaurant.hasActiveFlash && (
                  <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive font-semibold px-3 py-1.5 rounded-lg mt-2 border border-destructive/20">
                    <Star className="w-4 h-4 fill-current" />
                    {restaurant.flashPercentage}% RABATT heute
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-xl shrink-0 self-start sm:self-auto border border-amber-100">
                <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                <div>
                  <div className="font-bold text-xl leading-none text-amber-950">{restaurant.rating.toFixed(1)}</div>
                  <div className="text-xs font-medium text-amber-800">{restaurant.reviewCount} Bewertungen</div>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground text-lg leading-relaxed mb-6">
              {restaurant.description}
            </p>

            <div className="grid sm:grid-cols-2 gap-4 text-sm text-card-foreground">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Adresse</div>
                  <div className="text-muted-foreground">{restaurant.address}</div>
                  <div className="text-muted-foreground">{restaurant.city}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Öffnungszeiten</div>
                  <div className="text-muted-foreground">
                    {formatOpenDays(restaurant.openDays)}
                  </div>
                  <div className="text-muted-foreground">
                    {restaurant.openTime} – {restaurant.closeTime}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Kontakt</div>
                  <div className="text-muted-foreground">{restaurant.phone}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">E-Mail</div>
                  <div className="text-muted-foreground">{restaurant.email}</div>
                </div>
              </div>
            </div>
            
            {restaurant.tags && restaurant.tags.length > 0 && (
              <div className="mt-6 pt-6 border-t flex flex-wrap gap-2">
                {restaurant.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="bg-secondary/50">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Social & Official Links */}
            {(restaurant.instagram || restaurant.facebook || restaurant.tiktok || restaurant.website || restaurant.googleMapsUrl) && (
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
                {restaurant.instagram && (
                  <a href={restaurant.instagram} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm">
                    <Instagram className="w-3.5 h-3.5" />
                    Instagram
                  </a>
                )}
                {restaurant.facebook && (
                  <a href={restaurant.facebook} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm">
                    <Facebook className="w-3.5 h-3.5" />
                    Facebook
                  </a>
                )}
                {restaurant.tiktok && (
                  <a href={restaurant.tiktok} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground text-background text-xs font-semibold hover:opacity-80 transition-opacity shadow-sm">
                    <span className="font-black text-[10px]">TT</span>
                    TikTok
                  </a>
                )}
                {restaurant.website && (
                  <a href={restaurant.website} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm">
                    <Globe className="w-3.5 h-3.5" />
                    Website
                  </a>
                )}
                {restaurant.googleMapsUrl && (
                  <a href={restaurant.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm">
                    <MapPin className="w-3.5 h-3.5" />
                    Google Maps
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Photo Gallery */}
          {restaurant.photos && restaurant.photos.length > 0 && (
            <PhotoGallery photos={restaurant.photos} restaurantName={restaurant.name} />
          )}

          {/* Presentation Video */}
          {restaurant.videoUrl && (
            <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 pt-6 pb-3 flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-primary" />
                <h2 className="font-serif text-2xl font-bold">Unser Restaurant</h2>
              </div>
              <div className="aspect-video w-full bg-muted">
                {restaurant.videoUrl.includes("youtube.com") || restaurant.videoUrl.includes("youtu.be") ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYouTubeId(restaurant.videoUrl)}`}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : restaurant.videoUrl.includes("vimeo.com") ? (
                  <iframe
                    src={`https://player.vimeo.com/video/${restaurant.videoUrl.split("/").pop()}`}
                    className="w-full h-full"
                    allowFullScreen
                  />
                ) : (
                  <video src={restaurant.videoUrl} controls className="w-full h-full object-cover" />
                )}
              </div>
            </div>
          )}

          {/* About / Story */}
          {restaurant.about && (
            <div className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
              <h2 className="font-serif text-3xl font-bold mb-4">Unsere Geschichte</h2>
              <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-line">{restaurant.about}</p>
            </div>
          )}

          {/* Menu */}
          <div className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="font-serif text-3xl font-bold mb-6">Speisekarte</h2>
            
            {categories.length > 0 ? (
              <Tabs defaultValue={categories[0]}>
                <TabsList className="w-full justify-start overflow-x-auto bg-transparent border-b rounded-none h-auto p-0 space-x-6 mb-6">
                  {categories.map(category => (
                    <TabsTrigger 
                      key={category} 
                      value={category}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 text-base"
                    >
                      {category}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {categories.map(category => (
                  <TabsContent key={category} value={category} className="space-y-6 outline-none">
                    {menuByCategory[category].map((item, i) => (
                      <div key={item.id} className="flex justify-between gap-4 group">
                        <div className="flex-1">
                          <h4 className="font-bold text-lg group-hover:text-primary transition-colors">{item.name}</h4>
                          <p className="text-muted-foreground text-sm leading-relaxed mt-1">{item.description}</p>
                        </div>
                        <div className="font-serif font-bold text-lg">
                          €{item.price.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Speisekarte derzeit nicht online verfügbar.
              </div>
            )}
          </div>

          {/* Reviews Section */}
          <div className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm space-y-8">
            <h2 className="font-serif text-3xl font-bold">Bewertungen</h2>
            
            {reviewStats && reviewStats.totalCount > 0 ? (
              <div className="flex flex-col md:flex-row gap-8 items-center border-b pb-8">
                <div className="text-center md:w-1/3 shrink-0">
                  <div className="text-6xl font-serif font-bold text-amber-950 mb-2">
                    {reviewStats.averageRating?.toFixed(1) || "5.0"}
                  </div>
                  <div className="flex justify-center text-amber-400 mb-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-5 h-5 ${i < Math.round(reviewStats.averageRating || 5) ? 'fill-current text-amber-400' : 'text-muted'}`} />
                    ))}
                  </div>
                  <div className="text-muted-foreground font-medium">
                    {reviewStats.totalCount} Bewertungen
                  </div>
                </div>
                
                <div className="flex-1 w-full space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = ((reviewStats.distribution as any)?.[star]) || 0;
                    const percent = reviewStats.totalCount > 0 ? (count / reviewStats.totalCount) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-3 text-sm">
                        <div className="w-12 flex items-center justify-end gap-1 font-medium text-muted-foreground">
                          {star} <Star className="w-3 h-3 fill-current text-amber-400" />
                        </div>
                        <Progress value={percent} className="h-2 flex-1" />
                        <div className="w-8 text-right text-muted-foreground">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground border-b border-dashed">
                Noch keine Bewertungen. Seien Sie der Erste!
              </div>
            )}

            {/* Review List */}
            <div className="space-y-6">
              {reviews?.map((review) => (
                <div key={review.id} className="pb-6 border-b last:border-0 last:pb-0">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {review.customerName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-bold">{review.customerName}</div>
                        <div className="text-xs text-muted-foreground">{format(parseISO(review.createdAt), "d. MMM yyyy", { locale: de })}</div>
                      </div>
                    </div>
                    <div className="flex text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-muted'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-card-foreground leading-relaxed">
                    {review.comment}
                  </p>
                  
                  {review.ownerReply && (
                    <div className="mt-4 bg-muted/50 border rounded-xl p-4 ml-4 md:ml-12">
                      <div className="flex items-center gap-2 mb-2 text-sm font-bold">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Antwort des Inhabers</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {review.ownerReply}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Recovery status panel — shown after customer chose "Problem klären" */}
            {recoveryReview && (
              <div className={`pt-4 border-t border-dashed`}>
                <div className={`rounded-2xl p-5 border ${recoveryReview.status === "resolved" ? "border-emerald-400/40 bg-emerald-50/60 dark:bg-emerald-950/20" : "border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    {recoveryReview.status === "resolved" ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                    <span className="font-semibold text-sm">
                      {recoveryReview.status === "resolved" ? "Der Betrieb hat geantwortet" : "In Kl\u00E4rung"}
                    </span>
                    {recoveryReview.status === "pending" && (
                      <span className="ml-auto text-xs text-muted-foreground animate-pulse">Wartet auf Antwort\u2026</span>
                    )}
                  </div>

                  {recoveryReview.businessResponse && (
                    <div className="bg-white/70 dark:bg-gray-900/40 rounded-xl p-4 mb-4 border border-border/30">
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">Antwort des Betriebs:</p>
                      <p className="text-sm leading-relaxed">{recoveryReview.businessResponse}</p>
                    </div>
                  )}

                  {recoveryReview.status === "resolved" && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">M\u00F6chtest du deine Bewertung jetzt ver\u00F6ffentlichen?</p>
                      {/* Optional rating adjustment */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-1">Neue Bewertung:</span>
                        {[1,2,3,4,5].map(s => (
                          <button key={s} type="button" onClick={() => setPublishEditRating(s)} className="p-0.5 hover:scale-110 transition-transform">
                            <Star className={`w-5 h-5 ${s <= (publishEditRating ?? recoveryReview.rating) ? "fill-amber-400 text-amber-400" : "text-muted stroke-muted-foreground"}`} />
                          </button>
                        ))}
                        {publishEditRating && publishEditRating !== recoveryReview.rating && (
                          <span className="text-xs ml-1 text-emerald-600 font-medium">ge\u00E4ndert</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="gap-1.5 rounded-full flex-1" onClick={publishRecoveryReview}>
                          <Send className="w-3.5 h-3.5" />
                          Bewertung ver\u00F6ffentlichen
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 rounded-full" onClick={closeRecoveryReview}>
                          <XCircle className="w-3.5 h-3.5" />
                          Schlie\u00DFen
                        </Button>
                      </div>
                    </div>
                  )}

                  {recoveryReview.status === "pending" && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="gap-1.5 rounded-full text-xs" onClick={() => publishRecoveryReview()}>
                        <Send className="w-3 h-3" />
                        Trotzdem ver\u00F6ffentlichen
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1.5 rounded-full text-xs text-muted-foreground" onClick={closeRecoveryReview}>
                        <XCircle className="w-3 h-3" />
                        Abbrechen
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recovery choice dialog (overlay) */}
            {recoveryDialog.open && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => {}}>
                <div className="bg-background rounded-2xl shadow-2xl max-w-md w-full p-6 border">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight">M\u00F6chtest du dein Problem zuerst mit dem Betrieb kl\u00E4ren?</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Der Betrieb hat die M\u00F6glichkeit, dein Anliegen direkt zu l\u00F6sen, bevor deine Bewertung ver\u00F6ffentlicht wird.
                      </p>
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3 mb-5 border border-border/40">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-4 h-4 ${s <= (recoveryDialog.formData?.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
                      ))}
                    </div>
                    <p className="text-sm italic text-muted-foreground line-clamp-2">{`"${recoveryDialog.formData?.comment ?? ""}"`}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full h-11 rounded-full gap-2"
                      onClick={() => submitWithRecovery(true)}
                      disabled={recoverySubmitting}
                    >
                      <MessageCircle className="w-4 h-4" />
                      Problem kl\u00E4ren
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-11 rounded-full text-muted-foreground"
                      onClick={() => submitWithRecovery(false)}
                      disabled={recoverySubmitting}
                    >
                      Trotzdem ver\u00F6ffentlichen
                    </Button>
                    <button
                      className="text-xs text-muted-foreground mt-1 hover:underline"
                      onClick={() => setRecoveryDialog({ open: false, formData: null })}
                      disabled={recoverySubmitting}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Write a Review Form */}
            <div className="pt-4 border-t border-dashed">
              {!showReviewForm ? (
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-full font-medium"
                  disabled={reviewEligibility.loading}
                  onClick={async () => {
                    const customerEmail = savedEmail;
                    if (!customerEmail) {
                      toast({ title: "Anmeldung erforderlich", description: "Bitte melde dich an, um eine Bewertung zu schreiben.", variant: "destructive" });
                      return;
                    }
                    setReviewEligibility({ loading: true, checked: false, eligible: false, bookingId: null });
                    try {
                      const res = await fetch(
                        `${API_BASE}/api/reviews/eligibility?restaurantId=${restaurantId}&customerEmail=${encodeURIComponent(customerEmail)}`,
                        { credentials: "include" }
                      );
                      const data = await res.json();
                      const firstBooking = data.bookings?.[0];
                      setReviewEligibility({
                        loading: false,
                        checked: true,
                        eligible: data.eligible === true,
                        bookingId: firstBooking?.id ?? null,
                      });
                      if (data.eligible) {
                        setShowReviewForm(true);
                      }
                    } catch {
                      setReviewEligibility({ loading: false, checked: true, eligible: false, bookingId: null });
                    }
                  }}
                >
                  {reviewEligibility.loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Bewertung schreiben
                </Button>
              ) : null}
              {reviewEligibility.checked && !reviewEligibility.eligible && !showReviewForm && (
                <div className="mt-3 rounded-xl bg-muted/60 border border-border px-4 py-3 text-sm text-muted-foreground text-center">
                  {"Für eine Bewertung ist eine abgeschlossene Reservierung in diesem Restaurant erforderlich."}
                </div>
              )}
              {showReviewForm && (
                <div className="bg-muted/30 p-6 rounded-2xl border">
                  <h3 className="font-serif text-xl font-bold mb-4">Teilen Sie Ihre Erfahrung</h3>
                  <form onSubmit={reviewForm.handleSubmit(onReviewSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Bewertung</Label>
                      <div className="flex gap-1 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <button
                            type="button"
                            key={i}
                            onClick={() => {
                              setReviewRating(i + 1);
                              reviewForm.setValue("rating", i + 1);
                            }}
                            className="p-1 hover:scale-110 transition-transform"
                          >
                            <Star className={`w-8 h-8 ${i < reviewRating ? 'fill-current' : 'text-muted stroke-muted-foreground'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="review-name">Name</Label>
                        <Input id="review-name" placeholder="Max M." {...reviewForm.register("customerName")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="review-email">E-Mail</Label>
                        <Input id="review-email" type="email" placeholder="max@beispiel.de" {...reviewForm.register("customerEmail")} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="review-comment">Kommentar</Label>
                      <Textarea 
                        id="review-comment" 
                        placeholder="Wie war das Essen und der Service?" 
                        className="min-h-[100px] resize-none"
                        {...reviewForm.register("comment")} 
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button type="submit" disabled={createReview.isPending} className="flex-1 rounded-full">
                        {createReview.isPending ? "Wird eingereicht..." : "Bewertung einreichen"}
                      </Button>
                      <Button type="button" variant="outline" className="rounded-full" onClick={() => setShowReviewForm(false)}>
                        Abbrechen
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Live Map */}
          {(restaurant.lat && restaurant.lng) && (
            <LiveMap
              lat={restaurant.lat}
              lng={restaurant.lng}
              name={restaurant.name}
              address={restaurant.address}
              city={restaurant.city}
              googleMapsUrl={restaurant.googleMapsUrl}
            />
          )}

        </div>

        {/* Sidebar / Booking Form */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="sticky top-24">
            <div className="bg-card border rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-primary/10 p-6 text-center border-b border-primary/10">
                <h3 className="font-serif text-2xl font-bold text-foreground">Tisch reservieren</h3>
                {restaurant.availabilityStatus && restaurant.isOpenNow && (
                  <div className="mt-3">
                    {restaurant.availabilityStatus === "available" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700 border border-emerald-300/40 px-3 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Tische jetzt verfügbar
                      </span>
                    )}
                    {restaurant.availabilityStatus === "limited" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-400/15 text-amber-700 border border-amber-300/40 px-3 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Wenige Plätze — bald buchen
                      </span>
                    )}
                    {restaurant.availabilityStatus === "nearly_full" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-orange-400/15 text-orange-700 border border-orange-300/40 px-3 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        Fast ausgebucht — Tisch sichern
                      </span>
                    )}
                    {restaurant.availabilityStatus === "full" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-400/15 text-red-700 border border-red-300/40 px-3 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {restaurant.nextAvailableSlot ? `Ausgebucht · nächster Slot: ${restaurant.nextAvailableSlot}` : "Momentan ausgebucht"}
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="p-6">
                {bookingSuccess ? (
                  <div className="text-center py-6 space-y-4">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-serif text-2xl font-bold mb-1">Tisch bestätigt!</h3>
                      <p className="text-muted-foreground text-sm">
                        Reservierung bei {restaurant.name} ist gespeichert. Details wurden per E-Mail gesendet.
                      </p>
                    </div>
                    {/* Reward hint */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                      <span className="text-2xl">⭐</span>
                      <div className="text-left">
                        <p className="text-sm font-bold text-amber-800">Treuepunkte warten auf Sie</p>
                        <p className="text-xs text-amber-700">Punkte werden nach Ihrem Besuch gutgeschrieben.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild size="sm" className="flex-1 rounded-full bg-gradient-to-r from-primary to-accent text-white border-0">
                        <Link href="/my-bookings">Meine Buchungen</Link>
                      </Button>
                      <Button onClick={() => setBookingSuccess(false)} variant="outline" size="sm" className="flex-1 rounded-full">
                        Nochmal buchen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="date">Datum</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input 
                            id="date"
                            type="date" 
                            className="pl-9"
                            min={format(new Date(), "yyyy-MM-dd")}
                            {...form.register("date")}
                            onChange={(e) => {
                              form.setValue("date", e.target.value);
                              setSelectedDate(e.target.value);
                            }}
                          />
                        </div>
                        {form.formState.errors.date && (
                          <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="time">Uhrzeit</Label>
                        <Select 
                          onValueChange={(val) => form.setValue("time", val)} 
                          defaultValue={form.getValues("time")}
                        >
                          <SelectTrigger className="w-full">
                            <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Uhrzeit wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {slotData ? (
                              slotData.slots.map((slot) => (
                                <SelectItem
                                  key={slot.time}
                                  value={slot.time}
                                  disabled={slot.status === "full"}
                                  className={slotClass(slot.status)}
                                >
                                  {slot.time}{slotLabel(slot.status)}
                                </SelectItem>
                              ))
                            ) : (
                              Array.from({ length: 22 }, (_, i) => {
                                const hour = Math.floor(i / 2) + 12;
                                const minute = i % 2 === 0 ? "00" : "30";
                                return `${String(hour).padStart(2, "0")}:${minute}`;
                              }).map((time) => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.time && (
                          <p className="text-xs text-destructive">{form.formState.errors.time.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="partySize">Personenzahl</Label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          id="partySize"
                          type="number" 
                          min="1" 
                          max="20"
                          className="pl-9"
                          {...form.register("partySize")} 
                        />
                      </div>
                      {form.formState.errors.partySize && (
                        <p className="text-xs text-destructive">{form.formState.errors.partySize.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customerName">Vollständiger Name</Label>
                      <Input 
                        id="customerName"
                        placeholder="Max Mustermann"
                        {...form.register("customerName")} 
                      />
                      {form.formState.errors.customerName && (
                        <p className="text-xs text-destructive">{form.formState.errors.customerName.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customerEmail">E-Mail</Label>
                      <Input 
                        id="customerEmail"
                        type="email"
                        placeholder="max@beispiel.de"
                        {...form.register("customerEmail")} 
                      />
                      {form.formState.errors.customerEmail && (
                        <p className="text-xs text-destructive">{form.formState.errors.customerEmail.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Telefonnummer</Label>
                      <Input 
                        id="customerPhone"
                        type="tel"
                        placeholder="+49 170 1234567"
                        {...form.register("customerPhone")} 
                      />
                      {form.formState.errors.customerPhone && (
                        <p className="text-xs text-destructive">{form.formState.errors.customerPhone.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Besondere Wünsche (Optional)</Label>
                      <Textarea 
                        id="notes"
                        placeholder="Jubiläum, Allergien, Kinderstuhl..."
                        className="resize-none h-20"
                        {...form.register("notes")} 
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full rounded-full h-12 text-lg font-medium shadow-md mt-4"
                      disabled={createBooking.isPending}
                    >
                      {createBooking.isPending ? "Wird bestätigt..." : "Reservierung bestätigen"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground mt-4">
                      Mit dem Fortfahren stimmen Sie unseren Nutzungsbedingungen und Datenschutzrichtlinien zu.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Claim Listing Banner (non-partner restaurants only) ── */}
      {restaurant && !restaurant.isPartner && (
        <div className="border-t border-border/50 bg-gradient-to-br from-primary/4 to-transparent">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                <Store className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-primary/70">Betreiber?</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">Gehört Ihnen <span className="text-primary">{restaurant.name}</span>?</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Verwalten Sie Ihre Seite, antworten Sie auf Buchungen, und erreichen Sie tausende Wiener Lokalgänger direkt über RestoSmart.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a
                href={`mailto:hello@restosmart.at?subject=Anmeldung für ${restaurant.name}&body=Hallo%20RestoSmart-Team%2C%0A%0AIch%20bin%20der%20Betreiber%20von%20${encodeURIComponent(restaurant.name)}%20und%20möchte%20mein%20Lokal%20auf%20RestoSmart%20beanspruchen.%0A%0AMit%20freundlichen%20Grüßen`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors shadow-md"
              >
                <Store className="w-4 h-4" />
                Listing beanspruchen
              </a>
              <a
                href="tel:+4317201234"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-border hover:bg-accent/50 font-semibold text-sm transition-colors text-foreground"
              >
                <Phone className="w-4 h-4" />
                +43 1 720 1234
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
