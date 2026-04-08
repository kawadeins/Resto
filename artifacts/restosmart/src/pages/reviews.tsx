import { useState } from "react";
import { useListReviews, getListReviewsQueryKey, useGetReviewStats, getGetReviewStatsQueryKey, useReplyToReview } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, StarHalf, MessageSquare, MessageCircleReply, User,
  TrendingUp, TrendingDown, Minus, AlertTriangle, Send, Mail, RefreshCw,
  Sparkles, ShieldAlert, ChevronDown, ChevronUp, Loader2, CheckCircle2
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type FilterTab = "all" | "needs_attention" | "unreplied" | "positive";

interface RecoveryReview {
  id: number;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  recoveryMessage: string | null;
  businessResponse: string | null;
  aiReplySuggestion: string | null;
}

interface ReviewInsights {
  totalCount: number;
  averageRating: number | null;
  replyRate: number;
  repliedCount: number;
  unrepliedCount: number;
  recentCount: number;
  recentAvg: number | null;
  previousAvg: number | null;
  trend: "up" | "down" | "stable" | "new";
  distribution: Record<string, number>;
  needsAttention: RecoveryReview[];
  pendingRecovery: RecoveryReview[];
  pendingRecoveryCount: number;
}

interface PendingRequest {
  id: number;
  customerName: string;
  customerEmail: string;
  date: string;
  time: string;
  partySize: number;
  status: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star}>
          {rating >= star ? (
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          ) : rating >= star - 0.5 ? (
            <StarHalf className="w-4 h-4 fill-amber-400 text-amber-400" />
          ) : (
            <Star className="w-4 h-4 text-muted" />
          )}
        </span>
      ))}
    </div>
  );
}

