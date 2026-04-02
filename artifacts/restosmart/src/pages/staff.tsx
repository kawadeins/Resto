import { useState } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MoreHorizontal, Pencil, Trash2, Clock, Users, Bell } from "lucide-react";
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

const employeeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  role: z.string().min(2, "Role is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(5, "Phone is required"),
  status: z.enum(["active", "inactive"]),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export default function Staff() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [shiftDay, setShiftDay] = useState<typeof DAYS[number]>("Monday");
  const [shiftEmployeeId, setShiftEmployeeId] = useState<number | null>(null);

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

  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const createShift = useCreateShift();
  const deleteShift = useDeleteShift();

  const employeeForm = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "",
      role: "",
      email: "",
      phone: "",
      status: "active",
    },
  });

  const shiftForm = useForm({
    defaultValues: {
      startTime: "09:00",
      endTime: "17:00",
    }
  });

  const onEmployeeSubmit = (data: EmployeeFormValues) => {
    if (editingEmployee) {
      updateEmployee.mutate(
        { id: editingEmployee.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            setEmployeeDialogOpen(false);
            toast({ title: "Employee updated successfully" });
          },
          onError: () => toast({ title: "Failed to update employee", variant: "destructive" })
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
            toast({ title: "Employee created successfully" });
          },
          onError: () => toast({ title: "Failed to create employee", variant: "destructive" })
        }
      );
    }
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    employeeForm.reset({
      name: emp.name,
      role: emp.role,
      email: emp.email,
      phone: emp.phone,
      status: emp.status as "active" | "inactive",
    });
    setEmployeeDialogOpen(true);
  };

  const handleDeleteEmployee = (id: number) => {
    if (confirm("Are you sure you want to delete this employee?")) {
      deleteEmployee.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            toast({ title: "Employee deleted" });
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

  const onShiftSubmit = (data: { startTime: string, endTime: string }) => {
    if (!shiftEmployeeId) return;
    createShift.mutate(
      { data: { employeeId: shiftEmployeeId, dayOfWeek: shiftDay, startTime: data.startTime, endTime: data.endTime } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
          setShiftDialogOpen(false);
          toast({ title: "Shift added" });
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
          toast({ title: "Shift removed" });
        }
      }
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Staff Management</h2>
          <p className="text-muted-foreground mt-2">Manage your team and weekly rota.</p>
        </div>
        <Dialog open={employeeDialogOpen} onOpenChange={(open) => {
          setEmployeeDialogOpen(open);
          if (!open) {
            setEditingEmployee(null);
            employeeForm.reset({ name: "", role: "", email: "", phone: "", status: "active" });
          }
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Employee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
            </DialogHeader>
            <Form {...employeeForm}>
              <form onSubmit={employeeForm.handleSubmit(onEmployeeSubmit)} className="space-y-4">
                <FormField
                  control={employeeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={employeeForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <FormControl><Input {...field} placeholder="e.g. Server, Chef" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={employeeForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={employeeForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={employeeForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createEmployee.isPending || updateEmployee.isPending}>
                  {editingEmployee ? "Save Changes" : "Create Employee"}
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
                <AlertTitle>Starting Soon</AlertTitle>
                <AlertDescription>
                  {reminder.employeeName} ({reminder.role}) starts in {reminder.minutesUntilStart} min at {reminder.startTime}.
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
              Working Right Now
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
                      {emp.minutesUntilEnd} min remaining
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>No one is currently clocked in.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
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
                    <TableHead>Role</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees?.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.role}</TableCell>
                      <TableCell>
                        <div className="text-sm">{emp.email}</div>
                        <div className="text-xs text-muted-foreground">{emp.phone}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.status === "active" ? "default" : "secondary"} className={emp.status === "active" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : ""}>
                          {emp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditEmployee(emp)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteEmployee(emp.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!employees?.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No employees found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Weekly Rota</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loadingEmployees || loadingShifts ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="min-w-[800px]">
                <div className="grid grid-cols-8 gap-2 mb-2">
                  <div className="font-semibold p-2">Employee</div>
                  {DAYS.map(d => <div key={d} className="font-semibold p-2 text-center bg-muted/50 rounded-md">{d.slice(0, 3)}</div>)}
                </div>
                {employees?.filter(e => e.status === "active").map((emp) => (
                  <div key={emp.id} className="grid grid-cols-8 gap-2 py-2 border-b border-border/50 last:border-0 items-center">
                    <div className="font-medium truncate pr-2">{emp.name}</div>
                    {DAYS.map(day => {
                      const empShifts = shifts?.filter(s => s.employeeId === emp.id && s.dayOfWeek === day);
                      return (
                        <div key={`${emp.id}-${day}`} className="min-h-[60px] bg-card border border-border/50 rounded-md p-1 flex flex-col gap-1">
                          {empShifts?.map(shift => (
                            <div key={shift.id} className="text-xs bg-primary/10 text-primary p-1 rounded flex justify-between items-center group">
                              <span>{shift.startTime} - {shift.endTime}</span>
                              <button onClick={() => handleDeleteShift(shift.id)} className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 rounded p-0.5 transition-opacity">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" className="h-6 w-full text-xs text-muted-foreground mt-auto" onClick={() => openShiftDialog(emp.id, day)}>
                            <Plus className="h-3 w-3 mr-1" /> Add
                          </Button>
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

      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Shift for {shiftDay}</DialogTitle>
          </DialogHeader>
          <Form {...shiftForm}>
            <form onSubmit={shiftForm.handleSubmit(onShiftSubmit)} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={shiftForm.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={shiftForm.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createShift.isPending}>Add Shift</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
