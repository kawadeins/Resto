import { useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  useListReservations, 
  getListReservationsQueryKey,
  useGetReservationStats,
  getGetReservationStatsQueryKey,
  useCreateReservation,
  useUpdateReservation,
  useDeleteReservation,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/session-context";

const GRP_API = ((import.meta.env.VITE_API_URL as string | undefined) ?? "") + "/api";

const GRP_STATUS: Record<string, { label: string; cls: string }> = {
  planned:   { label: "Geplant",            cls: "bg-slate-100 text-slate-600 border-slate-200" },
  sent:      { label: "Warten auf Antwort", cls: "bg-blue-50 text-blue-600 border-blue-200" },
  confirmed: { label: "Bestätigt",          cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:  { label: "Abgelehnt",          cls: "bg-rose-50 text-rose-600 border-rose-200" },
  cancelled: { label: "Storniert",          cls: "bg-slate-50 text-slate-400 border-slate-200" },
};
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Users, CheckCircle2, Clock, CheckSquare, XCircle, MoreHorizontal, Pencil, Trash2, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import type { Reservation } from "@workspace/api-client-react";
import { format } from "date-fns";

const reservationSchema = z.object({
  customerName: z.string().min(2, "Name ist erforderlich"),
  customerEmail: z.string().email("Ungültige E-Mail-Adresse").or(z.literal("")),
  customerPhone: z.string().min(5, "Telefonnummer ist erforderlich"),
  date: z.string(),
  time: z.string(),
  partySize: z.coerce.number().min(1).max(20),
  tableNumber: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  source: z.enum(["direct", "online", "phone", "walkin"]),
  status: z.enum(["pending", "confirmed", "seated", "completed", "cancelled"]).optional(),
});

type ReservationFormValues = z.infer<typeof reservationSchema>;

const statusColors = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  confirmed: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  seated: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  completed: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  cancelled: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

const statusLabels: Record<string, string> = {
  pending: "Ausstehend",
  confirmed: "Bestätigt",
  seated: "Platziert",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
};

const sourceLabels: Record<string, string> = {
  phone: "Telefon",
  online: "Online",
  walkin: "Walk-in",
  direct: "Direkt",
};

export default function Reservations() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { csrfToken } = useSession();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [mainTab, setMainTab] = useState<"reservations" | "gruppenanfragen">("reservations");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [dateFilter, setDateFilter] = useState<"today" | "week" | "all">("today");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: groupRequests = [], refetch: refetchGroupRequests } = useQuery<any[]>({
    queryKey: ["group-reservations-owner"],
    queryFn: async () => {
      const r = await fetch(`${GRP_API}/group-reservations`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30 * 1000,
    enabled: mainTab === "gruppenanfragen",
  });

  const updateGroupRequestStatus = async (id: number, status: "confirmed" | "rejected" | "cancelled") => {
    if (updatingId !== null) return;
    setUpdatingId(id);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const res = await fetch(`${GRP_API}/group-reservations/${id}/status`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      // Optimistic cache update — no reload needed
      queryClient.setQueryData<any[]>(["group-reservations-owner"], (prev = []) =>
        prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
      );
      const labels: Record<string, string> = { confirmed: "Bestätigt", rejected: "Abgelehnt", cancelled: "Storniert" };
      toast({ title: `Anfrage ${labels[status]}` });
    } catch (err: any) {
      toast({ title: err.message || "Fehler beim Aktualisieren", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const queryParams = {
    ...(dateFilter === "today" ? { date: todayStr } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {})
  };

  const { data: stats, isLoading: loadingStats } = useGetReservationStats({
    query: { queryKey: getGetReservationStatsQueryKey() }
  });

  const { data: reservations, isLoading: loadingReservations } = useListReservations(
    { params: queryParams },
    { query: { queryKey: getListReservationsQueryKey(queryParams) } }
  );

  const createReservation = useCreateReservation();
  const updateReservation = useUpdateReservation();
  const deleteReservation = useDeleteReservation();

  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      date: todayStr,
      time: "19:00",
      partySize: 2,
      source: "phone",
      status: "pending",
    },
  });

  const onSubmit = (data: ReservationFormValues) => {
    if (editingReservation) {
      updateReservation.mutate(
        { id: editingReservation.id, data: { ...data, status: data.status || "pending" } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetReservationStatsQueryKey() });
            setSheetOpen(false);
            toast({ title: "Reservierung aktualisiert" });
          },
          onError: () => toast({ title: "Aktualisierung fehlgeschlagen", variant: "destructive" })
        }
      );
    } else {
      createReservation.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetReservationStatsQueryKey() });
            setSheetOpen(false);
            form.reset();
            toast({ title: "Reservierung erstellt" });
          },
          onError: () => toast({ title: "Erstellen fehlgeschlagen", variant: "destructive" })
        }
      );
    }
  };

  const handleEdit = (res: Reservation) => {
    setEditingReservation(res);
    form.reset({
      customerName: res.customerName,
      customerEmail: res.customerEmail || "",
      customerPhone: res.customerPhone,
      date: res.date,
      time: res.time,
      partySize: res.partySize,
      tableNumber: res.tableNumber,
      notes: res.notes,
      source: res.source as "direct" | "online" | "phone" | "walkin",
      status: res.status as "pending" | "confirmed" | "seated" | "completed" | "cancelled",
    });
    setSheetOpen(true);
  };

  const handleStatusChange = (id: number, status: "pending" | "confirmed" | "seated" | "completed" | "cancelled") => {
    const res = reservations?.find(r => r.id === id);
    if (!res) return;
    
    updateReservation.mutate(
      { id, data: { ...res, status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetReservationStatsQueryKey() });
          toast({ title: `Status auf "${statusLabels[status]}" gesetzt` });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Möchten Sie diese Reservierung wirklich löschen?")) {
      deleteReservation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetReservationStatsQueryKey() });
            toast({ title: "Reservierung gelöscht" });
          }
        }
      );
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reservierungen</h2>
          <p className="text-muted-foreground mt-2">Tische und Buchungen verwalten.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setMainTab("reservations")}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${mainTab === "reservations" ? "bg-primary text-white shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              Reservierungen
            </button>
            <button
              onClick={() => { setMainTab("gruppenanfragen"); refetchGroupRequests(); }}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${mainTab === "gruppenanfragen" ? "bg-primary text-white shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              Gruppenanfragen
              {groupRequests.filter(r => r.status === "sent").length > 0 && (
                <span className="ml-1.5 bg-rose-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                  {groupRequests.filter(r => r.status === "sent").length}
                </span>
              )}
            </button>
          </div>
        </div>
        <Sheet open={sheetOpen} onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setEditingReservation(null);
            form.reset({ customerName: "", customerEmail: "", customerPhone: "", date: todayStr, time: "19:00", partySize: 2, source: "phone", status: "pending" });
          }
        }}>
          <SheetTrigger asChild>
            <Button size="lg" className="shadow-lg"><Plus className="mr-2 h-5 w-5" /> Neue Reservierung</Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-[500px] overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle>{editingReservation ? "Reservierung bearbeiten" : "Neue Reservierung"}</SheetTitle>
            </SheetHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name des Gastes</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefon</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-Mail (optional)</FormLabel>
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Datum</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Uhrzeit</FormLabel>
                        <FormControl><Input type="time" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="partySize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personenzahl</FormLabel>
                        <FormControl><Input type="number" min={1} max={20} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tableNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tischnr. (optional)</FormLabel>
                        <FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quelle</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Quelle wählen" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="phone">Telefon</SelectItem>
                            <SelectItem value="online">Online</SelectItem>
                            <SelectItem value="walkin">Walk-in</SelectItem>
                            <SelectItem value="direct">Direkt</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {editingReservation && (
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Status wählen" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pending">Ausstehend</SelectItem>
                              <SelectItem value="confirmed">Bestätigt</SelectItem>
                              <SelectItem value="seated">Platziert</SelectItem>
                              <SelectItem value="completed">Abgeschlossen</SelectItem>
                              <SelectItem value="cancelled">Storniert</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hinweise (optional)</FormLabel>
                      <FormControl><Textarea className="resize-none" {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full mt-6" disabled={createReservation.isPending || updateReservation.isPending}>
                  {editingReservation ? "Änderungen speichern" : "Reservierung erstellen"}
                </Button>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Heute gesamt</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingStats ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold">{stats?.todayTotal || 0}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ausstehend</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {loadingStats ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold text-amber-500">{stats?.todayPending || 0}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bestätigt</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              {loadingStats ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold text-indigo-500">{stats?.todayConfirmed || 0}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Platziert</CardTitle>
              <CheckSquare className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {loadingStats ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold text-emerald-500">{stats?.todaySeated || 0}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gäste gesamt</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loadingStats ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold">{stats?.totalCovers || 0}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {mainTab === "gruppenanfragen" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Gruppenanfragen</CardTitle>
              <p className="text-sm text-muted-foreground">Von Kunden per Gruppen-Essensplan gesendete Reservierungsanfragen.</p>
            </CardHeader>
            <CardContent>
              {groupRequests.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">Keine Gruppenanfragen vorhanden.</div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gruppe</TableHead>
                        <TableHead>Datum / Uhrzeit</TableHead>
                        <TableHead>Personen</TableHead>
                        <TableHead>Anfragesteller</TableHead>
                        <TableHead>Notiz</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupRequests.map((req: any) => {
                        const s = GRP_STATUS[req.status] ?? GRP_STATUS.planned;
                        return (
                          <TableRow key={req.id}>
                            <TableCell>
                              <div className="font-semibold text-sm leading-snug">{req.groupPlanTitle || "Gruppe"}</div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              <div>{new Date(req.requestedDate).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
                              <div className="text-muted-foreground">{req.requestedTime} Uhr</div>
                            </TableCell>
                            <TableCell className="text-sm">{req.partySize}</TableCell>
                            <TableCell className="text-sm">
                              <div>{req.organizerName || "—"}</div>
                              <div className="text-xs text-muted-foreground">{req.organizerEmail}</div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{req.note || "—"}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
                                {s.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {req.status === "sent" && (
                                  <>
                                    <Button size="sm" variant="outline"
                                      className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                                      disabled={updatingId !== null}
                                      onClick={() => updateGroupRequestStatus(req.id, "confirmed")}>
                                      {updatingId === req.id ? (
                                        <span className="flex items-center gap-1"><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> …</span>
                                      ) : "Bestätigen"}
                                    </Button>
                                    <Button size="sm" variant="outline"
                                      className="h-7 text-xs border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                                      disabled={updatingId !== null}
                                      onClick={() => updateGroupRequestStatus(req.id, "rejected")}>
                                      {updatingId === req.id ? (
                                        <span className="flex items-center gap-1"><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> …</span>
                                      ) : "Ablehnen"}
                                    </Button>
                                  </>
                                )}
                                {req.status === "confirmed" && (
                                  <Button size="sm" variant="ghost"
                                    className="h-7 text-xs text-muted-foreground disabled:opacity-60"
                                    disabled={updatingId !== null}
                                    onClick={() => updateGroupRequestStatus(req.id, "cancelled")}>
                                    {updatingId === req.id ? "…" : "Stornieren"}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {mainTab === "reservations" && (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
            <Tabs defaultValue="today" onValueChange={(v) => setDateFilter(v as any)} className="w-[400px]">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="today">Heute</TabsTrigger>
                <TabsTrigger value="week">Diese Woche</TabsTrigger>
                <TabsTrigger value="all">Alle</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="confirmed">Bestätigt</SelectItem>
                <SelectItem value="seated">Platziert</SelectItem>
                <SelectItem value="completed">Abgeschlossen</SelectItem>
                <SelectItem value="cancelled">Storniert</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loadingReservations ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Uhrzeit</TableHead>
                      <TableHead>Gast</TableHead>
                      <TableHead>Personen</TableHead>
                      <TableHead>Tisch</TableHead>
                      <TableHead>Quelle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations?.map((res) => (
                      <TableRow key={res.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {dateFilter !== "today" && <div className="text-xs text-muted-foreground">{res.date}</div>}
                          {res.time}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{res.customerName}</div>
                          <div className="text-xs text-muted-foreground">{res.customerPhone}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {res.partySize}
                          </div>
                        </TableCell>
                        <TableCell>
                          {res.tableNumber ? (
                            <Badge variant="outline">T{res.tableNumber}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{sourceLabels[res.source] ?? res.source}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[res.status as keyof typeof statusColors] || ''}>
                            {statusLabels[res.status] ?? res.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleStatusChange(res.id, "confirmed")}>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-indigo-500" /> Bestätigen
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(res.id, "seated")}>
                                <CheckSquare className="mr-2 h-4 w-4 text-emerald-500" /> Platzieren
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(res.id, "completed")}>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-slate-500" /> Abschließen
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(res.id, "cancelled")}>
                                <XCircle className="mr-2 h-4 w-4 text-rose-500" /> Stornieren
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(res)}>
                                <Pencil className="mr-2 h-4 w-4" /> Details bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(res.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!reservations?.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          Keine Reservierungen gefunden.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      )}
    </div>
  );
}
