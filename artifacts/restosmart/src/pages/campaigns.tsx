import { useState } from "react";
import {
  useGetRetentionMetrics,
  getGetRetentionMetricsQueryKey,
  useGetCampaignSegments,
  getGetCampaignSegmentsQueryKey,
  useListCampaigns,
  getListCampaignsQueryKey,
  useCreateCampaign,
  useLaunchCampaign,
  useGetCampaignSends,
  getGetCampaignSendsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Star,
  RefreshCw,
  Send,
  Zap,
  Heart,
  Gift,
  ShieldCheck,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  BarChart3,
  Target,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ────────────────────────────────────────────────────────────────────
type CampaignType = "win_back" | "thank_you" | "flash_blast" | "loyalty_reward";
type SegmentKey = "inactive" | "new" | "returning" | "high_value" | "all";

interface CampaignTemplate {
  type: CampaignType;
  label: string;
  description: string;
  icon: React.ElementType;
  targetSegment: SegmentKey;
  color: string;
  defaultMessage: string;
}

const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    type: "win_back",
    label: "Win-Back",
    description: "Re-engage customers who haven't visited in 45+ days",
    icon: RefreshCw,
    targetSegment: "inactive",
    color: "text-orange-400",
    defaultMessage:
      "We miss you! It's been a while since your last visit. As a valued guest, we'd love to welcome you back with a special offer exclusively for you.",
  },
  {
    type: "thank_you",
    label: "Post-Visit Thank You",
    description: "Thank returning customers and encourage reviews for bonus points",
    icon: Heart,
    targetSegment: "returning",
    color: "text-pink-400",
    defaultMessage:
      "Thank you for dining with us! We hope you had a wonderful experience. Leave us a review to earn 5 bonus loyalty points — and we can't wait to see you again.",
  },
  {
    type: "flash_blast",
    label: "Flash Deal Blast",
    description: "Blast an exclusive time-limited offer to all customers",
    icon: Zap,
    targetSegment: "all",
    color: "text-yellow-400",
    defaultMessage:
      "Exclusive offer alert! We're running a limited-time deal just for our valued customers. Book your table now before it expires — availability is limited!",
  },
  {
    type: "loyalty_reward",
    label: "Loyalty Reward Unlock",
    description: "Notify high-value guests about their tier status and rewards",
    icon: Gift,
    targetSegment: "high_value",
    color: "text-purple-400",
    defaultMessage:
      "Great news! You're making fantastic progress on your loyalty journey. Check your points — you might be just one visit away from unlocking your next exclusive reward.",
  },
];

const SEGMENT_LABELS: Record<SegmentKey | string, { label: string; color: string }> = {
  inactive: { label: "Inactive", color: "bg-orange-500/20 text-orange-400" },
  new: { label: "New", color: "bg-blue-500/20 text-blue-400" },
  returning: { label: "Returning", color: "bg-green-500/20 text-green-400" },
  high_value: { label: "High-Value", color: "bg-purple-500/20 text-purple-400" },
  all: { label: "All", color: "bg-muted text-muted-foreground" },
};

