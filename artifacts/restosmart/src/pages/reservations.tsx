import { useState } from "react";
import { 
  useListReservations, 
  getListReservationsQueryKey,
  useGetReservationStats,
  getGetReservationStatsQueryKey,
  useCreateReservation,
  useUpdateReservation,
  useDeleteReservation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.string().email("Invalid email").or(z.literal("")),
  customerPhone: z.string().min(5, "Phone is required"),
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

export default function Reservations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "all">("today");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
            toast({ title: "Reservation updated" });
          },
          onError: () => toast({ title: "Update failed", variant: "destructive" })
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
            toast({ title: "Reservation created" });
          },
          onError: () => toast({ title: "Creation failed", variant: "destructive" })
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
          toast({ title: `Status updated to ${status}` });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this reservation?")) {
      deleteReservation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetReservationStatsQueryKey() });
            toast({ title: "Reservation deleted" });
          }
        }
      );
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reservations</h2>
          <p className="text-muted-foreground mt-2">Manage your tables and bookings.</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setEditingReservation(null);
            form.reset({ customerName: "", customerEmail: "", customerPhone: "", date: todayStr, time: "19:00", partySize: 2, source: "phone", status: "pending" });
          }
        }}>
          <SheetTrigger asChild>
            <Button size="lg" className="shadow-lg"><Plus className="mr-2 h-5 w-5" /> New Reservation</Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-[500px] overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle>{editingReservation ? "Edit Reservation" : "New Reservation"}</SheetTitle>
            </SheetHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
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
                        <FormLabel>Phone</FormLabel>
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
                        <FormLabel>Email (Optional)</FormLabel>
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
                        <FormLabel>Date</FormLabel>
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
                        <FormLabel>Time</FormLabel>
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
                        <FormLabel>Party Size</FormLabel>
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
                        <FormLabel>Table No. (Optional)</FormLabel>
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
                        <FormLabel>Source</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="online">Online</SelectItem>
                            <SelectItem value="walkin">Walk-in</SelectItem>
                            <SelectItem value="direct">Direct</SelectItem>
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
                              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="seated">Seated</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
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
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl><Textarea className="resize-none" {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full mt-6" disabled={createReservation.isPending || updateReservation.isPending}>
                  {editingReservation ? "Save Changes" : "Create Reservation"}
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
              <CardTitle className="text-sm font-medium">Total Today</CardTitle>
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
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
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
              <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
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
              <CardTitle className="text-sm font-medium">Seated</CardTitle>
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
              <CardTitle className="text-sm font-medium">Total Covers</CardTitle>
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

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
            <Tabs defaultValue="today" onValueChange={(v) => setDateFilter(v as any)} className="w-[400px]">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="all">All Time</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="seated">Seated</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
                      <TableHead>Time</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Party</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Source</TableHead>
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
                          <span className="capitalize text-sm">{res.source}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize ${statusColors[res.status as keyof typeof statusColors] || ''}`}>
                            {res.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleStatusChange(res.id, "confirmed")}>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-indigo-500" /> Confirm
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(res.id, "seated")}>
                                <CheckSquare className="mr-2 h-4 w-4 text-emerald-500" /> Seat
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(res.id, "completed")}>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-slate-500" /> Complete
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(res.id, "cancelled")}>
                                <XCircle className="mr-2 h-4 w-4 text-rose-500" /> Cancel
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(res)}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(res.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!reservations?.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          No reservations found for these filters.
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
    </div>
  );
}