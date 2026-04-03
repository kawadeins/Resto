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

const CUISINES = ["Italian", "Japanese", "Mexican", "Indian", "French", "Thai", "American", "British"];

export default function Explore() {
  useSeo({
    title: "Explore Restaurants",
    description: "Browse and filter London restaurants by cuisine, price, rating, and availability.",
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
      <aside className="w-full md:w-64 shrink-0 space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-bold mb-6">Explore</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search restaurants..."
              className="pl-9 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" /> Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 rounded-full px-1.5 min-w-[20px] justify-center">
                  {activeFiltersCount}
                </Badge>
              )}
            </h3>
            {activeFiltersCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-primary font-medium hover:underline">
                Clear all
              </button>
            )}
          </div>

          {/* Location sort */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Sort by</h4>
            <button
              onClick={handleNearestToggle}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                sortByNearest && geo.status === "granted"
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : sortByNearest && geo.status === "requesting"
                  ? "bg-muted border-muted-foreground/20 text-muted-foreground"
                  : "bg-card border-border text-foreground hover:border-primary/30"
              }`}
            >
              {geo.status === "requesting" ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Navigation className={`w-4 h-4 shrink-0 ${sortByNearest && geo.status === "granted" ? "text-primary" : "text-muted-foreground"}`} />
              )}
              <span>Nearest first</span>
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
                Location access denied. Enable in browser settings to sort by distance.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Status</h4>
            <label className="flex items-center gap-3 cursor-pointer group" onClick={() => setOpenNow(v => !v)}>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${openNow ? 'bg-primary' : 'bg-muted'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${openNow ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm font-medium group-hover:text-primary transition-colors">Open Now</span>
            </label>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Price</h4>
            <div className="flex gap-2">
              {[1, 2, 3].map(price => (
                <Button
                  key={price}
                  variant={priceRange === price ? "default" : "outline"}
                  size="sm"
                  onClick={() => togglePrice(price)}
                  className="flex-1 rounded-full"
                >
                  {"€".repeat(price)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Cuisine</h4>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={cuisine === "" ? "default" : "secondary"}
                className="cursor-pointer hover:bg-primary/80 hover:text-primary-foreground"
                onClick={() => setCuisine("")}
              >
                All
              </Badge>
              {CUISINES.map(c => (
                <Badge
                  key={c}
                  variant={cuisine === c ? "default" : "secondary"}
                  className="cursor-pointer hover:bg-primary/80 hover:text-primary-foreground transition-colors"
                  onClick={() => setCuisine(c === cuisine ? "" : c)}
                >
                  {c}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Minimum Rating</h4>
            <div className="flex gap-2">
              {[3, 4, 4.5].map(r => (
                <Button
                  key={r}
                  variant={rating === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRating(r === rating ? undefined : r)}
                  className="flex-1 rounded-full flex gap-1"
                >
                  {r}+ <Star className="w-3 h-3 fill-current" />
                </Button>
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
              ? "Searching..."
              : `${displayList.length} restaurant${displayList.length !== 1 ? "s" : ""} found${sortByNearest && geo.status === "granted" ? " · sorted by distance" : ""}`}
          </p>

          {/* List / Map toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 border">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === "list"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => {
                setViewMode("map");
                if (geo.status === "idle") geo.request();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === "map"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Map className="w-4 h-4" />
              Map
            </button>
          </div>
        </div>

        {/* Map view */}
        {viewMode === "map" && (
          <div className="w-full rounded-xl overflow-hidden border shadow-sm" style={{ height: "calc(100vh - 220px)", minHeight: 480 }}>
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-muted/30">
                <div className="text-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Loading map...</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
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
              <div className="col-span-full flex flex-col items-center justify-center py-24 text-center bg-card rounded-2xl border border-dashed">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-serif text-2xl font-bold mb-2">No results found</h3>
                <p className="text-muted-foreground max-w-md mb-6">
                  No restaurants match your current filters. Try adjusting them.
                </p>
                <Button onClick={clearFilters} variant="outline" className="rounded-full">
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