export default function Reviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showRecoverySection, setShowRecoverySection] = useState(true);
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [responseText, setResponseText] = useState<Record<number, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<number, boolean>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Record<number, string>>({});

  const { data: reviews, isLoading: loadingReviews } = useListReviews({}, {
    query: { queryKey: getListReviewsQueryKey() }
  });

  const { data: insights, isLoading: loadingInsights } = useQuery<ReviewInsights>({
    queryKey: ["review-insights"],
    queryFn: () => fetch(`${API_BASE}/api/reviews/insights`).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const { data: pendingRequests, isLoading: loadingPending } = useQuery<PendingRequest[]>({
    queryKey: ["review-pending-requests"],
    queryFn: () => fetch(`${API_BASE}/api/reviews/pending-requests`).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const replyMutation = useReplyToReview();

  const sendRequestMutation = useMutation({
    mutationFn: (reservationId: number) =>
      fetch(`${API_BASE}/api/reviews/send-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      }).then(r => r.json()),
    onSuccess: (_, reservationId) => {
      toast({ title: "Bewertungsanfrage erfolgreich gesendet" });
      queryClient.invalidateQueries({ queryKey: ["review-pending-requests"] });
    },
    onError: () => toast({ title: "Bewertungsanfrage konnte nicht gesendet werden", variant: "destructive" }),
  });

  const ratingSyncMutation = useMutation({
    mutationFn: () =>
      fetch(`${API_BASE}/api/reviews/rating-sync`, { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.skipped) {
        toast({ title: "Keine Bewertungen zum Synchronisieren" });
      } else {
        toast({ title: `Bewertung synchronisiert: ${data.averageRating} aus ${data.totalCount} Bewertungen` });
      }
      queryClient.invalidateQueries({ queryKey: getGetReviewStatsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["review-insights"] });
    },
    onError: () => toast({ title: "Bewertungssynchronisierung fehlgeschlagen", variant: "destructive" }),
  });

  const sendBusinessResponseMutation = useMutation({
    mutationFn: ({ id, response }: { id: number; response: string }) =>
      fetch(`${API_BASE}/api/reviews/${id}/business-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      }).then(r => r.json()),
    onSuccess: (_, { id }) => {
      toast({ title: "Antwort erfolgreich gesendet", description: "Der Gast wurde benachrichtigt." });
      setRespondingTo(null);
      setResponseText(prev => { const n = { ...prev }; delete n[id]; return n; });
      queryClient.invalidateQueries({ queryKey: ["review-insights"] });
      queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey() });
    },
    onError: () => toast({ title: "Antwort konnte nicht gesendet werden", variant: "destructive" }),
  });

  const fetchAiSuggestion = async (review: RecoveryReview) => {
    if (aiSuggestions[review.id]) {
      setResponseText(prev => ({ ...prev, [review.id]: aiSuggestions[review.id] }));
      setRespondingTo(review.id);
      return;
    }
    setAiLoading(prev => ({ ...prev, [review.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/reviews/${review.id}/ai-suggest`, { method: "POST" });
      const data = await res.json();
      const suggestion = data.suggestion ?? "";
      setAiSuggestions(prev => ({ ...prev, [review.id]: suggestion }));
      setResponseText(prev => ({ ...prev, [review.id]: suggestion }));
      setRespondingTo(review.id);
    } catch {
      toast({ title: "KI-Vorschlag nicht verf\u00FCgbar", variant: "destructive" });
    } finally {
      setAiLoading(prev => ({ ...prev, [review.id]: false }));
    }
  };

  const handleReply = (id: number) => {
    if (!replyText.trim()) return;
    replyMutation.mutate(
      { id, data: { reply: replyText } },
      {
        onSuccess: () => {
          toast({ title: "Antwort erfolgreich gesendet" });
          setReplyingTo(null);
          setReplyText("");
          queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["review-insights"] });
        },
        onError: () => toast({ title: "Antwort konnte nicht gesendet werden", variant: "destructive" })
      }
    );
  };

  const filteredReviews = (reviews ?? []).filter(r => {
    if (activeTab === "all") return true;
    if (activeTab === "needs_attention") return r.rating <= 3 && !r.ownerReply;
    if (activeTab === "unreplied") return !r.ownerReply;
    if (activeTab === "positive") return r.rating >= 4;
    return true;
  });

  const distributionData = [5, 4, 3, 2, 1].map(stars => ({
    stars: `${stars}★`,
    count: insights?.distribution?.[stars.toString()] ?? 0,
  }));

  const TrendIcon = insights?.trend === "up" ? TrendingUp :
    insights?.trend === "down" ? TrendingDown : Minus;
  const trendColor = insights?.trend === "up" ? "text-emerald-500" :
    insights?.trend === "down" ? "text-red-500" : "text-muted-foreground";

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: "Alle", count: reviews?.length },
    { key: "needs_attention", label: "Handlungsbedarf", count: insights?.needsAttention?.length },
    { key: "unreplied", label: "Ohne Antwort", count: insights?.unrepliedCount },
    { key: "positive", label: "Positiv (4–5)", count: reviews?.filter(r => r.rating >= 4).length },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bewertungen & Reputation</h2>
          <p className="text-muted-foreground mt-2">Feedback verwalten, Kunden antworten und Ihren Ruf im Blick behalten.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => ratingSyncMutation.mutate()}
          disabled={ratingSyncMutation.isPending}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${ratingSyncMutation.isPending ? "animate-spin" : ""}`} />
          Bewertung synchronisieren
        </Button>
      </div>

      {/* Insights KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bewertungen gesamt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{insights?.totalCount ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {insights?.recentCount ?? 0} in den letzten 30 Tagen
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Durchschnittsbewertung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold flex items-center gap-2">
                {insights?.averageRating?.toFixed(1) ?? "—"}
                {insights?.trend && <TrendIcon className={`w-5 h-5 ${trendColor}`} />}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {insights?.recentAvg ? `Letzte 30 Tage: ${insights.recentAvg.toFixed(1)}` : "Keine aktuellen Daten"}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Antwortrate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{insights?.replyRate ?? 0}%</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <MessageCircleReply className="w-3 h-3" />
                {insights?.repliedCount ?? 0} von {insights?.totalCount ?? 0} beantwortet
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className={insights?.needsAttention?.length ? "border-orange-500/40 bg-orange-500/5" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                {insights?.needsAttention?.length ? <AlertTriangle className="w-3 h-3 text-orange-500" /> : null}
                Handlungsbedarf
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${insights?.needsAttention?.length ? "text-orange-500" : ""}`}>
                {insights?.needsAttention?.length ?? 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Niedrige Bewertung, keine Antwort</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Kritisches Feedback (Recovery Queue) ── */}
      <AnimatePresence>
        {(insights?.pendingRecoveryCount ?? 0) > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ delay: 0.18 }}>
            <Card className="border-red-500/30 bg-red-500/5 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <ShieldAlert className="w-4.5 h-4.5 text-red-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        Kritisches Feedback
                        <Badge variant="destructive" className="text-xs h-5 px-1.5">
                          {insights!.pendingRecoveryCount}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-0.5">
                        {insights!.pendingRecoveryCount === 1
                          ? "1 Gast wartet auf Ihre Antwort — noch nicht ver\u00F6ffentlicht"
                          : `${insights!.pendingRecoveryCount} G\u00E4ste warten auf Ihre Antwort — noch nicht ver\u00F6ffentlicht`}
                      </CardDescription>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowRecoverySection(v => !v)}
                    className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground"
                  >
                    {showRecoverySection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </CardHeader>

              <AnimatePresence>
                {showRecoverySection && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="pt-0 space-y-4">
                      {(insights?.pendingRecovery ?? []).map(review => (
                        <div key={review.id} className="rounded-xl border border-border/50 bg-background p-4 space-y-3">
                          {/* Header row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3">
                              <div className="bg-red-100 dark:bg-red-900/30 w-9 h-9 rounded-full flex items-center justify-center text-red-600 font-semibold text-sm shrink-0">
                                {review.customerName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-sm">{review.customerName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(review.createdAt).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
                              ))}
                            </div>
                          </div>

                          {/* Customer message */}
                          <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Feedback des Gastes:</p>
                            <p className="text-sm leading-relaxed">{review.recoveryMessage ?? review.comment}</p>
                          </div>

                          {/* Response area */}
                          {respondingTo === review.id ? (
                            <div className="space-y-2">
                              {aiSuggestions[review.id] && responseText[review.id] === aiSuggestions[review.id] && (
                                <div className="flex items-center gap-1.5 text-xs text-violet-500 font-medium">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  KI-Vorschlag — bearbeite die Antwort nach Bedarf
                                </div>
                              )}
                              <Textarea
                                value={responseText[review.id] ?? ""}
                                onChange={e => setResponseText(prev => ({ ...prev, [review.id]: e.target.value }))}
                                placeholder="Ihre Antwort an den Gast\u2026"
                                className="min-h-[100px] text-sm"
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setRespondingTo(null); }}
                                >
                                  Abbrechen
                                </Button>
                                <Button
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => {
                                    const txt = responseText[review.id] ?? "";
                                    if (!txt.trim()) return;
                                    sendBusinessResponseMutation.mutate({ id: review.id, response: txt });
                                  }}
                                  disabled={sendBusinessResponseMutation.isPending || !responseText[review.id]?.trim()}
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  {sendBusinessResponseMutation.isPending ? "Wird gesendet\u2026" : "Antwort senden"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white border-none"
                                onClick={() => fetchAiSuggestion(review)}
                                disabled={aiLoading[review.id]}
                              >
                                {aiLoading[review.id] ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5" />
                                )}
                                Antwort vorschlagen
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => {
                                  setRespondingTo(review.id);
                                  if (!responseText[review.id]) setResponseText(prev => ({ ...prev, [review.id]: "" }));
                                }}
                              >
                                <MessageCircleReply className="w-3.5 h-3.5" />
                                Manuell antworten
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending review requests */}
      {(pendingRequests ?? []).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    Ausstehende Bewertungsanfragen
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    {pendingRequests!.length} kürzlich abgeschlossene{pendingRequests!.length !== 1 ? " Besuche" : "r Besuch"} ohne Bewertungsanfrage
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingRequests!.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border/50">
                    <div>
                      <div className="font-medium text-sm">{r.customerName}</div>
                      <div className="text-xs text-muted-foreground">{r.date} um {r.time} · {r.partySize} Personen</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 h-8"
                      onClick={() => sendRequestMutation.mutate(r.id)}
                      disabled={sendRequestMutation.isPending}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Anfrage senden
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main grid: chart + reviews */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: distribution chart */}
        <motion.div className="lg:col-span-1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Bewertungsverteilung</CardTitle>
              <CardDescription>Aufschlüsselung nach Sternebewertung</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="stars" type="category" axisLine={false} tickLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" width={32} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {distributionData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index < 2 ? "hsl(142, 71%, 45%)" : index === 2 ? "hsl(37, 91%, 55%)" : "hsl(346, 84%, 61%)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Trend summary */}
              {insights?.recentAvg !== null && insights?.previousAvg !== null && (
                <div className={`mt-4 text-sm flex items-center gap-2 font-medium ${trendColor}`}>
                  <TrendIcon className="w-4 h-4" />
                  {insights?.trend === "up" && "Bewertung steigt im Vergleich zum Vormonat"}
                  {insights?.trend === "down" && "Bewertung sinkt im Vergleich zum Vormonat"}
                  {insights?.trend === "stable" && "Bewertung stabil im Vergleich zum Vormonat"}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right: filter tabs + reviews list */}
        <motion.div className="lg:col-span-2 space-y-4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <Badge
                    variant="secondary"
                    className={`text-xs h-5 min-w-[20px] px-1 ${
                      activeTab === tab.key ? "bg-primary-foreground/20 text-primary-foreground" : ""
                    } ${tab.key === "needs_attention" && tab.count > 0 ? "bg-orange-500/20 text-orange-600" : ""}`}
                  >
                    {tab.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {loadingReviews ? (
            <div className="p-8 text-center text-muted-foreground">Bewertungen werden geladen…</div>
          ) : filteredReviews.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                <p>{activeTab === "all" ? "Noch keine Bewertungen." : "Keine Bewertungen in dieser Kategorie."}</p>
              </CardContent>
            </Card>
          ) : (
            filteredReviews.map((review) => (
              <Card key={review.id} className={`overflow-hidden transition-colors ${review.rating <= 3 && !review.ownerReply ? "border-orange-500/30" : ""}`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3">
                      <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center text-primary font-semibold shrink-0">
                        {review.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {review.customerName}
                          {review.rating <= 3 && !review.ownerReply && (
                            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" })}
                        </div>
                      </div>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>

                  <p className="text-sm mb-4 leading-relaxed">{review.comment}</p>

                  {review.ownerReply ? (
                    <div className="bg-muted/30 border border-border/50 rounded-lg p-4 ml-4 mt-4 relative">
                      <div className="absolute -left-[17px] top-4 w-4 h-px bg-border/50" />
                      <div className="absolute -left-[17px] top-0 bottom-4 w-px bg-border/50" />
                      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-primary">
                        <User className="w-3 h-3" />
                        Antwort des Inhabers
                        <span className="text-muted-foreground font-normal ml-auto">
                          {review.ownerRepliedAt ? new Date(review.ownerRepliedAt).toLocaleDateString("de-DE") : ""}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.ownerReply}</p>
                    </div>
                  ) : replyingTo === review.id ? (
                    <div className="mt-4 space-y-3">
                      <Textarea
                        placeholder="Ihre Antwort eingeben…"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="min-h-[100px]"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => { setReplyingTo(null); setReplyText(""); }}>Abbrechen</Button>
                        <Button size="sm" onClick={() => handleReply(review.id)} disabled={replyMutation.isPending || !replyText.trim()}>
                          {replyMutation.isPending ? "Wird gesendet…" : "Antwort senden"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant={review.rating <= 3 ? "default" : "outline"}
                      size="sm"
                      className={`mt-2 ${review.rating <= 3 ? "bg-orange-500 hover:bg-orange-600 text-white border-none" : ""}`}
                      onClick={() => { setReplyingTo(review.id); setReplyText(""); }}
                    >
                      <MessageCircleReply className="w-4 h-4 mr-2" />
                      {review.rating <= 3 ? "Jetzt antworten" : "Antworten"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </motion.div>
      </div>
    </div>
  );
}
