import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, SlidersHorizontal, Star, Navigation, Loader2, X, List, Map } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RestaurantCard } from "@/components/restaurant-card";
import { useListMarketplaceRestaurants } from "@workspace/api-client-react";
import { getListMarketplaceRestaurantsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/hooks/use-seo";
import { useGeolocation } from "@/hooks/use-geolocation";
import { MapView } from "@/components/map-view";
import { rankHyperLocal } from "@/lib/hyper-local";
import { useListFlashDeals } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";

type ViewMode = "list" | "map";

const CUISINES = [
  { id: "Österreichisch", emoji: "🥩", from: "from-stone-400",   to: "to-amber-600",  key: "home.cuisine_austrian" },
  { id: "Italienisch",    emoji: "🍝", from: "from-rose-400",    to: "to-red-500",    key: "home.cuisine_italian" },
  { id: "Japanisch",      emoji: "🍣", from: "from-sky-400",     to: "to-blue-600",   key: "home.cuisine_japanese" },
  { id: "Mexikanisch",    emoji: "🌮", from: "from-amber-400",   to: "to-orange-500", key: "home.cuisine_mexican" },
  { id: "Indisch",        emoji: "🍛", from: "from-yellow-400",  to: "to-orange-400", key: "home.cuisine_indian" },
  { id: "Französisch",    emoji: "🥐", from: "from-violet-400",  to: "to-purple-600", key: "home.cuisine_french" },
  { id: "Vegetarisch",    emoji: "🌿", from: "from-emerald-400", to: "to-teal-600",   key: "home.cuisine_vegetarian" },
  { id: "Amerikanisch",   emoji: "🍔", from: "from-orange-400",  to: "to-red-400",    key: "home.cuisine_american" },
];

const PRICE_BUBBLES = [
  { price: 1, emoji: "💚", label: "€",   from: "from-emerald-400", to: "to-green-600" },
  { price: 2, emoji: "🟡", label: "€€",  from: "from-amber-400",   to: "to-orange-500" },
  { price: 3, emoji: "💜", label: "€€€", from: "from-violet-500",  to: "to-purple-700" },
];

const RATING_BUBBLES = [
  { value: 3,   emoji: "⭐", label: "3+", from: "from-sky-400",    to: "to-blue-600" },
  { value: 4,   emoji: "🌟", label: "4+", from: "from-amber-400",  to: "to-orange-500" },
  { value: 4.5, emoji: "✨", label: "4.5+", from: "from-yellow-400", to: "to-amber-500" },
];

const WIEN_DISTRICTS = [
  { label: "1. Bezirk",  tag: "innerestadt", emoji: "🏛️" },
  { label: "2. Bezirk",  tag: "leopoldstadt",emoji: "🎡" },
  { label: "6./7.",      tag: "neubau",       emoji: "🎨" },
  { label: "9. Bezirk", tag: "alsergrund",   emoji: "📚" },
  { label: "15. Bez.",   tag: "rudolfsheim",  emoji: "🏘️" },
];

export default function Explore() {
  const { t } = useTranslation();
  useSeo({
    title: t("explore.title"),
    description: t("explore.subtitle"),
  });

  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);

  const initialCuisine = searchParams.get("cuisine") || "";
  const initialPrice = searchParams.get("priceRange") ? parseInt(searchParams.get("priceRange")!) : undefined;
  const initialOpenNow = searchParams.get("openNow") === "true";
  const initialRating = searchParams.get("rating") ? parseFloat(searchParams.get("rating")!) : undefined;
  const initialSearch = searchParams.get("search") || "";
  const initialBusinessType = searchParams.get("businessType") || "";

  const [search, setSearch] = useState(initialSearch);
  const [cuisine, setCuisine] = useState(initialCuisine);
  const [priceRange, setPriceRange] = useState<number | undefined>(initialPrice);
  const [openNow, setOpenNow] = useState(initialOpenNow);
  const [rating, setRating] = useState<number | undefined>(initialRating);
  const [businessType, setBusinessType] = useState<string>(initialBusinessType);
  const [sortByNearest, setSortByNearest] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const geo = useGeolocation();

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (cuisine) params.set("cuisine", cuisine);
    if (priceRange) params.set("priceRange", priceRange.toString());
    if (openNow) params.set("openNow", "true");
    if (rating) params.set("rating", rating.toString());
    if (businessType) params.set("businessType", businessType);
    
    const newSearchString = params.toString();
    if (newSearchString !== searchString) {
      setLocation(`/explore${newSearchString ? `?${newSearchString}` : ""}`, { replace: true });
    }
  }, [search, cuisine, priceRange, openNow, rating, businessType, setLocation, searchString]);

  const queryParams = {
    ...(search && { search }),
    ...(cuisine && { cuisine }),
    ...(priceRange && { priceRange }),
    ...(openNow && { openNow }),
    ...(rating && { rating }),
    ...(businessType && { businessType }),
  };

  const { data: restaurants, isLoading } = useListMarketplaceRestaurants(queryParams, {
    query: {
      queryKey: getListMarketplaceRestaurantsQueryKey(queryParams),
    }
  });
  const { data: flashDeals } = useListFlashDeals();

  const restaurantsWithDistances = useMemo(() => {
    if (!restaurants) return null;
    if (!sortByNearest || geo.status !== "granted" || geo.lat === null || geo.lng === null) {
      return restaurants.map(r => ({ restaurant: r, distance: undefined as number | undefined }));
    }
    const ranked = rankHyperLocal(restaurants, geo.lat!, geo.lng!, flashDeals ?? [], 999);
    return ranked.map(sr => ({ restaurant: sr.restaurant, distance: sr.distance }));
  }, [restaurants, flashDeals, sortByNearest, geo.status, geo.lat, geo.lng]);

  const handleNearestToggle = () => {
    if (!sortByNearest && geo.status === "idle") {
      geo.request();
    }
    setSortByNearest(prev => !prev);
  };

  const togglePrice = (price: number) => {
    setPriceRange(prev => prev === price ? undefined : price);
  };

  const clearFilters = () => {
    setSearch("");
    setCuisine("");
    setPriceRange(undefined);
    setOpenNow(false);
    setRating(undefined);
    setBusinessType("");
  };

  const activeFiltersCount = [cuisine, priceRange, openNow, rating, businessType].filter(Boolean).length;
  const displayList = restaurantsWithDistances ?? [];

  const firedImpressions = useRef<Set<number>>(new Set());
  useEffect(() => {
    const boosted = displayList.filter(({ restaurant }) => restaurant.hasActiveBoost);
    boosted.forEach(({ restaurant }) => {
      if (firedImpressions.current.has(restaurant.id)) return;
      firedImpressions.current.add(restaurant.id);
      const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      fetch(`${API}/api/promotions/restaurant/${restaurant.id}/impression`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    });
  }, [displayList]);

  const BUSINESS_TYPE_OPTS = [
    { value: "",           label: t("explore.filter_all"),        emoji: "🍽️" },
    { value: "restaurant", label: t("explore.filter_restaurant"), emoji: "🍴" },
    { value: "cafe",       label: t("explore.filter_cafe"),       emoji: "☕" },
    { value: "bar",        label: t("explore.filter_bar"),        emoji: "🍸" },
  ];

  return (
    <div className="container mx-auto px-4 max-w-7xl py-8 flex flex-col md:flex-row gap-8">

      {/* Filters Sidebar */}
      <aside className="w-full md:w-64 shrink-0 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-1">{t("explore.wien_title", "Wien entdecken")}</h1>
          <p className="text-xs text-muted-foreground mb-4">30 {t("explore.venues", "Lokale")} · {t("explore.venue_types", "Restaurants, Cafés & Bars")}</p>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t("explore.search_placeholder")}
              className="pl-11 h-12 rounded-2xl bg-card border-border/60 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Wien Bezirk quick-chips */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            📍 {t("explore.districts", "Wien Bezirke")}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {WIEN_DISTRICTS.map((d) => {
              const active = search === d.tag;
              return (
                <button
                  key={d.tag}
                  onClick={() => setSearch(active ? "" : d.tag)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all press-scale ${
                    active
                      ? "bg-primary text-white border-primary"
                      : "bg-muted/50 border-border/50 text-foreground hover:border-primary/30 hover:bg-primary/5"
                  }`}
                >
                  <span>{d.emoji}</span>
                  <span>{d.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
              <SlidersHorizontal className="w-4 h-4 text-primary" /> {t("common.filter")}
              {activeFiltersCount > 0 && (
                <span className="bg-primary text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </h3>
            {activeFiltersCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-primary font-bold hover:text-accent transition-colors">
                {t("explore.clear_filters")}
              </button>
            )}
          </div>

          {/* Location sort */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">{t("explore.sort_by", "Sortieren nach")}</h4>
            <button
              onClick={handleNearestToggle}
              className={`w-full flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-semibold transition-all press-scale ${
                sortByNearest && geo.status === "granted"
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : sortByNearest && geo.status === "requesting"
                  ? "bg-muted border-muted-foreground/20 text-muted-foreground"
                  : "bg-muted/40 border-border/50 text-foreground hover:border-primary/30 hover:bg-primary/5"
              }`}
            >
              {geo.status === "requesting" ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Navigation className={`w-4 h-4 shrink-0 ${sortByNearest && geo.status === "granted" ? "text-primary" : "text-muted-foreground"}`} />
              )}
              <span>{t("explore.sort_nearest", "Nächstgelegene zuerst")}</span>
              {sortByNearest && geo.status === "granted" && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSortByNearest(false); geo.clear(); }}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </button>
            {geo.status === "denied" && (
              <p className="text-xs text-amber-600 leading-snug">
                {t("explore.location_denied", "Standortzugriff verweigert. In den Browsereinstellungen aktivieren, um nach Entfernung zu sortieren.")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">{t("explore.status", "Status")}</h4>
            <label className="flex items-center gap-3 cursor-pointer group press-scale" onClick={() => setOpenNow(v => !v)}>
              <div className={`w-12 h-6 rounded-full transition-all flex items-center px-1 shadow-inner ${openNow ? 'bg-gradient-to-r from-primary to-accent' : 'bg-muted'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${openNow ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm font-semibold group-hover:text-primary transition-colors">{t("explore.open_now")}</span>
            </label>
          </div>

          {/* Business type chips */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">{t("explore.type", "Typ")}</h4>
            <div className="flex gap-1.5 flex-wrap">
              {BUSINESS_TYPE_OPTS.map((opt) => {
                const active = businessType === opt.value;
                return (
                  <button
                    key={opt.value || "all"}
                    onClick={() => setBusinessType(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all press-scale ${
                      active
                        ? "bg-primary text-white border-primary shadow-sm shadow-primary/25"
                        : "bg-muted/50 border-border/50 text-foreground hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price bubbles */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">{t("explore.price_filter")}</h4>
            <div className="flex gap-2">
              {PRICE_BUBBLES.map(pb => {
                const sel = priceRange === pb.price;
                return (
                  <button
                    key={pb.price}
                    onClick={() => togglePrice(pb.price)}
                    className="flex-1 flex flex-col items-center gap-1.5 press-scale group"
                  >
                    <div className={`w-full h-12 rounded-2xl flex items-center justify-center text-base font-black transition-all shadow-sm ${sel ? `bg-gradient-to-br ${pb.from} ${pb.to} text-white shadow-md` : "bg-muted/50 border border-border/50 text-muted-foreground hover:border-primary/30 group-hover:scale-105"}`}>
                      {pb.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cuisine bubble grid */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">{t("explore.cuisine_filter")}</h4>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setCuisine("")}
                className="flex flex-col items-center gap-1.5 press-scale group"
              >
                <div className={`w-full aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all shadow-sm ${cuisine === "" ? "bg-gradient-to-br from-primary to-accent shadow-md shadow-primary/25 scale-105" : "bg-muted/50 border border-border/50 hover:border-primary/30 group-hover:scale-105"}`}>
                  🍽️
                </div>
                <span className={`text-[10px] font-bold text-center leading-tight ${cuisine === "" ? "text-primary" : "text-muted-foreground"}`}>{t("explore.filter_all")}</span>
              </button>

              {CUISINES.map(c => {
                const sel = cuisine === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCuisine(c.id === cuisine ? "" : c.id)}
                    className="flex flex-col items-center gap-1.5 press-scale group"
                  >
                    <div className={`w-full aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all shadow-sm ${sel ? `bg-gradient-to-br ${c.from} ${c.to} shadow-md scale-105` : "bg-muted/50 border border-border/50 hover:border-primary/30 group-hover:scale-105"}`}>
                      {c.emoji}
                    </div>
                    <span className={`text-[10px] font-bold text-center leading-tight ${sel ? "text-primary" : "text-muted-foreground"}`}>{t(c.key, c.id)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rating bubbles */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">{t("explore.rating_filter")}</h4>
            <div className="flex gap-2">
              {RATING_BUBBLES.map(rb => {
                const sel = rating === rb.value;
                return (
                  <button
                    key={rb.value}
                    onClick={() => setRating(rb.value === rating ? undefined : rb.value)}
                    className="flex-1 flex flex-col items-center gap-1.5 press-scale group"
                  >
                    <div className={`w-full h-12 rounded-2xl flex items-center justify-center text-base font-black transition-all shadow-sm gap-1 ${sel ? `bg-gradient-to-br ${rb.from} ${rb.to} text-white shadow-md` : "bg-muted/50 border border-border/50 text-muted-foreground hover:border-primary/30 group-hover:scale-105"}`}>
                      <Star className={`w-3.5 h-3.5 fill-current ${sel ? "text-white" : "text-amber-400"}`} />
                      <span className="text-xs font-extrabold">{rb.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* Results */}
      <main className="flex-1 min-w-0">
        {/* Header: count + view toggle */}
        <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-muted-foreground text-sm">
            {isLoading
              ? t("explore.loading")
              : `${displayList.length} ${t("explore.venues", "Lokal")}${displayList.length !== 1 ? "e" : ""} ${t("explore.in_vienna", "in Wien gefunden")}${sortByNearest && geo.status === "granted" ? ` · ${t("explore.sorted_by_distance", "nach Entfernung sortiert")}` : ""}`}
          </p>

          {/* List / Map toggle */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/60 border border-border/50">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all press-scale ${
                viewMode === "list"
                  ? "bg-white shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="w-4 h-4" />
              {t("explore.list_view")}
            </button>
            <button
              onClick={() => {
                setViewMode("map");
                if (geo.status === "idle") geo.request();
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all press-scale ${
                viewMode === "map"
                  ? "bg-white shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Map className="w-4 h-4" />
              {t("explore.map_view")}
            </button>
          </div>
        </div>

        {/* Map view */}
        {viewMode === "map" && (
          <div className="w-full rounded-3xl overflow-hidden border border-border/50 shadow-lg" style={{ height: "calc(100vh - 220px)", minHeight: 480 }}>
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-muted/30">
                <div className="text-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm">{t("explore.loading")}</p>
                </div>
              </div>
            ) : (
              <MapView
                restaurants={displayList.map(({ restaurant, distance }) => ({ ...restaurant, distance }))}
                userLat={geo.lat}
                userLng={geo.lng}
              />
            )}
          </div>
        )}

        {/* List view */}
        {viewMode === "list" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
                  <Skeleton className="h-5 w-3/4 rounded-full" />
                  <Skeleton className="h-4 w-1/2 rounded-full" />
                </div>
              ))
            ) : displayList.length > 0 ? (
              displayList.map(({ restaurant, distance }) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  showFlashDeal
                  distance={distance}
                />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-24 text-center bg-card rounded-3xl border border-dashed border-border/50">
                <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl flex items-center justify-center mb-4 text-3xl">
                  🔍
                </div>
                <h3 className="text-xl font-extrabold mb-2">{t("explore.no_results")}</h3>
                <p className="text-muted-foreground max-w-md mb-6 text-sm">
                  {t("explore.no_results_hint")}
                </p>
                <button onClick={clearFilters} className="press-scale text-sm font-bold text-primary bg-primary/10 hover:bg-primary/15 px-5 py-2.5 rounded-2xl transition-colors">
                  {t("explore.clear_filters")}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
