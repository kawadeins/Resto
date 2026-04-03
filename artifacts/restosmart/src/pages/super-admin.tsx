import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Lock, ShieldAlert, Activity, Users, Settings2, TrendingUp, Search, Calendar, Star, Store, Check, X } from "lucide-react";
import type { SuperAdminStats, SuperAdminRestaurant, PlatformSetting } from "@workspace/api-client-react";

export default function SuperAdmin() {
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

  useEffect(() => {
    if (statsError) {
      toast({ title: "Authentication Failed", description: "Invalid Super Admin Key", variant: "destructive" });
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
      toast({ title: "Restaurant status updated" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-restaurants"] });
    },
    onError: () => toast({ title: "Failed to update restaurant", variant: "destructive" })
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
      toast({ title: "Setting saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: () => toast({ title: "Failed to save setting", variant: "destructive" })
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
                <CardTitle className="text-2xl text-rose-500">Restricted Access</CardTitle>
                <CardDescription className="mt-2">Enter the Super Admin Key to access the platform command center.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <Input 
                  type="password" 
                  placeholder="Super Admin Key..." 
                  value={passwordInput} 
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="bg-background text-center text-lg tracking-widest focus-visible:ring-rose-500"
                />
                <Button type="submit" className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold" disabled={!passwordInput}>
                  <Lock className="w-4 h-4 mr-2" /> Unlock Command Center
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
  const monthlyRev = activeSubCount * 30; // Approximation based on €30 plan

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-end justify-between bg-rose-500/5 p-6 rounded-lg border border-rose-500/20">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            <h2 className="text-3xl font-bold tracking-tight text-rose-500">Platform Command Center</h2>
          </div>
          <p className="text-muted-foreground">Global oversight and platform administration.</p>
        </div>
        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30">
          Super Admin Active
        </Badge>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Est. Monthly Revenue</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Restaurants</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Pro Plans</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Trial Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{trialSubCount}</div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Platform Avg Rating</CardTitle>
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
            Registered Restaurants
          </CardTitle>
          <CardDescription>Manage all tenants on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRestaurants ? (
            <div className="p-8 text-center text-muted-foreground">Loading restaurants...</div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Metrics</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.subscription?.status === 'active' ? (
                          <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20">Pro</Badge>
                        ) : r.subscription?.status === 'trial' ? (
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Trial</Badge>
                        ) : (
                          <Badge variant="outline">Free/None</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm">
                          <div>{r.bookingCount} books</div>
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
                          {r.isActive ? <><X className="w-3 h-3 mr-1" /> Deactivate</> : <><Check className="w-3 h-3 mr-1" /> Activate</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {restaurants?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No restaurants found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Platform Settings
          </CardTitle>
          <CardDescription>Global configuration variables</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSettings ? (
            <div className="p-8 text-center text-muted-foreground">Loading settings...</div>
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
                      <Button type="submit" size="sm" variant="secondary" className="h-8" disabled={updateSetting.isPending}>Save</Button>
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