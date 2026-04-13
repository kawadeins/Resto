import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Lock, ShieldAlert, Activity, Users, Settings2, TrendingUp, Search, Calendar, Star, Store, Check, X, Rocket, AlertTriangle, MessageSquare, BarChart2 } from "lucide-react";
import type { SuperAdminStats, SuperAdminRestaurant, PlatformSetting } from "@workspace/api-client-react";

type PilotRestaurantMetric = {
  id: number;
  name: string;
  pilotMode: boolean;
  pilotActivatedAt: string | null;
  hoursSinceActivation: number | null;
  readinessScore: number;
  bookings: number;
  arrivedBookings: number;
  menuItemCount: number;
  discountCount: number;
  estimatedRevenue: number;
  feedbackCount: number;
  avgRating: number | null;
  is24hAlert: boolean;
  criteria: Record<string, boolean>;
};

type PilotDashboard = {
  summary: {
    totalPilotRestaurants: number;
    activeRestaurants: number;
    totalBookingsGenerated: number;
    arrivedBookings: number;
    estimatedRevenueImpact: number;
    repeatCustomers: number;
    totalFeedbackItems: number;
    activeCampaigns: number;
    mostActiveRestaurant: string | null;
  };
  restaurants: PilotRestaurantMetric[];
  recentFeedback: Array<{
    id: number;
    restaurantId: number;
    rating: number | null;
    message: string;
    category: string;
    createdAt: string;
  }>;
};

