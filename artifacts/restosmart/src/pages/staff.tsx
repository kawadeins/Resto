import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useListShifts,
  getListShiftsQueryKey,
  useCreateShift,
  useDeleteShift,
  useGetWorkingNow,
  getGetWorkingNowQueryKey,
  useGetUpcomingShiftReminders,
  getGetUpcomingShiftRemindersQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MoreHorizontal, Pencil, Trash2, Clock, Users, Bell, TreePalm, Coffee, CalendarDays, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Employee } from "@workspace/api-client-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const employeeSchema = z.object({
  name: z.string().min(2, "Name ist erforderlich"),
  role: z.string().min(2, "Rolle ist erforderlich"),
  email: z.string().email("Ungültige E-Mail-Adresse"),
  phone: z.string().min(5, "Telefonnummer ist erforderlich"),
  status: z.enum(["active", "inactive"]),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const DAY_LABELS: Record<string, string> = {
  Monday: "Mo",
  Tuesday: "Di",
  Wednesday: "Mi",
  Thursday: "Do",
  Friday: "Fr",
  Saturday: "Sa",
  Sunday: "So",
};
const DAY_FULL: Record<string, string> = {
  Monday: "Montag",
  Tuesday: "Dienstag",
  Wednesday: "Mittwoch",
  Thursday: "Donnerstag",
  Friday: "Freitag",
  Saturday: "Samstag",
  Sunday: "Sonntag",
};

type OffDay = { id: number; employeeId: number; dayOfWeek: string };
type Vacation = { id: number; employeeId: number; startDate: string; endDate: string; notes?: string | null };

function getCurrentWeekDates(): Record<string, string> {
  const now = new Date();
  const currentDay = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((currentDay + 6) % 7));
  const result: Record<string, string> = {};
  DAYS.forEach((day, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    result[day] = d.toISOString().split("T")[0];
  });
  return result;
}

