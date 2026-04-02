import { useEffect } from "react";
import { useGetFinancesSummary, getGetFinancesSummaryQueryKey, useGetDiscount, getGetDiscountQueryKey, useUpdateDiscount } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Percent, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function Finances() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: loadingSummary } = useGetFinancesSummary({
    query: { queryKey: getGetFinancesSummaryQueryKey() }
  });

  const { data: discountSettings, isLoading: loadingDiscount } = useGetDiscount({
    query: { queryKey: getGetDiscountQueryKey() }
  });

  const updateDiscount = useUpdateDiscount();

  const form = useForm({
    defaultValues: {
      enabled: false,
      percentage: 10,
      startTime: "14:00",
      endTime: "17:00",
      days: [] as string[],
    }
  });

  // Init form with server data
  useEffect(() => {
    if (discountSettings) {
      form.reset({
        enabled: discountSettings.enabled,
        percentage: discountSettings.percentage,
        startTime: discountSettings.startTime,
        endTime: discountSettings.endTime,
        days: discountSettings.days,
      });
    }
  }, [discountSettings, form]);

  const onDiscountSubmit = (data: any) => {
    updateDiscount.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDiscountQueryKey() });
          toast({ title: "Smart Discount settings updated" });
        },
        onError: () => toast({ title: "Failed to update settings", variant: "destructive" })
      }
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Finances & Strategy</h2>
        <p className="text-muted-foreground mt-2">Revenue analytics and smart promotional tools.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue YTD</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-[120px]" /> : (
                <div className="text-2xl font-bold text-emerald-500">
                  ${summary?.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit YTD</CardTitle>
              <TrendingUp className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-[120px]" /> : (
                <div className="text-2xl font-bold">
                  ${summary?.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Profit Margin</CardTitle>
              <Percent className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-[80px]" /> : (
                <div className="text-2xl font-bold text-amber-500">
                  {summary?.avgProfitMargin.toFixed(1)}%
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Daily Rev</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-[100px]" /> : (
                <div className="text-2xl font-bold text-muted-foreground">
                  ${summary?.avgDailyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-4 md:grid-cols-7 lg:grid-cols-7">
        <motion.div className="col-span-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Monthly Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pl-0">
              {loadingSummary ? (
                <div className="h-[300px] w-full flex items-center justify-center">
                  <Skeleton className="h-[250px] w-[90%]" />
                </div>
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary?.revenueByMonth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div className="col-span-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Smart Discount Agent</CardTitle>
              <CardDescription>Automatically discount slow periods to drive traffic.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {loadingDiscount ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onDiscountSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-muted/20">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Smart Pricing</FormLabel>
                            <p className="text-sm text-muted-foreground">Activates dynamic discounts</p>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="percentage"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between">
                            <FormLabel>Discount Amount</FormLabel>
                            <span className="font-bold text-primary">{field.value}%</span>
                          </div>
                          <FormControl>
                            <Slider
                              min={5} max={50} step={5}
                              value={[field.value]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                              className="py-4"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time</FormLabel>
                            <FormControl><Input type="time" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time</FormLabel>
                            <FormControl><Input type="time" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="days"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel>Active Days</FormLabel>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {WEEKDAYS.map((day) => (
                              <FormField
                                key={day}
                                control={form.control}
                                name="days"
                                render={({ field }) => {
                                  return (
                                    <FormItem key={day} className="flex flex-row items-start space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(day)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, day])
                                              : field.onChange(field.value?.filter((value) => value !== day))
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal text-sm leading-none">{day}</FormLabel>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))}
                          </div>
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full" disabled={updateDiscount.isPending}>
                      <Zap className="mr-2 h-4 w-4" /> Save Strategy
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Dishes</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {summary?.topDishes?.map((dish, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                        {i + 1}
                      </div>
                      <span className="font-medium">{dish.name}</span>
                    </div>
                    <span className="text-muted-foreground font-mono">{dish.count} ordered</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