export default function SuperAdmin() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminKey, setAdminKey] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput) {
      setAdminKey(passwordInput);
      setIsAuthenticated(true);
    }
  };

  const { data: stats, isLoading: loadingStats, isError: statsError } = useQuery<SuperAdminStats>({
    queryKey: ["super-admin-stats", adminKey],
    queryFn: () => fetch("/api/platform/super-admin/stats", { headers: { "x-super-admin-key": adminKey } }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: isAuthenticated,
    retry: false
  });

  const { data: restaurants, isLoading: loadingRestaurants } = useQuery<SuperAdminRestaurant[]>({
    queryKey: ["super-admin-restaurants", adminKey],
    queryFn: () => fetch("/api/platform/super-admin/restaurants", { headers: { "x-super-admin-key": adminKey } }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: isAuthenticated,
    retry: false
  });

  const { data: settings, isLoading: loadingSettings } = useQuery<PlatformSetting[]>({
    queryKey: ["platform-settings", adminKey],
    queryFn: () => fetch("/api/platform/settings", { headers: { "x-super-admin-key": adminKey } }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: isAuthenticated,
    retry: false
  });

  const { data: pilotDashboard, isLoading: loadingPilot } = useQuery<PilotDashboard>({
    queryKey: ["pilot-dashboard", adminKey],
    queryFn: () => fetch("/api/pilot/dashboard", { headers: { "x-super-admin-key": adminKey } }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 30000,
  });

  const activatePilot = useMutation({
    mutationFn: async ({ restaurantId, activate }: { restaurantId: number; activate: boolean }) => {
      const path = activate ? "activate" : "deactivate";
      const res = await fetch(`/api/pilot/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-super-admin-key": adminKey },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      toast({ title: vars.activate ? "Pilotmodus aktiviert — alle Funktionen freigeschaltet." : "Pilotmodus deaktiviert." });
      queryClient.invalidateQueries({ queryKey: ["pilot-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-restaurants"] });
    },
    onError: () => toast({ title: "Pilotmodus konnte nicht aktualisiert werden", variant: "destructive" }),
  });

  useEffect(() => {
    if (statsError) {
      toast({ title: "Authentifizierung fehlgeschlagen", description: "Ungültiger Super-Admin-Schlüssel", variant: "destructive" });
      setIsAuthenticated(false);
      setAdminKey("");
    }
  }, [statsError, toast]);

  const toggleRestaurantStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/platform/super-admin/restaurants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-super-admin-key": adminKey },
        body: JSON.stringify({ isActive })
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Restaurantstatus aktualisiert" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-restaurants"] });
    },
    onError: () => toast({ title: "Restaurant konnte nicht aktualisiert werden", variant: "destructive" })
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await fetch(`/api/platform/settings/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-super-admin-key": adminKey },
        body: JSON.stringify({ value })
      });
      if (!res.ok) throw new Error("Failed to update setting");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Einstellung erfolgreich gespeichert" });
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: () => toast({ title: "Einstellung konnte nicht gespeichert werden", variant: "destructive" })
  });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="border-rose-500/20 bg-card">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto bg-rose-500/10 p-4 rounded-full w-20 h-20 flex items-center justify-center">
                <ShieldAlert className="w-10 h-10 text-rose-500" />
              </div>
              <div>
                <CardTitle className="text-2xl text-rose-500">Eingeschränkter Zugang</CardTitle>
                <CardDescription className="mt-2">Geben Sie den Super-Admin-Schlüssel ein, um auf das Plattform-Kontrollzentrum zuzugreifen.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <Input 
                  type="password" 
                  placeholder="Super-Admin-Schlüssel..." 
                  value={passwordInput} 
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="bg-background text-center text-lg tracking-widest focus-visible:ring-rose-500"
                />
                <Button type="submit" className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold" disabled={!passwordInput}>
                  <Lock className="w-4 h-4 mr-2" /> Kontrollzentrum öffnen
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const activeSubCount = (stats?.subscriptions?.active as number) || 0;
  const trialSubCount = (stats?.subscriptions?.trial as number) || 0;
  const monthlyRev = activeSubCount * 39.90; // Based on €39.90 Business Premium plan

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-end justify-between bg-rose-500/5 p-6 rounded-lg border border-rose-500/20">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            <h2 className="text-3xl font-bold tracking-tight text-rose-500">Plattform-Kontrollzentrum</h2>
          </div>
          <p className="text-muted-foreground">Globale Übersicht und Plattformverwaltung.</p>
        </div>
        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30">
          Super Admin Aktiv
        </Badge>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gesch. Monatsumsatz</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-500 flex items-center gap-2">
              €{monthlyRev}
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktive Restaurants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              {stats?.restaurants?.active as number || 0}
              <Store className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktive Pro-Pläne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              {activeSubCount}
              <Activity className="w-5 h-5 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Test-Abonnements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{trialSubCount}</div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Buchungen gesamt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {stats?.bookings?.total as number || 0}
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plattform-Durchschnittsbewertung</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {(stats?.reviews?.averageRating as number || 0).toFixed(1)}
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Registrierte Restaurants
          </CardTitle>
          <CardDescription>Alle Mandanten auf der Plattform verwalten</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRestaurants ? (
            <div className="p-8 text-center text-muted-foreground">Restaurants werden geladen...</div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Stadt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Kennzahlen</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restaurants?.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.name}
                        <div className="text-xs text-muted-foreground mt-0.5">{r.cuisine}</div>
                      </TableCell>
                      <TableCell>{r.city}</TableCell>
                      <TableCell>
                        {r.isActive ? (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">Aktiv</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Inaktiv</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.subscription?.status === 'active' ? (
                          <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20">Pro</Badge>
                        ) : r.subscription?.status === 'trial' ? (
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Test</Badge>
                        ) : (
                          <Badge variant="outline">Kostenlos</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm">
                          <div>{r.bookingCount} Buchungen</div>
                          <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                            {r.avgRating?.toFixed(1) || "-"} <Star className="w-3 h-3 fill-current" /> ({r.reviewCount})
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant={r.isActive ? "outline" : "default"} 
                          size="sm"
                          className={!r.isActive ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"}
                          onClick={() => toggleRestaurantStatus.mutate({ id: r.id, isActive: !r.isActive })}
                          disabled={toggleRestaurantStatus.isPending}
                        >
                          {r.isActive ? <><X className="w-3 h-3 mr-1" /> Deaktivieren</> : <><Check className="w-3 h-3 mr-1" /> Aktivieren</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {restaurants?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Keine Restaurants gefunden.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pilot Programme Dashboard */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-amber-500">
                <Rocket className="w-5 h-5" />
                Pilotprogramm
              </CardTitle>
              <CardDescription>Praxis-Startkontrolle — aktivieren, um alle Pro-Funktionen kostenlos freizuschalten</CardDescription>
            </div>
            {pilotDashboard && (
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                  {pilotDashboard.summary.totalPilotRestaurants} aktive Piloten
                </Badge>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                  {pilotDashboard.summary.totalBookings} Buchungen gesamt
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingPilot ? (
            <div className="p-8 text-center text-muted-foreground">Pilotdaten werden geladen...</div>
          ) : !pilotDashboard ? (
            <div className="p-8 text-center text-muted-foreground">Keine Pilotdaten verfügbar.</div>
          ) : (
            <div className="space-y-4">
              {pilotDashboard.restaurants.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-lg border p-4 flex flex-col md:flex-row md:items-center gap-4 ${
                    r.pilotMode
                      ? "bg-amber-500/5 border-amber-500/25"
                      : "bg-card border-border"
                  }`}
                >
                  {/* Name & status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold">{r.name}</span>
                      {r.pilotMode ? (
                        <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 text-xs">
                          Pilot Aktiv
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Pilot Aus
                        </Badge>
                      )}
                      {r.pilotActivatedAt && (
                        <span className="text-xs text-muted-foreground">
                          seit {new Date(r.pilotActivatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BarChart2 className="w-3.5 h-3.5" />
                        Bereitschaft {r.readinessScore ?? "-"}%
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {r.totalBookings} Buchungen
                      </span>
                      {r.bookingsAfterActivation !== undefined && r.pilotMode && (
                        <span className="flex items-center gap-1 text-emerald-500">
                          +{r.bookingsAfterActivation} seit Pilot
                        </span>
                      )}
                      {r.feedbackCount !== undefined && r.feedbackCount > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {r.feedbackCount} Feedback{r.avgFeedbackRating ? ` · ${r.avgFeedbackRating.toFixed(1)} Ø` : ""}
                        </span>
                      )}
                    </div>
                    {r.readinessScore !== undefined && r.readinessScore < 100 && (
                      <div className="mt-2">
                        <div className="flex items-center gap-1 text-xs text-amber-600 mb-1">
                          <AlertTriangle className="w-3 h-3" />
                          Bereitschaft {r.readinessScore}% — einige Kriterien nicht erfüllt
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-amber-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${r.readinessScore}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Activate / Deactivate */}
                  <Button
                    size="sm"
                    variant={r.pilotMode ? "outline" : "default"}
                    className={
                      r.pilotMode
                        ? "text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30"
                        : "bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                    }
                    onClick={() => activatePilot.mutate({ restaurantId: r.id, activate: !r.pilotMode })}
                    disabled={activatePilot.isPending}
                  >
                    {r.pilotMode ? (
                      <><X className="w-3.5 h-3.5 mr-1.5" />Pilot deaktivieren</>
                    ) : (
                      <><Rocket className="w-3.5 h-3.5 mr-1.5" />Pilot starten</>
                    )}
                  </Button>
                </div>
              ))}

              {pilotDashboard.restaurants.length === 0 && (
                <div className="py-10 text-center text-muted-foreground">
                  <Rocket className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Noch keine Restaurants im Pilotprogramm.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Plattformeinstellungen
          </CardTitle>
          <CardDescription>Globale Konfigurationsvariablen</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSettings ? (
            <div className="p-8 text-center text-muted-foreground">Einstellungen werden geladen...</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {settings?.map(setting => (
                <div key={setting.key} className="flex gap-4 items-start p-4 border rounded-lg bg-muted/20">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="text-sm font-semibold text-foreground">{setting.label}</label>
                      <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                    </div>
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        updateSetting.mutate({ key: setting.key, value: formData.get("value") as string });
                      }}
                      className="flex gap-2"
                    >
                      <Input name="value" defaultValue={setting.value} className="h-8 text-sm" />
                      <Button type="submit" size="sm" variant="secondary" className="h-8" disabled={updateSetting.isPending}>Speichern</Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}