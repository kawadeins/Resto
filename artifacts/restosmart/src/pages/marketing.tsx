import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDeals,
  getListDealsQueryKey,
  useGetActiveDiscountStatus,
  getGetActiveDiscountStatusQueryKey,
  useActivateFlashDeal,
  useCreateScheduledDeal,
  useToggleDeal,
  useDeleteDeal,
  useSendDiscountBlast,
  useListNotifications,
  getListNotificationsQueryKey,
  useGetSubscription,
  getGetSubscriptionQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Clock, Calendar, Bell, Trash2, Plus, Send, CheckCircle2, Tag, Lock } from "lucide-react";

const DAYS_OF_WEEK = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function ActiveDiscountBanner() {
  const { data: status } = useGetActiveDiscountStatus({
    query: {
      queryKey: getGetActiveDiscountStatusQueryKey(),
      refetchInterval: 30000,
    },
  });

  if (!status?.active) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
    >
      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
      <div className="flex-1">
        <span className="font-bold text-emerald-500">{status.label}</span>
        <span className="text-sm text-muted-foreground ml-2">
          {status.percentage}% Rabatt ist jetzt aktiv
        </span>
        {status.minutesRemaining != null && (
          <span className="ml-2 text-sm text-emerald-500 font-mono">
            ({status.minutesRemaining} Min. verbleibend)
          </span>
        )}
      </div>
      <Badge className="bg-emerald-500 text-white border-0 animate-pulse">
        LIVE
      </Badge>
    </motion.div>
  );
}

