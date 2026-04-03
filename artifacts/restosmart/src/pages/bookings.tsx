import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListReservations,
  getListReservationsQueryKey,
  usePatchReservationStatus,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Users, Clock, MessageSquare, CheckCircle2, XCircle, ChevronRight, Search } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Ausstehend", className: "text-amber-500 border-amber-500/30 bg-amber-500/5" },
  confirmed: { label: "Bestätigt", className: "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" },
  rejected: { label: "Abgelehnt", className: "text-rose-500 border-rose-500/30 bg-rose-500/5" },
  arrived: { label: "Eingetroffen", className: "text-blue-500 border-blue-500/30 bg-blue-500/5" },
  cancelled: { label: "Storniert", className: "text-muted-foreground border-border bg-muted/20" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <Badge variant="outline" className={`text-xs ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
}

export default function Bookings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);

  const params = dateFilter ? { date: dateFilter } : {};
  const { data: reservations, isLoading } = useListReservations({
    params,
    query: { queryKey: getListReservationsQueryKey(params), refetchInterval: 30000 },
  });

  const patchStatus = usePatchReservationStatus();

  const handleStatusChange = (id: number, status: "confirmed" | "rejected" | "arrived" | "cancelled" | "pending") => {
    patchStatus.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({ title: `Buchung als "${STATUS_CONFIG[status]?.label ?? status}" markiert.` });
          queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey(params) });
        },
        onError: () => toast({ title: "Buchung konnte nicht aktualisiert werden", variant: "destructive" }),
      }
    );
  };

  const filtered = reservations?.filter((r) => {
    const matchesSearch =
      !search ||
      r.customerName.toLowerCase().includes(search.toLowerCase()) ||
      r.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      r.customerPhone.includes(search);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) ?? [];

  const confirmed = filtered.filter((r) => r.status === "confirmed" || r.status === "arrived");
  const totalCoversConfirmed = confirmed.reduce((sum, r) => sum + r.partySize, 0);
  const expectedRevenue = totalCoversConfirmed * 35;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const twoHoursLater = nowMin + 120;
  const liveTraffic = filtered.filter((r) => {
    if (r.status === "rejected" || r.status === "cancelled") return false;
    const [h, m] = r.time.split(":").map(Number);
    const min = h * 60 + (m || 0);
    return min >= nowMin && min <= twoHoursLater;
  }).length;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Buchungen</h2>
        <p className="text-muted-foreground mt-2">
          Reservierungen verwalten, Ankünfte bestätigen und erwartete Gäste verfolgen.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Buchungen gesamt</p>
                  <p className="text-2xl font-bold mt-1">{filtered.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">für ausgewähltes Datum</p>
                </div>
                <Calendar className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Erwarteter Umsatz</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-500">
                    {expectedRevenue.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalCoversConfirmed} bestätigte Gäste
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Live-Verkehr</p>
                  <p className="text-2xl font-bold mt-1 text-blue-500">{liveTraffic}</p>
                  <p className="text-xs text-muted-foreground mt-1">Buchungen in den nächsten 2 Std.</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <CardTitle>Reservierungsübersicht</CardTitle>
              <CardDescription>Bestätigen, ablehnen oder Gäste als eingetroffen markieren.</CardDescription>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nach Name suchen..."
                  className="pl-9 w-48"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Input
                type="date"
                className="w-40"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="pending">Ausstehend</SelectItem>
                  <SelectItem value="confirmed">Bestätigt</SelectItem>
                  <SelectItem value="arrived">Eingetroffen</SelectItem>
                  <SelectItem value="rejected">Abgelehnt</SelectItem>
                  <SelectItem value="cancelled">Storniert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Keine Buchungen gefunden</p>
              <p className="text-sm mt-1">Datum oder Statusfilter anpassen.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {filtered.map((r) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-4 p-4 rounded-lg border border-border/40 bg-card/50 hover:bg-card/80 transition-colors"
                  >
                    <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <p className="font-semibold text-sm">{r.customerName}</p>
                        <p className="text-xs text-muted-foreground">{r.customerPhone}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span>{r.partySize} Gäste</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span>{formatDate(r.date)} um {r.time} Uhr</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {r.notes ? (
                          <>
                            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{r.notes}</span>
                          </>
                        ) : (
                          <span className="italic opacity-50">Keine besonderen Wünsche</span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {r.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 px-3 text-xs"
                            onClick={() => handleStatusChange(r.id, "confirmed")}
                            disabled={patchStatus.isPending}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Bestätigen
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10 h-8 px-3 text-xs"
                            onClick={() => handleStatusChange(r.id, "rejected")}
                            disabled={patchStatus.isPending}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Ablehnen
                          </Button>
                        </>
                      )}
                      {r.status === "confirmed" && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-500 text-white h-8 px-3 text-xs"
                          onClick={() => handleStatusChange(r.id, "arrived")}
                          disabled={patchStatus.isPending}
                        >
                          <ChevronRight className="h-3.5 w-3.5 mr-1" /> Eingetroffen
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
