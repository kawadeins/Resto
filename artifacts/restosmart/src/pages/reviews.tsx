import { useState } from "react";
import { useListReviews, getListReviewsQueryKey, useGetReviewStats, getGetReviewStatsQueryKey, useReplyToReview } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Star, StarHalf, MessageSquare, MessageCircleReply, User } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

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

  const { data: stats, isLoading: loadingStats } = useGetReviewStats({}, {
    query: { queryKey: getGetReviewStatsQueryKey() }
  });

  const { data: reviews, isLoading: loadingReviews } = useListReviews({}, {
    query: { queryKey: getListReviewsQueryKey() }
  });

  const replyMutation = useReplyToReview();

  const handleReply = (id: number) => {
    if (!replyText.trim()) return;
    replyMutation.mutate(
      { id, data: { reply: replyText } },
      {
        onSuccess: () => {
          toast({ title: "Reply posted successfully" });
          setReplyingTo(null);
          setReplyText("");
          queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetReviewStatsQueryKey() });
        },
        onError: () => toast({ title: "Failed to post reply", variant: "destructive" })
      }
    );
  };

  const responseRate = reviews && reviews.length > 0 
    ? (reviews.filter(r => r.ownerReply).length / reviews.length) * 100 
    : 0;

  const distributionData = [5, 4, 3, 2, 1].map(stars => ({
    stars: `${stars} Stars`,
    count: (stats?.distribution as Record<string, number>)?.[stars.toString()] || 0
  }));

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Customer Reviews</h2>
        <p className="text-muted-foreground mt-2">Monitor feedback and engage with your customers.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalCount || 0}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Across all time
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold flex items-center gap-2">
                {stats?.averageRating?.toFixed(1) || "0.0"}
                <StarRating rating={stats?.averageRating || 0} />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Based on {stats?.totalCount || 0} reviews
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Response Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{responseRate.toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <MessageCircleReply className="w-3 h-3" />
                Of all reviews replied to
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <motion.div className="lg:col-span-1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Rating Distribution</CardTitle>
              <CardDescription>Breakdown by stars</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="stars" type="category" axisLine={false} tickLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" width={60} />
                    <Tooltip 
                      cursor={{fill: 'hsl(var(--muted))', opacity: 0.2}}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index < 2 ? "hsl(142, 71%, 45%)" : index === 2 ? "hsl(37, 91%, 55%)" : "hsl(346, 84%, 61%)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div className="lg:col-span-2 space-y-4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
          <h3 className="font-semibold text-lg px-1">Recent Reviews</h3>
          
          {loadingReviews ? (
            <div className="p-8 text-center text-muted-foreground">Loading reviews...</div>
          ) : !reviews?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                <p>No reviews yet.</p>
              </CardContent>
            </Card>
          ) : (
            reviews.map((review) => (
              <Card key={review.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3">
                      <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center text-primary font-semibold">
                        {review.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{review.customerName}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
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
                        Owner Reply
                        <span className="text-muted-foreground font-normal ml-auto">
                          {review.ownerRepliedAt ? new Date(review.ownerRepliedAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.ownerReply}</p>
                    </div>
                  ) : replyingTo === review.id ? (
                    <div className="mt-4 space-y-3">
                      <Textarea 
                        placeholder="Write your reply..." 
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="min-h-[100px]"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => { setReplyingTo(null); setReplyText(""); }}>Cancel</Button>
                        <Button size="sm" onClick={() => handleReply(review.id)} disabled={replyMutation.isPending || !replyText.trim()}>
                          {replyMutation.isPending ? "Posting..." : "Post Reply"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => { setReplyingTo(review.id); setReplyText(""); }}>
                      <MessageCircleReply className="w-4 h-4 mr-2" />
                      Reply
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