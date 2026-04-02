import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { format, isPast, parseISO } from "date-fns";
import { CalendarCheck, Mail, MapPin, Clock, Users, ArrowRight } from "lucide-react";
import { useListMyBookings } from "@workspace/api-client-react";
import { getListMyBookingsQueryKey } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyBookings() {
  const [emailInput, setEmailInput] = useState("");
  const [activeEmail, setActiveEmail] = useState<string>("");

  useEffect(() => {
    // Check local storage for existing email on mount
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

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
      case "seated":
      case "completed":
        return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Confirmed</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Pending</Badge>;
      case "rejected":
      case "cancelled":
        return <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!activeEmail) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-muted/30 px-4">
        <div className="max-w-md w-full bg-card p-8 rounded-2xl shadow-xl border">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CalendarCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-center mb-2">My Bookings</h1>
          <p className="text-center text-muted-foreground mb-8">
            Enter the email address you used to make your reservations to view your itinerary.
          </p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="your@email.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 rounded-full font-bold">
              Find My Bookings
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Split bookings into upcoming and past
  const upcoming = bookings?.filter(b => {
    try {
      const bookingDate = new Date(`${b.date}T${b.time}`);
      return !isPast(bookingDate) && b.status !== "cancelled" && b.status !== "rejected";
    } catch {
      return true; // Fallback to showing it
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
          <h1 className="font-serif text-4xl font-bold mb-2">My Bookings</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Logged in as <span className="font-medium text-foreground">{activeEmail}</span>
            <button onClick={handleLogout} className="text-xs text-primary hover:underline ml-2">
              (Change)
            </button>
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/explore">Book another table</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-[200px] w-full rounded-2xl" />
          <Skeleton className="h-[200px] w-full rounded-2xl" />
        </div>
      ) : bookings && bookings.length > 0 ? (
        <div className="space-y-12">
          
          {upcoming.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl font-bold mb-6 flex items-center gap-2">
                Upcoming Reservations
                <Badge variant="secondary" className="rounded-full">{upcoming.length}</Badge>
              </h2>
              <div className="space-y-4">
                {upcoming.map(booking => (
                  <div key={booking.id} className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-2 h-full bg-primary"></div>
                    
                    {/* Date Block */}
                    <div className="md:w-32 shrink-0 flex flex-col items-center justify-center bg-muted/50 rounded-xl p-4 text-center">
                      <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                        {format(parseISO(booking.date), "MMM")}
                      </div>
                      <div className="font-serif text-4xl font-bold text-primary my-1">
                        {format(parseISO(booking.date), "d")}
                      </div>
                      <div className="text-sm font-medium">
                        {format(parseISO(booking.date), "EEEE")}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex items-start justify-between mb-2">
                        <Link href={`/restaurant/${booking.restaurant?.id}`} className="font-serif text-2xl font-bold hover:text-primary transition-colors">
                          {booking.restaurant?.name || "Restaurant"}
                        </Link>
                        {getStatusBadge(booking.status)}
                      </div>
                      
                      <div className="text-sm text-muted-foreground mb-4">
                        {booking.restaurant?.cuisine && (
                          <span>{booking.restaurant.cuisine} cuisine</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          <span className="font-medium">{booking.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          <span className="font-medium">{booking.partySize} people</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                          <CalendarCheck className="w-4 h-4" />
                          <span>Booked under {booking.customerName}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="shrink-0 flex items-center justify-center md:border-l md:pl-6">
                      <Button asChild variant="ghost" className="w-full md:w-auto rounded-full hover:bg-primary hover:text-white transition-colors">
                        <Link href={`/restaurant/${booking.restaurant?.id}`}>
                          View Restaurant
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl font-bold mb-6 text-muted-foreground">Past Reservations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {past.map(booking => (
                  <div key={booking.id} className="bg-card border rounded-xl p-5 flex gap-4 opacity-75 hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {booking.restaurant?.heroImage ? (
                        <img src={booking.restaurant.heroImage} alt="" className="w-full h-full object-cover grayscale" />
                      ) : (
                        <CalendarCheck className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold line-clamp-1">{booking.restaurant?.name}</h4>
                        {getStatusBadge(booking.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(parseISO(booking.date), "MMM d, yyyy")} • {booking.time}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Party of {booking.partySize}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      ) : (
        <div className="text-center py-20 bg-card rounded-2xl border border-dashed shadow-sm">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <CalendarCheck className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="font-serif text-3xl font-bold mb-4">No bookings yet</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg">
            Looks like you haven't made any reservations with this email address. 
            Ready to find your next great meal?
          </p>
          <Button asChild size="lg" className="rounded-full px-8 shadow-lg">
            <Link href="/explore">
              Explore Restaurants <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
