import React, { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, SlidersHorizontal, Star, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RestaurantCard } from "@/components/restaurant-card";
import { useListMarketplaceRestaurants } from "@workspace/api-client-react";
import { getListMarketplaceRestaurantsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/hooks/use-seo";

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
      // debounce query to avoid spamming while typing
    }
  });

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

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Status</h4>
            <label className="flex items-center gap-3 cursor-pointer group">
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

      {/* Results Grid */}
      <main className="flex-1">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-muted-foreground">
            {isLoading ? "Searching..." : `${restaurants?.length || 0} restaurants found`}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading ? (
             Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          ) : restaurants && restaurants.length > 0 ? (
            restaurants.map(restaurant => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} showFlashDeal />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-24 text-center bg-card rounded-2xl border border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-serif text-2xl font-bold mb-2">No results found</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                We couldn't find any restaurants matching your current filters. Try adjusting your search criteria.
              </p>
              <Button onClick={clearFilters} variant="outline" className="rounded-full">
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
