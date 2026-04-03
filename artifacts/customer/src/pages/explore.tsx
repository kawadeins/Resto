import React, { useState, useEffect, useMemo } from "react";
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

type ViewMode = "list" | "map";

const CUISINES = ["Italienisch", "Japanisch", "Mexikanisch", "Indisch", "Französisch", "Thailändisch", "Amerikanisch", "Britisch"];

export default function Explore() {
  useSeo({
    title: "Restaurants entdecken",
    description: "Londoner Restaurants nach Küche, Preis, Bewertung und Verfügbarkeit filtern.",
  });

  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);

  // Parse filters from URL
  const initialCuisine = searchParams.get("cuisine") || "";
  const initialPrice = searchParams.get("priceRange") ? parseInt(searchParams.get("priceRange")!) : undefined;
  const initialOpenNow = searchParams.get("openNow") === "true";
  const initialRating = searchParams.get("rating") ? parseFloat(searchParams.get("rating")!) : undefined;
  const initialSearch = searchParams.get("search") || "";

  const [search, setSearch] = useState(initialSearch);
  const [cuisine, setCuisine] = useState(initialCuisine);
  const [priceRange, setPriceRange] = useState<number | undefined>(initialPrice);
  const [openNow, setOpenNow] = useState(initialOpenNow);
  const [rating, setRating] = useState<number | undefined>(initialRating);
  const [sortByNearest, setSortByNearest] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const geo = useGeolocation();

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (cuisine) params.set("cuisine", cuisine);
    if (priceRange) params.set("priceRange", priceRange.toString());
    if (openNow) params.set("openNow", "true");
    if (rating) params.set("rating", rating.toString());
    
    const newSearchString = params.toString();
    if (newSearchString !== searchString) {
      setLocation(`/explore${newSearchString ? `?${newSearchString}` : ""}`, { replace: true });
    }
  }, [search, cuisine, priceRange, openNow, rating, setLocation, searchString]);

  const queryParams = {
    ...(search && { search }),
    ...(cuisine && { cuisine }),
    ...(priceRange && { priceRange }),
    ...(openNow && { openNow }),
    ...(rating && { rating }),
  };

  const { data: restaurants, isLoading } = useListMarketplaceRestaurants(queryParams, {
    query: {
      queryKey: getListMarketplaceRestaurantsQueryKey(queryParams),
    }
  });
  const { data: flashDeals } = useListFlashDeals();

  // Compute distances + hyper-local scores when location is available
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
  };

  const activeFiltersCount = [cuisine, priceRange, openNow, rating].filter(Boolean).length;

  const displayList = restaurantsWithDistances ?? [];

  return (
    <div className="container mx-auto px-4 max-w-7xl py-8 flex flex-col md:flex-row gap-8">

      {/* Filters Sidebar */}
      <aside className="w-full md:w-64 shrink-0 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-5">Entdecken</h1>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Restaurants suchen..."
              className="pl-11 h-12 rounded-2xl bg-card border-border/60 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
              <SlidersHorizontal className="w-4 h-4 text-primary" /> Filter
              {activeFiltersCount > 0 && (
                <span className="bg-primary text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </h3>
            {activeFiltersCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-primary font-bold hover:text-accent transition-colors">
                Alle löschen
              </button>
            )}
          </div>

          {/* Location sort */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Sortieren nach</h4>
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
              <span>Nächstgelegene zuerst</span>
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
                Standortzugriff verweigert. In den Browsereinstellungen aktivieren, um nach Entfernung zu sortieren.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Status</h4>
            <label className="flex items-center gap-3 cursor-pointer group press-scale" onClick={() => setOpenNow(v => !v)}>
              <div className={`w-12 h-6 rounded-full transition-all flex items-center px-1 shadow-inner ${openNow ? 'bg-gradient-to-r from-primary to-accent' : 'bg-muted'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${openNow ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm font-semibold group-hover:text-primary transition-colors">Jetzt geöffnet</span>
            </label>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Preis</h4>
            <div className="flex gap-2">
              {[1, 2, 3].map(price => (
                <button
                  key={price}
                  onClick={() => togglePrice(price)}
                  className={`flex-1 py-2 rounded-2xl text-sm font-bold transition-all press-scale ${priceRange === price ? "bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/30" : "bg-muted/60 text-muted-foreground hover:bg-muted border border-border/50"}`}
                >
                  {"€".repeat(price)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Küche</h4>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCuisine("")}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all press-scale ${cuisine === "" ? "bg-gradient-to-r from-primary to-accent text-white shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted border border-border/50"}`}
              >
                Alle
              </button>
              {CUISINES.map(c => (
                <button
                  key={c}
                  onClick={() => setCuisine(c === cuisine ? "" : c)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all press-scale ${cuisine === c ? "bg-gradient-to-r from-primary to-accent text-white shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted border border-border/50"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Mindestbewertung</h4>
            <div className="flex gap-2">
              {[3, 4, 4.5].map(r => (
                <button
                  key={r}
                  onClick={() => setRating(r === rating ? undefined : r)}
                  className={`flex-1 py-2 rounded-2xl text-xs font-bold flex items-center justify-center gap-1 transition-all press-scale ${rating === r ? "bg-gradient-to-br from-primary to-accent text-white shadow-md" : "bg-muted/60 text-muted-foreground hover:bg-muted border border-border/50"}`}
                >
                  {r}+ <Star className="w-3 h-3 fill-current" />
                </button>
              ))}
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
              ? "Wird gesucht..."
              : `${displayList.length} Restaurant${displayList.length !== 1 ? "s" : ""} gefunden${sortByNearest && geo.status === "granted" ? " · nach Entfernung sortiert" : ""}`}
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
              Liste
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
              Karte
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
                  <p className="text-sm">Karte wird geladen...</p>
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
                <h3 className="text-xl font-extrabold mb-2">Keine Ergebnisse gefunden</h3>
                <p className="text-muted-foreground max-w-md mb-6 text-sm">
                  Keine Restaurants entsprechen Ihren aktuellen Filtern. Versuchen Sie, sie anzupassen.
                </p>
                <button onClick={clearFilters} className="press-scale text-sm font-bold text-primary bg-primary/10 hover:bg-primary/15 px-5 py-2.5 rounded-2xl transition-colors">
                  Alle Filter löschen
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