export default function Marketing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showScheduledForm, setShowScheduledForm] = useState(false);
  const [showBlastForm, setShowBlastForm] = useState(false);
  const [scheduledForm, setScheduledForm] = useState({
    label: "",
    percentage: 20,
    startTime: "14:00",
    endTime: "17:00",
    days: [] as string[],
    notes: "",
  });
  const [blastForm, setBlastForm] = useState({ title: "", message: "", targetCount: 0 });

  const { data: subscription } = useGetSubscription({
    query: { queryKey: getGetSubscriptionQueryKey() }
  });
  const isPro = subscription?.isActive === true && subscription?.status !== "trial";

  const { data: deals, isLoading: loadingDeals } = useListDeals({
    query: { queryKey: getListDealsQueryKey() },
  });

  const { data: notifications, isLoading: loadingNotifications } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey() },
  });

  const activateFlash = useActivateFlashDeal();
  const createScheduled = useCreateScheduledDeal();
  const toggleDeal = useToggleDeal();
  const deleteDeal = useDeleteDeal();
  const sendBlast = useSendDiscountBlast();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetActiveDiscountStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  };

  const handleFlashDeal = () => {
    activateFlash.mutate(
      { data: { label: "Flash Deal", percentage: 25 } },
      {
        onSuccess: () => {
          toast({ title: "Flash deal activated — 25% off for 30 minutes!" });
          refresh();
        },
        onError: () => toast({ title: "Failed to activate flash deal", variant: "destructive" }),
      }
    );
  };

  const handleCreateScheduled = () => {
    if (!scheduledForm.label || scheduledForm.days.length === 0) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createScheduled.mutate(
      {
        data: {
          label: scheduledForm.label,
          percentage: scheduledForm.percentage,
          startTime: scheduledForm.startTime,
          endTime: scheduledForm.endTime,
          days: scheduledForm.days,
          notes: scheduledForm.notes || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Scheduled deal created." });
          setShowScheduledForm(false);
          setScheduledForm({ label: "", percentage: 20, startTime: "14:00", endTime: "17:00", days: [], notes: "" });
          refresh();
        },
        onError: () => toast({ title: "Failed to create deal", variant: "destructive" }),
      }
    );
  };

  const handleToggle = (id: number, enabled: boolean) => {
    toggleDeal.mutate({ id, data: { enabled } }, {
      onSuccess: () => refresh(),
      onError: () => toast({ title: "Failed to update deal", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteDeal.mutate({ id }, {
      onSuccess: () => { toast({ title: "Deal removed." }); refresh(); },
      onError: () => toast({ title: "Failed to remove deal", variant: "destructive" }),
    });
  };

  const handleSendBlast = () => {
    if (!blastForm.title || !blastForm.message) {
      toast({ title: "Title and message are required", variant: "destructive" });
      return;
    }
    sendBlast.mutate(
      { data: { title: blastForm.title, message: blastForm.message, targetCount: blastForm.targetCount } },
      {
        onSuccess: () => {
          toast({ title: `Blast sent to ${blastForm.targetCount} customers.` });
          setShowBlastForm(false);
          setBlastForm({ title: "", message: "", targetCount: 0 });
          refresh();
        },
        onError: () => toast({ title: "Failed to send blast", variant: "destructive" }),
      }
    );
  };

  const scheduledDeals = deals?.filter((d) => d.type === "scheduled") ?? [];
  const flashDeals = deals?.filter((d) => d.type === "flash") ?? [];

  const toggleDay = (day: string) => {
    setScheduledForm((f) => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day],
    }));
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Marketing & Rabatte</h2>
          <p className="text-muted-foreground mt-2">
            Leere Tische und hungrige Gäste zusammenbringen.
          </p>
        </div>
      </div>

      <ActiveDiscountBanner />

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-1 relative">
          {!isPro && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-background/60 backdrop-blur-sm rounded-xl border border-border">
              <div className="bg-muted p-4 rounded-full mb-4">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Blitzangebote — Pro-Feature</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Upgraden Sie auf RestoSmart Business Premium, um Blitzangebote und Benachrichtigungen zu nutzen.
              </p>
              <Link href="/billing" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                Auf Pro upgraden
              </Link>
            </div>
          )}
          <Card className={`border-amber-500/20 bg-amber-500/5 h-full ${!isPro ? "opacity-50" : ""}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-500">
                <Zap className="h-5 w-5" />
                Blitzangebot
              </CardTitle>
              <CardDescription>
                Sofort 25% Rabatt für 30 Minuten aktivieren. Ideal für ruhige Zeiten.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-center">
                <div className="text-4xl font-black text-amber-500 mb-1">25%</div>
                <div className="text-sm text-muted-foreground">auf alle Gerichte</div>
                <div className="text-xs text-amber-500 mt-2 font-medium">Nur 30 Minuten</div>
              </div>
              <Button
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-base py-6"
                onClick={handleFlashDeal}
                disabled={activateFlash.isPending || !isPro}
              >
                <Zap className="mr-2 h-5 w-5" />
                {activateFlash.isPending ? "Aktiviere..." : "Blitzangebot jetzt aktivieren"}
              </Button>
              {flashDeals.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground font-medium">Letzte Blitzangebote</p>
                  {flashDeals.slice(0, 3).map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{d.label}</span>
                      {d.isFlashActive ? (
                        <Badge className="bg-emerald-500 text-white text-[10px] border-0 animate-pulse">LIVE</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Abgelaufen</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Geplante Angebote
                </CardTitle>
                <CardDescription>Wiederkehrende Rabatte an bestimmten Tagen und Zeiten.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowScheduledForm(true)}>
                <Plus className="mr-2 h-4 w-4" /> Angebot hinzufügen
              </Button>
            </CardHeader>
            <CardContent>
              {loadingDeals ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : scheduledDeals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Noch keine geplanten Angebote.</p>
                  <p className="text-sm mt-1">Erstellen Sie oben Ihren ersten wiederkehrenden Rabatt.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {scheduledDeals.map((deal) => (
                      <motion.div
                        key={deal.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{deal.label}</span>
                            <Badge
                              variant="outline"
                              className={deal.enabled ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : "text-muted-foreground"}
                            >
                              {deal.percentage}% off
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            <span>{deal.startTime} — {deal.endTime}</span>
                            <span className="text-border">|</span>
                            <span>{deal.days.join(", ")}</span>
                          </div>
                        </div>
                        <Switch
                          checked={deal.enabled}
                          onCheckedChange={(v) => handleToggle(deal.id, v)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-rose-500"
                          onClick={() => handleDelete(deal.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="relative">
        {!isPro && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl border border-border">
             <div className="bg-muted p-4 rounded-full mb-4">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Benachrichtigungen — Pro-Feature</h3>
              <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
                Upgraden Sie auf RestoSmart Business Premium, um Kunden direkt mit personalisierten Benachrichtigungen zu erreichen.
              </p>
              <Link href="/billing" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                Auf Pro upgraden
              </Link>
          </div>
        )}
        <Card className={!isPro ? "opacity-50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Benachrichtigungsversand
              </CardTitle>
              <CardDescription>
                Angebotsmeldungen an registrierte Kunden-App-Nutzer senden. Jede Sendung wird protokolliert.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setShowBlastForm(true)} disabled={!isPro}>
              <Bell className="mr-2 h-4 w-4" /> Senden
            </Button>
          </CardHeader>
          <CardContent>
            {loadingNotifications ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : notifications && notifications.length > 0 ? (
              <div className="space-y-2">
                {notifications.slice(0, 10).map((n) => (
                  <div key={n.id} className="flex items-start gap-4 p-3 rounded-lg border border-border/30 bg-muted/20">
                    <Bell className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{n.title}</span>
                        <Badge variant="outline" className="text-[10px]">{n.targetCount} recipients</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {new Date(n.sentAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Noch keine Benachrichtigungen gesendet. Erreichen Sie Ihre Kunden direkt.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={showScheduledForm} onOpenChange={setShowScheduledForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Geplantes Angebot erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Bezeichnung</Label>
              <Input
                placeholder="z.B. Montags-Mittagsspecial"
                value={scheduledForm.label}
                onChange={(e) => setScheduledForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rabatt (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={scheduledForm.percentage}
                onChange={(e) => setScheduledForm((f) => ({ ...f, percentage: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Startzeit</Label>
                <Input
                  type="time"
                  value={scheduledForm.startTime}
                  onChange={(e) => setScheduledForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Endzeit</Label>
                <Input
                  type="time"
                  value={scheduledForm.endTime}
                  onChange={(e) => setScheduledForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Wochentage</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      scheduledForm.days.includes(day)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notizen (optional)</Label>
              <Textarea
                placeholder="Interne Notizen..."
                rows={2}
                value={scheduledForm.notes}
                onChange={(e) => setScheduledForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduledForm(false)}>Abbrechen</Button>
            <Button onClick={handleCreateScheduled} disabled={createScheduled.isPending}>
              {createScheduled.isPending ? "Erstelle..." : "Angebot erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBlastForm} onOpenChange={setShowBlastForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Benachrichtigung senden</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Titel</Label>
              <Input
                placeholder="z.B. 25% Rabatt — Nur heute Abend!"
                value={blastForm.title}
                onChange={(e) => setBlastForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nachricht</Label>
              <Textarea
                placeholder="Zeigen Sie diese Nachricht beim Bezahlen für Ihren Rabatt..."
                rows={3}
                value={blastForm.message}
                onChange={(e) => setBlastForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Geschätzte Empfänger</Label>
              <Input
                type="number"
                min={0}
                value={blastForm.targetCount}
                onChange={(e) => setBlastForm((f) => ({ ...f, targetCount: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlastForm(false)}>Abbrechen</Button>
            <Button onClick={handleSendBlast} disabled={sendBlast.isPending}>
              <Send className="mr-2 h-4 w-4" />
              {sendBlast.isPending ? "Wird gesendet..." : "Senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
