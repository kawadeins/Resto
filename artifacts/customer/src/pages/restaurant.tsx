import React, { useState } from "react";
import { useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Star, Clock, MapPin, Phone, Mail, Calendar, Users, ChevronLeft, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

import { useGetMarketplaceRestaurant, useCreateCustomerBooking } from "@workspace/api-client-react";
import { getGetMarketplaceRestaurantQueryKey } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Generate time slots from 12:00 to 22:30
const TIME_SLOTS = Array.from({ length: 22 }).map((_, i) => {
  const hour = Math.floor(i / 2) + 12;
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour}:${minute}`;
});

const bookingSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(5, "Phone number required"),
  date: z.string().min(1, "Date required"),
  time: z.string().min(1, "Time required"),
  partySize: z.coerce.number().min(1, "Minimum 1 person").max(20, "Maximum 20 people"),
  notes: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export default function Restaurant() {
  const { id } = useParams<{ id: string }>();
  const restaurantId = parseInt(id || "0", 10);
  const { toast } = useToast();
  
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const { data: restaurant, isLoading } = useGetMarketplaceRestaurant(restaurantId, {
    query: {
      enabled: !!restaurantId,
      queryKey: getGetMarketplaceRestaurantQueryKey(restaurantId)
    }
  });

  const createBooking = useCreateCustomerBooking({
    mutation: {
      onSuccess: () => {
        setBookingSuccess(true);
        toast({
          title: "Booking confirmed!",
          description: "We've sent a confirmation to your email.",
        });
      },
      onError: () => {
        toast({
          title: "Booking failed",
          description: "There was an error securing your reservation. Please try again.",
          variant: "destructive"
        });
      }
    }
  });

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
        <h1 className="font-serif text-4xl font-bold mb-4">Restaurant not found</h1>
        <p className="text-muted-foreground mb-8">This restaurant may have been removed or is currently unavailable.</p>
        <Button asChild>
          <Link href="/explore">Browse all restaurants</Link>
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
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{restaurant.cuisineEmoji}</span>
                  <Badge variant="secondary" className="font-medium text-sm">
                    {restaurant.cuisine}
                  </Badge>
                  <span className="text-muted-foreground font-medium">{"€".repeat(restaurant.priceRange || 2)}</span>
                  {restaurant.isOpenNow && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">Open Now</Badge>
                  )}
                </div>
                <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight text-foreground mb-2">
                  {restaurant.name}
                </h1>
                
                {/* Flash Deal Alert */}
                {restaurant.hasActiveFlash && (
                  <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive font-semibold px-3 py-1.5 rounded-lg mt-2 border border-destructive/20">
                    <Star className="w-4 h-4 fill-current" />
                    {restaurant.flashPercentage}% OFF today
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-xl shrink-0 self-start sm:self-auto border border-amber-100">
                <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                <div>
                  <div className="font-bold text-xl leading-none text-amber-950">{restaurant.rating.toFixed(1)}</div>
                  <div className="text-xs font-medium text-amber-800">{restaurant.reviewCount} reviews</div>
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
                  <div className="font-medium">Address</div>
                  <div className="text-muted-foreground">{restaurant.address}</div>
                  <div className="text-muted-foreground">{restaurant.city}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Hours</div>
                  <div className="text-muted-foreground">
                    {restaurant.openDays?.join(", ")}
                  </div>
                  <div className="text-muted-foreground">
                    {restaurant.openTime} - {restaurant.closeTime}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Contact</div>
                  <div className="text-muted-foreground">{restaurant.phone}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Email</div>
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
          </div>

          {/* Menu */}
          <div className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="font-serif text-3xl font-bold mb-6">Menu</h2>
            
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
                Menu currently unavailable online.
              </div>
            )}
          </div>

        </div>

        {/* Sidebar / Booking Form */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="sticky top-24">
            <div className="bg-card border rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-primary/10 p-6 text-center border-b border-primary/10">
                <h3 className="font-serif text-2xl font-bold text-foreground">Make a Reservation</h3>
              </div>
              
              <div className="p-6">
                {bookingSuccess ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="font-serif text-2xl font-bold mb-2">You're all set!</h3>
                    <p className="text-muted-foreground mb-6">
                      Your table at {restaurant.name} is confirmed. We've sent details to your email.
                    </p>
                    <Button onClick={() => setBookingSuccess(false)} variant="outline" className="w-full rounded-full">
                      Book another table
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input 
                            id="date"
                            type="date" 
                            className="pl-9"
                            min={format(new Date(), "yyyy-MM-dd")}
                            {...form.register("date")} 
                          />
                        </div>
                        {form.formState.errors.date && (
                          <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="time">Time</Label>
                        <Select 
                          onValueChange={(val) => form.setValue("time", val)} 
                          defaultValue={form.getValues("time")}
                        >
                          <SelectTrigger className="w-full">
                            <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_SLOTS.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.time && (
                          <p className="text-xs text-destructive">{form.formState.errors.time.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="partySize">Party Size</Label>
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
                      <Label htmlFor="customerName">Full Name</Label>
                      <Input 
                        id="customerName"
                        placeholder="John Doe"
                        {...form.register("customerName")} 
                      />
                      {form.formState.errors.customerName && (
                        <p className="text-xs text-destructive">{form.formState.errors.customerName.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customerEmail">Email</Label>
                      <Input 
                        id="customerEmail"
                        type="email"
                        placeholder="john@example.com"
                        {...form.register("customerEmail")} 
                      />
                      {form.formState.errors.customerEmail && (
                        <p className="text-xs text-destructive">{form.formState.errors.customerEmail.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Phone Number</Label>
                      <Input 
                        id="customerPhone"
                        type="tel"
                        placeholder="+44 7700 900077"
                        {...form.register("customerPhone")} 
                      />
                      {form.formState.errors.customerPhone && (
                        <p className="text-xs text-destructive">{form.formState.errors.customerPhone.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Special Requests (Optional)</Label>
                      <Textarea 
                        id="notes"
                        placeholder="Anniversary, dietary requirements..."
                        className="resize-none h-20"
                        {...form.register("notes")} 
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full rounded-full h-12 text-lg font-medium shadow-md mt-4"
                      disabled={createBooking.isPending}
                    >
                      {createBooking.isPending ? "Confirming..." : "Confirm Reservation"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground mt-4">
                      By proceeding, you agree to our Terms of Service and Privacy Policy.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