function formatDateDE(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

export default function Staff() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [shiftDay, setShiftDay] = useState<typeof DAYS[number]>("Monday");
  const [shiftEmployeeId, setShiftEmployeeId] = useState<number | null>(null);

  const [vacationDialogEmployee, setVacationDialogEmployee] = useState<Employee | null>(null);
  const [vacationStart, setVacationStart] = useState("");
  const [vacationEnd, setVacationEnd] = useState("");
  const [vacationNotes, setVacationNotes] = useState("");

  const weekDates = useMemo(() => getCurrentWeekDates(), []);

  const { data: employees, isLoading: loadingEmployees } = useListEmployees({
    query: { queryKey: getListEmployeesQueryKey() }
  });

  const { data: shifts, isLoading: loadingShifts } = useListShifts({
    query: { queryKey: getListShiftsQueryKey() }
  });

  const { data: workingNow, isLoading: loadingWorkingNow } = useGetWorkingNow({
    query: { queryKey: getGetWorkingNowQueryKey(), refetchInterval: 60000 }
  });

  const { data: shiftReminders, isLoading: loadingReminders } = useGetUpcomingShiftReminders({
    query: { queryKey: getGetUpcomingShiftRemindersQueryKey(), refetchInterval: 60000 }
  });

  const { data: offDays = [] } = useQuery<OffDay[]>({
    queryKey: ["employee-days"],
    queryFn: () => fetch(`${API_BASE}/api/employee-days`).then((r) => r.json()),
  });

  const { data: vacations = [] } = useQuery<Vacation[]>({
    queryKey: ["employee-vacations"],
    queryFn: () => fetch(`${API_BASE}/api/employee-vacations`).then((r) => r.json()),
  });

  const toggleOffDay = useMutation({
    mutationFn: ({ employeeId, dayOfWeek }: { employeeId: number; dayOfWeek: string }) =>
      fetch(`${API_BASE}/api/employee-days/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, dayOfWeek }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-days"] }),
  });

  const addVacation = useMutation({
    mutationFn: (data: { employeeId: number; startDate: string; endDate: string; notes?: string }) =>
      fetch(`${API_BASE}/api/employee-vacations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vacations"] });
      setVacationStart("");
      setVacationEnd("");
      setVacationNotes("");
      toast({ title: "Urlaub eingetragen" });
    },
    onError: () => toast({ title: "Fehler beim Eintragen des Urlaubs", variant: "destructive" }),
  });

  const deleteVacation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API_BASE}/api/employee-vacations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vacations"] });
      toast({ title: "Urlaub entfernt" });
    },
  });

  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const createShift = useCreateShift();
  const deleteShift = useDeleteShift();

  const employeeForm = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { name: "", role: "", email: "", phone: "", status: "active" },
  });

  const shiftForm = useForm({
    defaultValues: { startTime: "09:00", endTime: "17:00" }
  });

  const onEmployeeSubmit = (data: EmployeeFormValues) => {
    if (editingEmployee) {
      updateEmployee.mutate(
        { id: editingEmployee.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            setEmployeeDialogOpen(false);
            toast({ title: "Mitarbeiter erfolgreich aktualisiert" });
          },
          onError: () => toast({ title: "Aktualisierung fehlgeschlagen", variant: "destructive" })
        }
      );
    } else {
      createEmployee.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            setEmployeeDialogOpen(false);
            employeeForm.reset();
            toast({ title: "Mitarbeiter erfolgreich erstellt" });
          },
          onError: () => toast({ title: "Erstellen fehlgeschlagen", variant: "destructive" })
        }
      );
    }
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    employeeForm.reset({
      name: emp.name, role: emp.role, email: emp.email,
      phone: emp.phone, status: emp.status as "active" | "inactive",
    });
    setEmployeeDialogOpen(true);
  };

  const handleDeleteEmployee = (id: number) => {
    if (confirm("Möchten Sie diesen Mitarbeiter wirklich löschen?")) {
      deleteEmployee.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            toast({ title: "Mitarbeiter gelöscht" });
          }
        }
      );
    }
  };

  const openShiftDialog = (employeeId: number, day: typeof DAYS[number]) => {
    setShiftEmployeeId(employeeId);
    setShiftDay(day);
    setShiftDialogOpen(true);
  };

  const onShiftSubmit = (data: { startTime: string; endTime: string }) => {
    if (!shiftEmployeeId) return;
    createShift.mutate(
      { data: { employeeId: shiftEmployeeId, dayOfWeek: shiftDay, startTime: data.startTime, endTime: data.endTime } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
          setShiftDialogOpen(false);
          toast({ title: "Schicht hinzugefügt" });
        }
      }
    );
  };

  const handleDeleteShift = (id: number) => {
    deleteShift.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
          toast({ title: "Schicht entfernt" });
        }
      }
    );
  };

  const isDayOff = (employeeId: number, dayOfWeek: string) =>
    offDays.some((d) => d.employeeId === employeeId && d.dayOfWeek === dayOfWeek);

  const isDayVacation = (employeeId: number, dayOfWeek: string) => {
    const dateStr = weekDates[dayOfWeek];
    if (!dateStr) return false;
    return vacations.some(
      (v) => v.employeeId === employeeId && v.startDate <= dateStr && v.endDate >= dateStr
    );
  };

  const getEmployeeVacations = (employeeId: number) =>
    vacations.filter((v) => v.employeeId === employeeId).sort((a, b) => a.startDate.localeCompare(b.startDate));

  const handleVacationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacationDialogEmployee || !vacationStart || !vacationEnd) return;
    if (vacationEnd < vacationStart) {
      toast({ title: "Enddatum muss nach dem Startdatum liegen", variant: "destructive" });
      return;
    }
    addVacation.mutate({
      employeeId: vacationDialogEmployee.id,
      startDate: vacationStart,
      endDate: vacationEnd,
      notes: vacationNotes || undefined,
    });
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Personalverwaltung</h2>
          <p className="text-muted-foreground mt-2">Team und Wochendienstplan verwalten.</p>
        </div>
        <Dialog open={employeeDialogOpen} onOpenChange={(open) => {
          setEmployeeDialogOpen(open);
          if (!open) { setEditingEmployee(null); employeeForm.reset({ name: "", role: "", email: "", phone: "", status: "active" }); }
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Mitarbeiter hinzufügen</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEmployee ? "Mitarbeiter bearbeiten" : "Neuen Mitarbeiter hinzufügen"}</DialogTitle>
            </DialogHeader>
            <Form {...employeeForm}>
              <form onSubmit={employeeForm.handleSubmit(onEmployeeSubmit)} className="space-y-4">
                <FormField control={employeeForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Vollständiger Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={employeeForm.control} name="role" render={({ field }) => (
                    <FormItem><FormLabel>Rolle</FormLabel><FormControl><Input {...field} placeholder="z.B. Kellner, Koch" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={employeeForm.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Status wählen" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="active">Aktiv</SelectItem>
                          <SelectItem value="inactive">Inaktiv</SelectItem>
                        </SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={employeeForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>E-Mail</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={employeeForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Telefon</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createEmployee.isPending || updateEmployee.isPending}>
                  {editingEmployee ? "Änderungen speichern" : "Mitarbeiter erstellen"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {shiftReminders && shiftReminders.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col gap-2">
            {shiftReminders.map(reminder => (
              <Alert key={`${reminder.employeeId}-${reminder.startTime}`} className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                <Bell className="h-4 w-4 text-amber-600" />
                <AlertTitle>Schicht beginnt bald</AlertTitle>
                <AlertDescription>
                  {reminder.employeeName} ({reminder.role}) beginnt in {reminder.minutesUntilStart} Min. um {reminder.startTime} Uhr.
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Aktuell im Dienst
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingWorkingNow ? (
              <Skeleton className="h-20 w-full" />
            ) : workingNow && workingNow.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {workingNow.map(emp => (
                  <div key={emp.id} className="flex flex-col justify-between p-4 rounded-lg border bg-card">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{emp.name}</p>
                        <p className="text-sm text-muted-foreground">{emp.role}</p>
                      </div>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {emp.shiftStart} - {emp.shiftEnd}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium text-emerald-500 mt-2">
                      Noch {emp.minutesUntilEnd} Min.
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>Momentan ist niemand eingestempelt.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <CardTitle>Teammitglieder</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEmployees ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Urlaub</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees?.map((emp) => {
                    const empVacations = getEmployeeVacations(emp.id);
                    const today = new Date().toISOString().split("T")[0];
                    const activeVacation = empVacations.find(v => v.startDate <= today && v.endDate >= today);
                    const nextVacation = empVacations.find(v => v.startDate > today);
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell>{emp.role}</TableCell>
                        <TableCell>
                          <div className="text-sm">{emp.email}</div>
                          <div className="text-xs text-muted-foreground">{emp.phone}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={emp.status === "active" ? "default" : "secondary"} className={emp.status === "active" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : ""}>
                            {emp.status === "active" ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {activeVacation ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                              <TreePalm className="h-3 w-3 mr-1" />
                              Urlaub bis {formatDateDE(activeVacation.endDate)}
                            </Badge>
                          ) : nextVacation ? (
                            <Badge variant="outline" className="bg-sky-500/10 text-sky-600 border-sky-500/20 text-xs">
                              <CalendarDays className="h-3 w-3 mr-1" />
                              ab {formatDateDE(nextVacation.startDate)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">–</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditEmployee(emp)}>
                                <Pencil className="mr-2 h-4 w-4" /> Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setVacationDialogEmployee(emp); }}>
                                <TreePalm className="mr-2 h-4 w-4" /> Urlaub verwalten
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteEmployee(emp.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!employees?.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Keine Mitarbeiter gefunden.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Weekly Rota */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Wochendienstplan</CardTitle>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-muted border border-border/50" />
                  Arbeitstag
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700" />
                  Frei / Ruhetag
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-blue-100 dark:bg-blue-900/30" />
                  Urlaub
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loadingEmployees || loadingShifts ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="min-w-[900px]">
                {/* Header row */}
                <div className="grid grid-cols-8 gap-2 mb-2">
                  <div className="font-semibold p-2">Mitarbeiter</div>
                  {DAYS.map(d => (
                    <div key={d} className="font-semibold p-2 text-center bg-muted/50 rounded-md">
                      <div>{DAY_LABELS[d]}</div>
                      <div className="text-xs font-normal text-muted-foreground">{weekDates[d]?.slice(5).replace("-", ".")}</div>
                    </div>
                  ))}
                </div>

                {employees?.filter(e => e.status === "active").map((emp) => (
                  <div key={emp.id} className="grid grid-cols-8 gap-2 py-2 border-b border-border/50 last:border-0 items-start">
                    {/* Employee name + vacation button */}
                    <div className="flex flex-col gap-1 pr-2 pt-1">
                      <span className="font-medium truncate text-sm">{emp.name}</span>
                      <button
                        onClick={() => setVacationDialogEmployee(emp)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue-500 transition-colors"
                        title="Urlaub verwalten"
                      >
                        <TreePalm className="h-3 w-3" />
                        <span>Urlaub</span>
                      </button>
                    </div>

                    {DAYS.map(day => {
                      const dayOff = isDayOff(emp.id, day);
                      const dayVacation = isDayVacation(emp.id, day);
                      const blocked = dayOff || dayVacation;
                      const empShifts = shifts?.filter(s => s.employeeId === emp.id && s.dayOfWeek === day);

                      return (
                        <div
                          key={`${emp.id}-${day}`}
                          className={`min-h-[80px] border rounded-md p-1 flex flex-col gap-1 transition-colors ${
                            dayVacation
                              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                              : dayOff
                              ? "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                              : "bg-card border-border/50"
                          }`}
                        >
                          {/* State indicator */}
                          {dayVacation ? (
                            <div className="flex items-center justify-between px-0.5">
                              <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                                <TreePalm className="h-3 w-3" /> Urlaub
                              </span>
                            </div>
                          ) : dayOff ? (
                            <div className="flex items-center justify-between px-0.5">
                              <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                                <Coffee className="h-3 w-3" /> Frei
                              </span>
                              <button
                                onClick={() => toggleOffDay.mutate({ employeeId: emp.id, dayOfWeek: day })}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                                title="Ruhetag aufheben"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            /* Shift entries */
                            <>
                              {empShifts?.map(shift => (
                                <div key={shift.id} className="text-xs bg-primary/10 text-primary p-1 rounded flex justify-between items-center group">
                                  <span>{shift.startTime} - {shift.endTime}</span>
                                  <button
                                    onClick={() => handleDeleteShift(shift.id)}
                                    className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 rounded p-0.5 transition-opacity"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </>
                          )}

                          {/* Bottom action area */}
                          {!dayVacation && (
                            <div className="mt-auto flex flex-col gap-0.5">
                              {!dayOff && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-full text-xs text-muted-foreground"
                                  onClick={() => openShiftDialog(emp.id, day)}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Schicht
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-full text-xs transition-colors ${dayOff ? "text-emerald-600 hover:text-emerald-700" : "text-slate-400 hover:text-slate-600"}`}
                                onClick={() => toggleOffDay.mutate({ employeeId: emp.id, dayOfWeek: day })}
                                title={dayOff ? "Als Arbeitstag markieren" : "Als Ruhetag markieren"}
                              >
                                <Coffee className="h-3 w-3 mr-1" />
                                {dayOff ? "Arbeiten" : "Frei"}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Shift Add Dialog */}
      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Schicht für {DAY_FULL[shiftDay]} hinzufügen</DialogTitle>
          </DialogHeader>
          <Form {...shiftForm}>
            <form onSubmit={shiftForm.handleSubmit(onShiftSubmit)} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={shiftForm.control} name="startTime" render={({ field }) => (
                  <FormItem><FormLabel>Beginn</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={shiftForm.control} name="endTime" render={({ field }) => (
                  <FormItem><FormLabel>Ende</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>
                )} />
              </div>
              <Button type="submit" className="w-full" disabled={createShift.isPending}>Schicht hinzufügen</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Vacation Management Dialog */}
      <Dialog open={!!vacationDialogEmployee} onOpenChange={(open) => { if (!open) setVacationDialogEmployee(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TreePalm className="h-5 w-5 text-blue-500" />
              Urlaub – {vacationDialogEmployee?.name}
            </DialogTitle>
          </DialogHeader>

          {vacationDialogEmployee && (
            <div className="space-y-5 pt-2">
              {/* Existing vacations */}
              <div>
                <p className="text-sm font-medium mb-2 text-muted-foreground">Eingetragene Urlaubszeiträume</p>
                {getEmployeeVacations(vacationDialogEmployee.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Kein Urlaub eingetragen.</p>
                ) : (
                  <div className="space-y-2">
                    {getEmployeeVacations(vacationDialogEmployee.id).map((v) => {
                      const today = new Date().toISOString().split("T")[0];
                      const isActive = v.startDate <= today && v.endDate >= today;
                      const isPast = v.endDate < today;
                      return (
                        <div key={v.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${
                          isActive ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                          : isPast ? "bg-muted/30 border-border/40 opacity-60"
                          : "bg-card border-border/50"
                        }`}>
                          <div>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
                              {formatDateDE(v.startDate)} – {formatDateDE(v.endDate)}
                              {isActive && <Badge className="bg-blue-500 text-white text-xs py-0 px-1.5 h-4">Aktiv</Badge>}
                              {isPast && <span className="text-xs text-muted-foreground">vergangen</span>}
                            </div>
                            {v.notes && <p className="text-xs text-muted-foreground mt-0.5 ml-5">{v.notes}</p>}
                          </div>
                          <button
                            onClick={() => deleteVacation.mutate(v.id)}
                            className="text-destructive hover:bg-destructive/10 rounded p-1 transition-colors"
                            title="Urlaub löschen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add vacation form */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Neuen Urlaubszeitraum eintragen</p>
                <form onSubmit={handleVacationSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Von</label>
                      <Input
                        type="date"
                        value={vacationStart}
                        onChange={(e) => setVacationStart(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Bis</label>
                      <Input
                        type="date"
                        value={vacationEnd}
                        min={vacationStart}
                        onChange={(e) => setVacationEnd(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Notiz (optional)</label>
                    <Input
                      placeholder="z.B. Familienurlaub, Erholung..."
                      value={vacationNotes}
                      onChange={(e) => setVacationNotes(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={addVacation.isPending || !vacationStart || !vacationEnd}>
                    <TreePalm className="h-4 w-4 mr-2" /> Urlaub eintragen
                  </Button>
                </form>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