const TIER_COLORS: Record<string, string> = {
  Bronze: "text-amber-600",
  Silver: "text-slate-400",
  Gold: "text-yellow-400",
};

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  loading,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  loading?: boolean;
  highlight?: "good" | "warn" | "neutral";
}) {
  const ringColor =
    highlight === "good"
      ? "border-green-500/30"
      : highlight === "warn"
      ? "border-orange-500/30"
      : "border-border";

  return (
    <Card className={`bg-card border ${ringColor}`}>
      <CardContent className="pt-5 pb-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
              {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
            </div>
            <div className={`p-2 rounded-lg bg-muted/50 ${highlight === "good" ? "text-green-400" : highlight === "warn" ? "text-orange-400" : "text-muted-foreground"}`}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Segment Card ─────────────────────────────────────────────────────────────
function SegmentCard({
  segKey,
  data,
  loading,
}: {
  segKey: string;
  data?: { count: number; label: string; description: string; customers: Record<string, unknown>[] };
  loading?: boolean;
}) {
  const icons: Record<string, React.ElementType> = {
    new: Users,
    returning: RefreshCw,
    high_value: Star,
    inactive: AlertTriangle,
  };
  const Icon = icons[segKey] ?? Users;
  const seg = SEGMENT_LABELS[segKey];

  return (
    <Card className="bg-card border border-border">
      <CardContent className="pt-5 pb-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-40" />
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted/50">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{data?.label}</span>
                <Badge className={`text-[10px] px-1.5 py-0 ${seg?.color}`}>{data?.count ?? 0}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{data?.description}</p>
              {data && data.customers.length > 0 && (
                <div className="mt-2 space-y-1">
                  {(data.customers as Array<{ name: string; loyaltyPoints: number; tier: string; daysSinceLast?: number; bookingCount: number }>).slice(0, 3).map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[120px]">{c.name}</span>
                      <span className={`font-medium ${TIER_COLORS[c.tier] ?? "text-foreground"}`}>
                        {c.loyaltyPoints}pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Campaign Sends Drawer ────────────────────────────────────────────────────
function CampaignSendsModal({ campaignId, onClose }: { campaignId: number; onClose: () => void }) {
  const { data: sends, isLoading } = useGetCampaignSends(
    { id: campaignId },
    { query: { queryKey: getGetCampaignSendsQueryKey({ id: campaignId }) } }
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>Delivery Log</DialogTitle>
          <DialogDescription>All recipients for this campaign</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2 py-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left">
                  <th className="pb-2 text-muted-foreground font-medium text-xs uppercase pr-4">Customer</th>
                  <th className="pb-2 text-muted-foreground font-medium text-xs uppercase pr-4">Segment</th>
                  <th className="pb-2 text-muted-foreground font-medium text-xs uppercase pr-4">Status</th>
                  <th className="pb-2 text-muted-foreground font-medium text-xs uppercase">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(sends ?? []).map((s) => (
                  <tr key={s.id} className="py-2">
                    <td className="py-2 pr-4">
                      <p className="font-medium text-foreground">{s.customerName}</p>
                      <p className="text-xs text-muted-foreground">{s.customerEmail}</p>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge className={`text-xs ${SEGMENT_LABELS[s.segment]?.color}`}>{s.segment}</Badge>
                    </td>
                    <td className="py-2 pr-4">
                      {s.status === "converted" ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle2 className="h-3 w-3" />Converted</span>
                      ) : s.status === "bounced" ? (
                        <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="h-3 w-3" />Bounced</span>
                      ) : (
                        <span className="flex items-center gap-1 text-blue-400 text-xs"><Send className="h-3 w-3" />Sent</span>
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground text-xs">
                      {new Date(s.sentAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {(!sends || sends.length === 0) && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">No delivery records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Campaign Modal ────────────────────────────────────────────────────
function CreateCampaignModal({
  template,
  segmentCounts,
  onClose,
  onCreated,
}: {
  template: CampaignTemplate;
  segmentCounts: Record<string, number>;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [message, setMessage] = useState(template.defaultMessage);
  const [name, setName] = useState(`${template.label} — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
  const { toast } = useToast();
  const createCampaign = useCreateCampaign();
  const launchCampaign = useLaunchCampaign();
  const qc = useQueryClient();

  const targetCount =
    template.targetSegment === "all"
      ? Object.values(segmentCounts).reduce((a, b) => a + b, 0)
      : segmentCounts[template.targetSegment] ?? 0;

  const Icon = template.icon;

  async function handleLaunch() {
    if (targetCount === 0) {
      toast({ title: "No customers in this segment", description: "Add more customers to launch this campaign.", variant: "destructive" });
      return;
    }
    try {
      const created = await createCampaign.mutateAsync({
        data: {
          type: template.type,
          name,
          targetSegment: template.targetSegment,
          messageTemplate: message,
        },
      });
      await launchCampaign.mutateAsync({ id: created.id });
      await qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
      toast({ title: "Campaign launched!", description: `Sent to ${targetCount} customers.` });
      onCreated(created.id);
      onClose();
    } catch {
      toast({ title: "Failed to launch campaign", variant: "destructive" });
    }
  }

  const isLoading = createCampaign.isPending || launchCampaign.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${template.color}`} />
            {template.label} Campaign
          </DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Target audience preview */}
          <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Target audience</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={SEGMENT_LABELS[template.targetSegment]?.color}>
                {template.targetSegment === "all" ? "All customers" : SEGMENT_LABELS[template.targetSegment]?.label}
              </Badge>
              <span className="text-sm font-bold text-foreground">{targetCount} recipients</span>
            </div>
          </div>

          {/* Campaign name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Campaign Name</Label>
            <input
              className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Message preview */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Message Preview</Label>
            <Textarea
              className="bg-muted/30 border border-border text-sm text-foreground resize-none min-h-[100px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">This message will be sent to all recipients in the selected segment.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleLaunch}
              disabled={isLoading || targetCount === 0}
            >
              <Send className="h-4 w-4" />
              {isLoading ? "Launching..." : `Launch to ${targetCount} customers`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Campaigns() {
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);
  const [viewingSendsId, setViewingSendsId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: retention, isLoading: loadingRetention } = useGetRetentionMetrics({
    query: { queryKey: getGetRetentionMetricsQueryKey() },
  });

  const { data: segments, isLoading: loadingSegments } = useGetCampaignSegments({
    query: { queryKey: getGetCampaignSegmentsQueryKey() },
  });

  const { data: campaigns, isLoading: loadingCampaigns } = useListCampaigns({
    query: { queryKey: getListCampaignsQueryKey() },
  });

  const segmentCounts: Record<string, number> = {
    new: segments?.segments?.new?.count ?? 0,
    returning: segments?.segments?.returning?.count ?? 0,
    high_value: segments?.segments?.high_value?.count ?? 0,
    inactive: segments?.segments?.inactive?.count ?? 0,
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Growth Hub</h1>
        <p className="text-muted-foreground mt-1">
          Bring customers back and increase repeat visits with targeted campaigns.
        </p>
      </div>

      {/* Retention Metrics */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Retention Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            label="Repeat Rate"
            value={loadingRetention ? "..." : `${retention?.repeatRate ?? 0}%`}
            sub="of customers returned"
            icon={TrendingUp}
            loading={loadingRetention}
            highlight={(retention?.repeatRate ?? 0) >= 40 ? "good" : "warn"}
          />
          <MetricCard
            label="Repeat Customers"
            value={loadingRetention ? "..." : retention?.repeatCustomers ?? 0}
            sub="2+ bookings"
            icon={Users}
            loading={loadingRetention}
            highlight="neutral"
          />
          <MetricCard
            label="Inactive"
            value={loadingRetention ? "..." : retention?.inactiveCount ?? 0}
            sub="45+ days away"
            icon={AlertTriangle}
            loading={loadingRetention}
            highlight={(retention?.inactiveCount ?? 0) > 5 ? "warn" : "good"}
          />
          <MetricCard
            label="At Risk"
            value={loadingRetention ? "..." : retention?.atRiskCount ?? 0}
            sub="21–44 days away"
            icon={Clock}
            loading={loadingRetention}
            highlight={(retention?.atRiskCount ?? 0) > 3 ? "warn" : "neutral"}
          />
          <MetricCard
            label="High-Value"
            value={loadingRetention ? "..." : retention?.highValueCount ?? 0}
            sub="VIP guests"
            icon={Star}
            loading={loadingRetention}
            highlight="good"
          />
          <MetricCard
            label="Campaign Bookings"
            value={loadingRetention ? "..." : retention?.campaignDrivenBookings ?? 0}
            sub="last 30 days"
            icon={BarChart3}
            loading={loadingRetention}
            highlight={(retention?.campaignDrivenBookings ?? 0) > 0 ? "good" : "neutral"}
          />
        </div>
      </section>

      {/* Segments + Top Customers */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Segments */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Customer Segments
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {(["new", "returning", "high_value", "inactive"] as const).map((key) => (
              <SegmentCard
                key={key}
                segKey={key}
                data={segments?.segments?.[key] as any}
                loading={loadingSegments}
              />
            ))}
          </div>
        </div>

        {/* Top Returning Customers */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Top Returning Guests
          </h2>
          <Card className="bg-card border border-border">
            <CardContent className="pt-4 pb-3">
              {loadingRetention ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {(retention?.topCustomers ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No returning customers yet</p>
                  )}
                  {(retention?.topCustomers ?? []).map((c, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.arrivedCount} visits · {c.loyaltyPoints}pts</p>
                      </div>
                      <Badge className={`text-[10px] shrink-0 ${TIER_COLORS[c.tier] ? "" : ""} ${SEGMENT_LABELS[c.segment]?.color}`}>
                        {c.tier}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Campaign Launcher */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Launch a Campaign
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CAMPAIGN_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            const count =
              tpl.targetSegment === "all"
                ? Object.values(segmentCounts).reduce((a, b) => a + b, 0)
                : segmentCounts[tpl.targetSegment] ?? 0;

            return (
              <button
                key={tpl.type}
                onClick={() => setSelectedTemplate(tpl)}
                className="text-left group rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-all p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-lg bg-muted/50 ${tpl.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors mt-1" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{tpl.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tpl.description}</p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <Badge className={`text-[10px] ${SEGMENT_LABELS[tpl.targetSegment]?.color}`}>
                    {tpl.targetSegment === "all" ? "All segments" : SEGMENT_LABELS[tpl.targetSegment]?.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{count} recipients</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Campaign History */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Campaign History
        </h2>
        <Card className="bg-card border border-border">
          <CardContent className="pt-4 pb-3">
            {loadingCampaigns ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : !campaigns || campaigns.length === 0 ? (
              <div className="py-12 text-center">
                <Send className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No campaigns yet</p>
                <p className="text-xs text-muted-foreground mt-1">Launch your first campaign above to start bringing customers back.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 text-muted-foreground font-medium text-xs uppercase pr-6">Campaign</th>
                      <th className="pb-3 text-muted-foreground font-medium text-xs uppercase pr-6">Segment</th>
                      <th className="pb-3 text-muted-foreground font-medium text-xs uppercase pr-6">Status</th>
                      <th className="pb-3 text-muted-foreground font-medium text-xs uppercase pr-6">Sent</th>
                      <th className="pb-3 text-muted-foreground font-medium text-xs uppercase pr-6">Converted</th>
                      <th className="pb-3 text-muted-foreground font-medium text-xs uppercase pr-6">Rate</th>
                      <th className="pb-3 text-muted-foreground font-medium text-xs uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 pr-6">
                          <p className="font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{c.type.replace("_", " ")}</p>
                        </td>
                        <td className="py-3 pr-6">
                          <Badge className={`text-xs ${SEGMENT_LABELS[c.targetSegment]?.color}`}>
                            {SEGMENT_LABELS[c.targetSegment]?.label ?? c.targetSegment}
                          </Badge>
                        </td>
                        <td className="py-3 pr-6">
                          {c.status === "sent" || c.status === "completed" ? (
                            <span className="flex items-center gap-1 text-green-400 text-xs">
                              <CheckCircle2 className="h-3 w-3" />Sent
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground text-xs">
                              <Clock className="h-3 w-3" />Draft
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-6 text-foreground font-medium">{c.totalSent}</td>
                        <td className="py-3 pr-6 text-green-400 font-medium">{c.totalConverted}</td>
                        <td className="py-3 pr-6 text-muted-foreground">
                          {c.totalSent > 0 ? `${Math.round(((c.totalConverted ?? 0) / c.totalSent) * 100)}%` : "—"}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              {c.sentAt ? new Date(c.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                            </span>
                            {c.status !== "draft" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => setViewingSendsId(c.id)}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Modals */}
      {selectedTemplate && (
        <CreateCampaignModal
          template={selectedTemplate}
          segmentCounts={segmentCounts}
          onClose={() => setSelectedTemplate(null)}
          onCreated={(id) => setViewingSendsId(id)}
        />
      )}
      {viewingSendsId !== null && (
        <CampaignSendsModal
          campaignId={viewingSendsId}
          onClose={() => setViewingSendsId(null)}
        />
      )}
    </div>
  );
}
