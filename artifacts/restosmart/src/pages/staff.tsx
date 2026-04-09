import { useState, useMemo, useCallback } from "react";
import { useSession } from "@/contexts/session-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListEmployees,
  getListEmployeesQueryKey,
  useListShifts,
  getListShiftsQueryKey,
  useGetWorkingNow,
  getGetWorkingNowQueryKey,
  useGetUpcomingShiftReminders,
  getGetUpcomingShiftRemindersQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, Clock, Users, Bell, TreePalm, Coffee, CalendarDays, X,
  Copy, Share2, MessageCircle, Mail, Send, ChevronRight, UserCircle2,
  ClipboardList, AlertCircle, FileDown, Printer, Sparkles, Loader2, ChevronDown,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Employee } from "@workspace/api-client-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const ROLE_PRESETS = [
  "Service", "Küche", "Bar", "Manager", "Theke", "Kasse",
  "Lieferung", "Reinigung", "Sous-Chef", "Barista", "Sommelier", "Hostess",
];

const employeeSchema = z.object({
  name: z.string().min(2, "Name ist erforderlich"),
  role: z.string().min(2, "Rolle ist erforderlich"),
  email: z.string().email("Ungültige E-Mail-Adresse"),
  phone: z.string().min(5, "Telefonnummer ist erforderlich"),
  status: z.enum(["active", "inactive"]),
});
type EmployeeFormValues = z.infer<typeof employeeSchema>;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type Day = typeof DAYS[number];

const DAY_LABELS: Record<string, string> = {
  Monday: "Mo", Tuesday: "Di", Wednesday: "Mi", Thursday: "Do",
  Friday: "Fr", Saturday: "Sa", Sunday: "So",
};
const DAY_FULL: Record<string, string> = {
  Monday: "Montag", Tuesday: "Dienstag", Wednesday: "Mittwoch",
  Thursday: "Donnerstag", Friday: "Freitag", Saturday: "Samstag", Sunday: "Sonntag",
};

type OffDay = { id: number; employeeId: number; dayOfWeek: string };
type Vacation = { id: number; employeeId: number; startDate: string; endDate: string; notes?: string | null };
type Shift = { id: number; employeeId: number; dayOfWeek: string; startTime: string; endTime: string; employeeName?: string };

const QUICK_TIMES = [
  "06:00","06:30","07:00","07:30","08:00","08:30",
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30",
  "18:00","18:30","19:00","19:30","20:00","20:30",
  "21:00","21:30","22:00","22:30","23:00","23:30","00:00",
];

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

function getWeekRange(dates: Record<string, string>): string {
  const mon = dates["Monday"];
  const sun = dates["Sunday"];
  if (!mon || !sun) return "";
  return `${formatDateDE(mon)} – ${formatDateDE(sun)}`;
}

function buildScheduleText(
  employee: Employee,
  shifts: Shift[],
  offDays: OffDay[],
  vacations: Vacation[],
  weekDates: Record<string, string>
): string {
  const lines: string[] = [
    `Dein Dienstplan für diese Woche:`,
    "",
  ];
  DAYS.forEach((day) => {
    const dateStr = weekDates[day];
    const label = DAY_LABELS[day];
    const isVacation = vacations.some(
      (v) => v.employeeId === employee.id && dateStr && v.startDate <= dateStr && v.endDate >= dateStr
    );
    const isOff = offDays.some((d) => d.employeeId === employee.id && d.dayOfWeek === day);
    const empShifts = shifts.filter((s) => s.employeeId === employee.id && s.dayOfWeek === day);

    if (isVacation) {
      lines.push(`${label}: Urlaub`);
    } else if (isOff) {
      lines.push(`${label}: Frei`);
    } else if (empShifts.length > 0) {
      empShifts.forEach((s) => lines.push(`${label}: ${s.startTime}–${s.endTime}`));
    } else {
      lines.push(`${label}: Frei`);
    }
  });
  lines.push("", "RestoMaster Dienstplan");
  return lines.join("\n");
}

function buildTeamScheduleText(
  employees: Employee[],
  shifts: Shift[],
  offDays: OffDay[],
  vacations: Vacation[],
  weekDates: Record<string, string>
): string {
  const weekRange = getWeekRange(weekDates);
  const lines: string[] = [`📋 Teamdienstplan – Woche ${weekRange}`, ""];
  employees.filter((e) => e.status === "active").forEach((emp) => {
    lines.push(`👤 ${emp.name} (${emp.role})`);
    DAYS.forEach((day) => {
      const dateStr = weekDates[day];
      const dayLabel = `  ${DAY_LABELS[day]}`;
      const isVacation = vacations.some(
        (v) => v.employeeId === emp.id && dateStr && v.startDate <= dateStr && v.endDate >= dateStr
      );
      const isOff = offDays.some((d) => d.employeeId === emp.id && d.dayOfWeek === day);
      const empShifts = shifts.filter((s) => s.employeeId === emp.id && s.dayOfWeek === day);
      if (isVacation) lines.push(`${dayLabel}: Urlaub`);
      else if (isOff) lines.push(`${dayLabel}: Frei`);
      else if (empShifts.length > 0) empShifts.forEach((s) => lines.push(`${dayLabel}: ${s.startTime} – ${s.endTime}`));
      else lines.push(`${dayLabel}: –`);
    });
    lines.push("");
  });
  lines.push("RestoMaster Dienstplan");
  return lines.join("\n");
}

function shareViaWhatsApp(text: string, phone?: string) {
  const encoded = encodeURIComponent(text);
  const url = phone
    ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  window.open(url, "_blank");
}

function shareViaEmail(text: string, email?: string) {
  const subject = encodeURIComponent("Dienstplan für diese Woche");
  const body = encodeURIComponent(text);
  window.open(`mailto:${email ?? ""}?subject=${subject}&body=${body}`, "_blank");
}

async function shareViaNative(text: string, title: string): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title, text });
    return true;
  } catch {
    return false;
  }
}

// ── AI Schedule ────────────────────────────────────────────────────────────────

type BusinessType = "restaurant" | "cafe" | "bar";

const BUSINESS_TIMES: Record<BusinessType, { start: string; end: string }> = {
  restaurant: { start: "11:00", end: "22:00" },
  cafe:       { start: "07:30", end: "15:30" },
  bar:        { start: "18:00", end: "00:00" },
};

function generateAISchedule(
  employees: Employee[],
  businessType: BusinessType
): Array<{ employeeId: number; dayOfWeek: Day; startTime: string; endTime: string }> {
  const active = employees.filter((e) => e.status === "active");
  const times = BUSINESS_TIMES[businessType];
  const result: Array<{ employeeId: number; dayOfWeek: Day; startTime: string; endTime: string }> = [];
  active.forEach((emp, idx) => {
    const offA = idx % 7;
    const offB = (idx + 3) % 7;
    DAYS.forEach((day, di) => {
      if (di !== offA && di !== offB) {
        result.push({ employeeId: emp.id, dayOfWeek: day, startTime: times.start, endTime: times.end });
      }
    });
  });
  return result;
}

// ── PDF Export ─────────────────────────────────────────────────────────────────

async function exportTeamPDF(
  employees: Employee[],
  shifts: Shift[],
  offDays: OffDay[],
  vacations: Vacation[],
  weekDates: Record<string, string>
) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const weekRange = getWeekRange(weekDates);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("RestoMaster \u2013 Dienstplan", 14, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`Woche: ${weekRange}`, 14, 26);
  doc.setTextColor(0, 0, 0);

  const active = employees.filter((e) => e.status === "active");
  const head = [["Mitarbeiter", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]];
  const body = active.map((emp) => {
    const cells: string[] = [emp.name];
    DAYS.forEach((day) => {
      const dateStr = weekDates[day];
      const isVac = vacations.some(
        (v) => v.employeeId === emp.id && dateStr && v.startDate <= dateStr && v.endDate >= dateStr
      );
      const isOff = offDays.some((d) => d.employeeId === emp.id && d.dayOfWeek === day);
      const empShifts = shifts.filter((s) => s.employeeId === emp.id && s.dayOfWeek === day);
      if (isVac) cells.push("Urlaub");
      else if (isOff) cells.push("Frei");
      else if (empShifts.length > 0) cells.push(`${empShifts[0].startTime}\u2013${empShifts[0].endTime}`);
      else cells.push("\u2013");
    });
    return cells;
  });

  autoTable(doc, {
    head,
    body,
    startY: 32,
    styles: { fontSize: 9, cellPadding: 4, halign: "center" },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold", minCellWidth: 40 } },
    alternateRowStyles: { fillColor: [248, 248, 252] },
  });

  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text("Erstellt mit RestoMaster", 14, ph - 8);
  doc.text(new Date().toLocaleDateString("de-AT"), 283, ph - 8, { align: "right" });

  doc.save(`Dienstplan-${weekRange.replace(" \u2013 ", "_")}.pdf`);
}

// ── Print ──────────────────────────────────────────────────────────────────────

function printSchedule(
  employees: Employee[],
  shifts: Shift[],
  offDays: OffDay[],
  vacations: Vacation[],
  weekDates: Record<string, string>
) {
  const weekRange = getWeekRange(weekDates);
  const active = employees.filter((e) => e.status === "active");

  const rows = active.map((emp) => {
    const cells = DAYS.map((day) => {
      const dateStr = weekDates[day];
      const isVac = vacations.some(
        (v) => v.employeeId === emp.id && dateStr && v.startDate <= dateStr && v.endDate >= dateStr
      );
      const isOff = offDays.some((d) => d.employeeId === emp.id && d.dayOfWeek === day);
      const empShifts = shifts.filter((s) => s.employeeId === emp.id && s.dayOfWeek === day);
      if (isVac) return `<td class="free">Urlaub</td>`;
      if (isOff) return `<td class="free">Frei</td>`;
      if (empShifts.length > 0) return `<td>${empShifts[0].startTime}&ndash;${empShifts[0].endTime}</td>`;
      return `<td class="free">&ndash;</td>`;
    }).join("");
    return `<tr><td class="name">${emp.name}<br/><span class="role">${emp.role}</span></td>${cells}</tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<title>Dienstplan \u2013 ${weekRange}</title>
<style>
  @page{size:A4 landscape;margin:15mm}
  body{font-family:Arial,sans-serif;font-size:10px;color:#111}
  h1{font-size:16px;margin:0 0 4px}
  .sub{color:#666;font-size:11px;margin:0 0 14px}
  table{width:100%;border-collapse:collapse}
  th{background:#4f46e5;color:#fff;padding:6px 8px;text-align:center;font-size:10px}
  th:first-child{text-align:left}
  td{border:1px solid #e0e0e0;padding:6px 8px;text-align:center}
  td.name{text-align:left;font-weight:bold;background:#fafafa;min-width:90px}
  td.free{color:#bbb}
  .role{font-weight:normal;color:#aaa;font-size:8px}
  tr:nth-child(even){background:#f8f8fc}
  .footer{margin-top:14px;font-size:8px;color:#bbb;text-align:center}
</style></head><body>
<h1>RestoMaster &ndash; Dienstplan</h1>
<p class="sub">Woche: ${weekRange}</p>
<table>
  <thead><tr>
    <th>Mitarbeiter</th>
    <th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Erstellt mit RestoMaster &middot; ${new Date().toLocaleDateString("de-AT")}</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ──────────────────────────────────────────────────────────────────────────────

function TimeSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      <div className="flex gap-2 items-center">
        <Input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          step={1800}
          className="flex-1"
        />
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {QUICK_TIMES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
              value === t
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Staff() {
  const { csrfToken } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [roleCustom, setRoleCustom] = useState(false);

  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [shiftDay, setShiftDay] = useState<Day>("Monday");
  const [shiftEmployeeId, setShiftEmployeeId] = useState<number | null>(null);
  const [newShiftStart, setNewShiftStart] = useState("09:00");
  const [newShiftEnd, setNewShiftEnd] = useState("17:00");

  const [editShiftDialog, setEditShiftDialog] = useState<{ open: boolean; shift: Shift | null }>({ open: false, shift: null });
  const [editShiftStart, setEditShiftStart] = useState("09:00");
  const [editShiftEnd, setEditShiftEnd] = useState("17:00");

  const [copyShiftDialog, setCopyShiftDialog] = useState<{ open: boolean; shift: Shift | null }>({ open: false, shift: null });
  const [copyTargetDay, setCopyTargetDay] = useState<Day>("Monday");

  const [shareDialog, setShareDialog] = useState<{ open: boolean; employee: Employee | null; mode: "employee" | "team" }>({
    open: false, employee: null, mode: "employee",
  });

  const [vacationDialogEmployee, setVacationDialogEmployee] = useState<Employee | null>(null);
  const [vacationStart, setVacationStart] = useState("");
  const [vacationEnd, setVacationEnd] = useState("");
  const [vacationNotes, setVacationNotes] = useState("");

  const [aiDialog, setAiDialog] = useState<{ open: boolean; businessType: BusinessType }>({
    open: false, businessType: "restaurant",
  });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);

  const weekDates = useMemo(() => getCurrentWeekDates(), []);

  const { data: employees, isLoading: loadingEmployees } = useListEmployees({
    query: { queryKey: getListEmployeesQueryKey() },
  });

  const { data: shifts, isLoading: loadingShifts } = useListShifts({
    query: { queryKey: getListShiftsQueryKey() },
  });

  const { data: workingNow, isLoading: loadingWorkingNow } = useGetWorkingNow({
    query: { queryKey: getGetWorkingNowQueryKey(), refetchInterval: 60000 },
  });

  const { data: shiftReminders } = useGetUpcomingShiftReminders({
    query: { queryKey: getGetUpcomingShiftRemindersQueryKey(), refetchInterval: 60000 },
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
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({ employeeId, dayOfWeek }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-days"] }),
  });

  const addVacation = useMutation({
    mutationFn: (data: { employeeId: number; startDate: string; endDate: string; notes?: string }) =>
      fetch(`${API_BASE}/api/employee-vacations`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error("Fehler");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vacations"] });
      setVacationStart(""); setVacationEnd(""); setVacationNotes("");
      toast({ title: "Urlaub eingetragen" });
    },
    onError: () => toast({ title: "Fehler beim Eintragen des Urlaubs", variant: "destructive" }),
  });

  const deleteVacation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API_BASE}/api/employee-vacations/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vacations"] });
      toast({ title: "Urlaub entfernt" });
    },
  });

  const updateShift = useMutation({
    mutationFn: ({ id, startTime, endTime }: { id: number; startTime: string; endTime: string }) =>
      fetch(`${API_BASE}/api/shifts/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({ startTime, endTime }),
      }).then(async (r) => {
        if (!r.ok) throw new Error("Update fehlgeschlagen");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
      setEditShiftDialog({ open: false, shift: null });
      toast({ title: "Schicht aktualisiert" });
    },
    onError: () => toast({ title: "Fehler beim Aktualisieren", variant: "destructive" }),
  });

  const getAuthHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
  }), [csrfToken]);

  const createEmployee = useMutation({
    mutationFn: (data: EmployeeFormValues) =>
      fetch(`${API_BASE}/api/employees`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(async (r) => { if (!r.ok) throw new Error("Fehler"); return r.json(); }),
  });

  const updateEmployee = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EmployeeFormValues }) =>
      fetch(`${API_BASE}/api/employees/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(async (r) => { if (!r.ok) throw new Error("Fehler"); return r.json(); }),
  });

  const deleteEmployee = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API_BASE}/api/employees/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) },
      }).then(async (r) => { if (!r.ok && r.status !== 204) throw new Error("Fehler"); }),
  });

  const createShift = useMutation({
    mutationFn: (data: { employeeId: number; dayOfWeek: string; startTime: string; endTime: string }) =>
      fetch(`${API_BASE}/api/shifts`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(async (r) => { if (!r.ok) throw new Error("Fehler"); return r.json(); }),
  });

  const deleteShift = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API_BASE}/api/shifts/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) },
      }).then(async (r) => { if (!r.ok && r.status !== 204) throw new Error("Fehler"); }),
  });

  const employeeForm = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { name: "", role: "", email: "", phone: "", status: "active" },
  });

  const onEmployeeSubmit = (data: EmployeeFormValues) => {
    if (editingEmployee) {
      updateEmployee.mutate(
        { id: editingEmployee.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            setEmployeeDialogOpen(false);
            toast({ title: "Mitarbeiter aktualisiert" });
          },
          onError: () => toast({ title: "Aktualisierung fehlgeschlagen", variant: "destructive" }),
        }
      );
    } else {
      createEmployee.mutate(data, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
          setEmployeeDialogOpen(false);
          employeeForm.reset();
          toast({ title: "Mitarbeiter erstellt" });
        },
        onError: () => toast({ title: "Erstellen fehlgeschlagen", variant: "destructive" }),
      });
    }
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setRoleCustom(!ROLE_PRESETS.includes(emp.role));
    employeeForm.reset({
      name: emp.name, role: emp.role, email: emp.email,
      phone: emp.phone, status: emp.status as "active" | "inactive",
    });
    setEmployeeDialogOpen(true);
  };

  const handleDeleteEmployee = (id: number) => {
    if (confirm("Möchten Sie diesen Mitarbeiter wirklich löschen?")) {
      deleteEmployee.mutate(id, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
          toast({ title: "Mitarbeiter gelöscht" });
        },
        onError: () => toast({ title: "Löschen fehlgeschlagen", variant: "destructive" }),
      });
    }
  };

  const openShiftDialog = (employeeId: number, day: Day) => {
    setShiftEmployeeId(employeeId);
    setShiftDay(day);
    setNewShiftStart("09:00");
    setNewShiftEnd("17:00");
    setShiftDialogOpen(true);
  };

  const handleAddShift = () => {
    if (!shiftEmployeeId) return;
    createShift.mutate(
      { employeeId: shiftEmployeeId, dayOfWeek: shiftDay, startTime: newShiftStart, endTime: newShiftEnd },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
          setShiftDialogOpen(false);
          toast({ title: "Schicht hinzugefügt" });
        },
        onError: () => toast({ title: "Fehler beim Speichern", variant: "destructive" }),
      }
    );
  };

  const openEditShiftDialog = (shift: Shift) => {
    setEditShiftDialog({ open: true, shift });
    setEditShiftStart(shift.startTime);
    setEditShiftEnd(shift.endTime);
  };

  const handleEditShiftSave = () => {
    if (!editShiftDialog.shift) return;
    updateShift.mutate({ id: editShiftDialog.shift.id, startTime: editShiftStart, endTime: editShiftEnd });
  };

  const openCopyShiftDialog = (shift: Shift) => {
    setCopyShiftDialog({ open: true, shift });
    const nextDay = DAYS[(DAYS.indexOf(shift.dayOfWeek as Day) + 1) % 7];
    setCopyTargetDay(nextDay);
  };

  const handleCopyShift = () => {
    if (!copyShiftDialog.shift) return;
    const s = copyShiftDialog.shift;
    createShift.mutate(
      { employeeId: s.employeeId, dayOfWeek: copyTargetDay, startTime: s.startTime, endTime: s.endTime },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
          setCopyShiftDialog({ open: false, shift: null });
          toast({ title: `Schicht nach ${DAY_FULL[copyTargetDay]} kopiert` });
        },
        onError: () => toast({ title: "Fehler beim Kopieren", variant: "destructive" }),
      }
    );
  };

  const handleDeleteShift = (id: number) => {
    deleteShift.mutate(id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
        toast({ title: "Schicht entfernt" });
      },
      onError: () => toast({ title: "Fehler beim Löschen", variant: "destructive" }),
    });
  };

  const isDayOff = (employeeId: number, dayOfWeek: string) =>
    offDays.some((d) => d.employeeId === employeeId && d.dayOfWeek === dayOfWeek);

  const isDayVacation = (employeeId: number, dayOfWeek: string) => {
    const dateStr = weekDates[dayOfWeek];
    if (!dateStr) return false;
    return vacations.some((v) => v.employeeId === employeeId && v.startDate <= dateStr && v.endDate >= dateStr);
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

  const openShareDialog = (employee: Employee) => {
    setShareDialog({ open: true, employee, mode: "employee" });
  };

  const openTeamShareDialog = () => {
    setShareDialog({ open: true, employee: null, mode: "team" });
  };

  const getShareText = () => {
    if (!shifts || !employees) return "";
    if (shareDialog.mode === "team") {
      return buildTeamScheduleText(employees, shifts as Shift[], offDays, vacations, weekDates);
    }
    if (!shareDialog.employee) return "";
    return buildScheduleText(shareDialog.employee, shifts as Shift[], offDays, vacations, weekDates);
  };

  const handleAIGenerate = async () => {
    if (!employees || employees.length === 0) {
      toast({ title: "Keine aktiven Mitarbeiter gefunden", variant: "destructive" });
      return;
    }
    setAiGenerating(true);
    const planned = generateAISchedule(employees, aiDialog.businessType);
    const existing = (shifts ?? []) as Shift[];
    const toCreate = planned.filter(
      (p) => !existing.some((s) => s.employeeId === p.employeeId && s.dayOfWeek === p.dayOfWeek)
    );
    let created = 0;
    for (const s of toCreate) {
      try {
        const r = await fetch(`${API_BASE}/api/shifts`, {
          method: "POST",
          credentials: "include",
          headers: getAuthHeaders(),
          body: JSON.stringify(s),
        });
        if (r.ok) created++;
      } catch { /* skip */ }
    }
    await queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
    setAiGenerating(false);
    setAiDialog((d) => ({ ...d, open: false }));
    toast({ title: `Dienstplan erstellt — ${created} Schichten hinzugefügt` });
  };

  const handleExportPDF = async () => {
    if (!employees || !shifts) return;
    setPdfExporting(true);
    try {
      await exportTeamPDF(employees, shifts as Shift[], offDays, vacations, weekDates);
    } catch {
      toast({ title: "PDF-Export fehlgeschlagen", variant: "destructive" });
    } finally {
      setPdfExporting(false);
    }
  };

  const handlePrint = () => {
    if (!employees || !shifts) return;
    printSchedule(employees, shifts as Shift[], offDays, vacations, weekDates);
  };

  const activeEmployees = employees?.filter((e) => e.status === "active") ?? [];
  const inactiveEmployees = employees?.filter((e) => e.status === "inactive") ?? [];

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Personalverwaltung</h2>
          <p className="text-muted-foreground mt-1">
            Team und Wochendienstplan verwalten — Woche {getWeekRange(weekDates)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-violet-500/40 text-violet-600 hover:bg-violet-500/10 hover:border-violet-500/60 hover:text-violet-600"
            onClick={() => setAiDialog((d) => ({ ...d, open: true }))}
          >
            <Sparkles className="h-4 w-4" /> KI-Dienstplan
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <FileDown className="h-4 w-4" /> Exportieren <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF} disabled={pdfExporting}>
                {pdfExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Als PDF exportieren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Drucken
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={openTeamShareDialog}>
            <Share2 className="h-4 w-4 mr-2" /> Teilen
          </Button>
          <Button onClick={() => {
            setEditingEmployee(null);
            setRoleCustom(false);
            employeeForm.reset({ name: "", role: "", email: "", phone: "", status: "active" });
            setEmployeeDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" /> Mitarbeiter hinzufügen
          </Button>
        </div>
      </div>

      {/* Shift reminders */}
      {shiftReminders && shiftReminders.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col gap-2">
            {shiftReminders.map((r) => (
              <Alert key={`${r.employeeId}-${r.startTime}`} className="bg-amber-500/10 border-amber-500/20">
                <Bell className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-amber-600">Schicht beginnt bald</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  {r.employeeName} ({r.role}) beginnt in {r.minutesUntilStart} Min. um {r.startTime} Uhr.
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </motion.div>
      )}

      {/* Currently working */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" /> Aktuell im Dienst
              {workingNow && workingNow.length > 0 && (
                <Badge className="ml-auto bg-emerald-500/15 text-emerald-600 border-emerald-500/20">
                  {workingNow.length} aktiv
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingWorkingNow ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
            ) : workingNow && workingNow.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {workingNow.map((emp) => (
                  <div key={emp.id} className="flex flex-col p-3 rounded-lg border bg-card">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">{emp.role}</p>
                      </div>
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                        {emp.shiftStart}–{emp.shiftEnd}
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-emerald-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Noch {emp.minutesUntilEnd} Min.
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Momentan ist niemand im Dienst.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Employee list */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <UserCircle2 className="h-5 w-5 text-primary" /> Mitarbeiter
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {activeEmployees.length} aktiv{inactiveEmployees.length > 0 && ` · ${inactiveEmployees.length} inaktiv`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEmployees ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : employees && employees.length > 0 ? (
              <div className="space-y-2">
                {employees.map((emp) => {
                  const empVacations = getEmployeeVacations(emp.id);
                  const today = new Date().toISOString().split("T")[0];
                  const activeVacation = empVacations.find((v) => v.startDate <= today && v.endDate >= today);
                  const nextVacation = empVacations.find((v) => v.startDate > today);
                  const weekShiftsCount = (shifts as Shift[] | undefined)?.filter((s) => s.employeeId === emp.id).length ?? 0;

                  return (
                    <div key={emp.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors group">
                      {/* Avatar */}
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                        {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{emp.name}</span>
                          <Badge
                            variant="outline"
                            className="text-xs h-5 px-1.5 bg-primary/5 text-primary border-primary/20"
                          >
                            {emp.role}
                          </Badge>
                          {emp.status === "inactive" && (
                            <Badge variant="secondary" className="text-xs h-5 px-1.5">Inaktiv</Badge>
                          )}
                          {activeVacation && (
                            <Badge variant="outline" className="text-xs h-5 px-1.5 bg-blue-500/10 text-blue-600 border-blue-500/20">
                              <TreePalm className="h-2.5 w-2.5 mr-1" /> Urlaub bis {formatDateDE(activeVacation.endDate)}
                            </Badge>
                          )}
                          {!activeVacation && nextVacation && (
                            <Badge variant="outline" className="text-xs h-5 px-1.5 bg-sky-500/10 text-sky-600 border-sky-500/20">
                              <CalendarDays className="h-2.5 w-2.5 mr-1" /> ab {formatDateDE(nextVacation.startDate)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground truncate">{emp.email}</span>
                          {emp.phone && <span className="text-xs text-muted-foreground">{emp.phone}</span>}
                          {weekShiftsCount > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {weekShiftsCount}×
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1.5 shrink-0"
                        onClick={() => openShareDialog(emp)}
                      >
                        <Share2 className="h-3 w-3" /> Teilen
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditEmployee(emp)}>
                            <Pencil className="mr-2 h-4 w-4" /> Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openShareDialog(emp)}>
                            <Share2 className="mr-2 h-4 w-4" /> Dienstplan teilen
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setVacationDialogEmployee(emp)}>
                            <TreePalm className="mr-2 h-4 w-4" /> Urlaub verwalten
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteEmployee(emp.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Noch keine Mitarbeiter angelegt</p>
                <p className="text-sm mt-1">Klicken Sie oben auf "Mitarbeiter hinzufügen" um zu starten.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Weekly schedule / Dienstplan */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-5 w-5 text-primary" /> Wochendienstplan
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{getWeekRange(weekDates)}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-primary/20 border border-primary/30" />
                  Schicht
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600" />
                  Frei
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700" />
                  Urlaub
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {loadingEmployees || loadingShifts ? (
              <div className="p-6"><Skeleton className="h-[300px] w-full" /></div>
            ) : activeEmployees.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Noch keine aktiven Mitarbeiter für den Dienstplan.</p>
              </div>
            ) : (
              <div className="min-w-[860px]">
                {/* Day header */}
                <div className="grid grid-cols-8 border-b border-border/50 bg-muted/30">
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Mitarbeiter
                  </div>
                  {DAYS.map((d) => (
                    <div key={d} className="px-2 py-2 text-center border-l border-border/30">
                      <div className="text-xs font-semibold">{DAY_LABELS[d]}</div>
                      <div className="text-xs text-muted-foreground">{weekDates[d]?.slice(5).replace("-", ".")}</div>
                    </div>
                  ))}
                </div>

                {/* Employee rows */}
                {activeEmployees.map((emp, empIdx) => (
                  <div
                    key={emp.id}
                    className={`grid grid-cols-8 border-b border-border/40 last:border-0 ${empIdx % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    {/* Employee name cell */}
                    <div className="px-4 py-3 flex flex-col justify-center gap-0.5 border-r border-border/30">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                          {emp.name[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium truncate">{emp.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground ml-8">{emp.role}</span>
                    </div>

                    {/* Day cells */}
                    {DAYS.map((day) => {
                      const dayOff = isDayOff(emp.id, day);
                      const dayVacation = isDayVacation(emp.id, day);
                      const empShifts = (shifts as Shift[] | undefined)?.filter(
                        (s) => s.employeeId === emp.id && s.dayOfWeek === day
                      ) ?? [];

                      return (
                        <div
                          key={`${emp.id}-${day}`}
                          className={`px-1.5 py-2 border-l border-border/30 min-h-[80px] flex flex-col gap-1 ${
                            dayVacation
                              ? "bg-blue-50 dark:bg-blue-900/15"
                              : dayOff
                              ? "bg-slate-100 dark:bg-slate-800/40"
                              : ""
                          }`}
                        >
                          {dayVacation ? (
                            <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium px-1 py-1">
                              <TreePalm className="h-3 w-3 shrink-0" />
                              <span>Urlaub</span>
                            </div>
                          ) : dayOff ? (
                            <div className="flex items-center justify-between px-1 py-1">
                              <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                                <Coffee className="h-3 w-3" /> Frei
                              </span>
                              <button
                                onClick={() => toggleOffDay.mutate({ employeeId: emp.id, dayOfWeek: day })}
                                className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
                                title="Ruhetag aufheben"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              {empShifts.map((shift) => (
                                <div
                                  key={shift.id}
                                  className="text-xs bg-primary/10 text-primary rounded px-1.5 py-1 flex items-center justify-between gap-1 group/shift"
                                >
                                  <span className="font-medium tabular-nums">
                                    {shift.startTime}–{shift.endTime}
                                  </span>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover/shift:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => openEditShiftDialog(shift)}
                                      className="hover:bg-primary/20 rounded p-0.5 transition-colors"
                                      title="Schicht bearbeiten"
                                    >
                                      <Pencil className="h-2.5 w-2.5" />
                                    </button>
                                    <button
                                      onClick={() => openCopyShiftDialog(shift)}
                                      className="hover:bg-primary/20 rounded p-0.5 transition-colors"
                                      title="Schicht kopieren"
                                    >
                                      <Copy className="h-2.5 w-2.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteShift(shift.id)}
                                      className="hover:bg-destructive/20 text-destructive rounded p-0.5 transition-colors"
                                      title="Schicht löschen"
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}

                          {/* Bottom action buttons */}
                          {!dayVacation && (
                            <div className="mt-auto flex flex-col gap-0.5 pt-1">
                              {!dayOff && (
                                <button
                                  onClick={() => openShiftDialog(emp.id, day)}
                                  className="w-full text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 py-1 rounded hover:bg-primary/5 transition-colors"
                                >
                                  <Plus className="h-2.5 w-2.5" /> Schicht
                                </button>
                              )}
                              <button
                                onClick={() => toggleOffDay.mutate({ employeeId: emp.id, dayOfWeek: day })}
                                className={`w-full text-xs flex items-center justify-center gap-1 py-1 rounded transition-colors ${
                                  dayOff
                                    ? "text-emerald-600 hover:bg-emerald-500/10"
                                    : "text-muted-foreground hover:text-slate-600 hover:bg-slate-500/10"
                                }`}
                                title={dayOff ? "Als Arbeitstag markieren" : "Als Ruhetag markieren"}
                              >
                                <Coffee className="h-2.5 w-2.5" />
                                {dayOff ? "Arbeiten" : "Frei"}
                              </button>
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

      {/* ── DIALOGS ── */}

      {/* Add employee */}
      <Dialog open={employeeDialogOpen} onOpenChange={(open) => {
        setEmployeeDialogOpen(open);
        if (!open) { setEditingEmployee(null); employeeForm.reset({ name: "", role: "", email: "", phone: "", status: "active" }); }
      }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Mitarbeiter bearbeiten" : "Neuen Mitarbeiter hinzufügen"}</DialogTitle>
          </DialogHeader>
          <Form {...employeeForm}>
            <form onSubmit={employeeForm.handleSubmit(onEmployeeSubmit)} className="space-y-4 pt-2">
              <FormField control={employeeForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vollständiger Name</FormLabel>
                  <FormControl><Input placeholder="z.B. Maria Müller" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Role with presets */}
              <FormField control={employeeForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rolle / Position</FormLabel>
                  {!roleCustom ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {ROLE_PRESETS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => field.onChange(r)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                              field.value === r
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setRoleCustom(true)}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Andere Rolle eingeben…
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <FormControl><Input placeholder="z.B. Eventkoordinator" {...field} /></FormControl>
                      <button
                        type="button"
                        onClick={() => { setRoleCustom(false); field.onChange(""); }}
                        className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
                      >
                        Vorschläge
                      </button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={employeeForm.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Aktiv</SelectItem>
                        <SelectItem value="inactive">Inaktiv</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={employeeForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon</FormLabel>
                    <FormControl><Input placeholder="z.B. 0664 123 456" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={employeeForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl><Input type="email" placeholder="mitarbeiter@example.at" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full" disabled={createEmployee.isPending || updateEmployee.isPending}>
                {editingEmployee ? "Änderungen speichern" : "Mitarbeiter erstellen"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add shift */}
      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              Schicht hinzufügen — {DAY_FULL[shiftDay]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <TimeSelect label="Beginn (Arbeitszeit)" value={newShiftStart} onChange={setNewShiftStart} />
              <TimeSelect label="Ende (Arbeitszeit)" value={newShiftEnd} onChange={setNewShiftEnd} />
            </div>
            {newShiftStart && newShiftEnd && newShiftStart < newShiftEnd && (
              <div className="text-sm text-center text-muted-foreground bg-muted/30 rounded-lg py-2">
                Dauer:{" "}
                <span className="font-semibold text-foreground">
                  {(() => {
                    const [sh, sm] = newShiftStart.split(":").map(Number);
                    const [eh, em] = newShiftEnd.split(":").map(Number);
                    const mins = (eh * 60 + em) - (sh * 60 + sm);
                    return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}min` : ""}`;
                  })()}
                </span>
              </div>
            )}
            <Button className="w-full" onClick={handleAddShift} disabled={createShift.isPending}>
              <Plus className="h-4 w-4 mr-2" /> Schicht hinzufügen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit shift */}
      <Dialog open={editShiftDialog.open} onOpenChange={(open) => {
        if (!open) setEditShiftDialog({ open: false, shift: null });
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              Schicht bearbeiten — {editShiftDialog.shift ? DAY_FULL[editShiftDialog.shift.dayOfWeek as Day] : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <TimeSelect label="Beginn" value={editShiftStart} onChange={setEditShiftStart} />
              <TimeSelect label="Ende" value={editShiftEnd} onChange={setEditShiftEnd} />
            </div>
            {editShiftStart && editShiftEnd && editShiftStart < editShiftEnd && (
              <div className="text-sm text-center text-muted-foreground bg-muted/30 rounded-lg py-2">
                Dauer:{" "}
                <span className="font-semibold text-foreground">
                  {(() => {
                    const [sh, sm] = editShiftStart.split(":").map(Number);
                    const [eh, em] = editShiftEnd.split(":").map(Number);
                    const mins = (eh * 60 + em) - (sh * 60 + sm);
                    return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}min` : ""}`;
                  })()}
                </span>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => {
                  if (editShiftDialog.shift) {
                    handleDeleteShift(editShiftDialog.shift.id);
                    setEditShiftDialog({ open: false, shift: null });
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Schicht löschen
              </Button>
              <Button className="flex-1" onClick={handleEditShiftSave} disabled={updateShift.isPending}>
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copy shift */}
      <Dialog open={copyShiftDialog.open} onOpenChange={(open) => {
        if (!open) setCopyShiftDialog({ open: false, shift: null });
      }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Schicht kopieren</DialogTitle>
          </DialogHeader>
          {copyShiftDialog.shift && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/30 rounded-lg p-3 text-sm text-center">
                <span className="font-semibold">{copyShiftDialog.shift.startTime} – {copyShiftDialog.shift.endTime}</span>
                <span className="text-muted-foreground ml-2">
                  ({DAY_FULL[copyShiftDialog.shift.dayOfWeek as Day]})
                </span>
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Ziel-Tag</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCopyTargetDay(d)}
                      disabled={d === copyShiftDialog.shift?.dayOfWeek}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        copyTargetDay === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : d === copyShiftDialog.shift?.dayOfWeek
                          ? "opacity-30 cursor-not-allowed border-border"
                          : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {DAY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={handleCopyShift} disabled={createShift.isPending}>
                <Copy className="h-4 w-4 mr-2" /> Nach {DAY_FULL[copyTargetDay]} kopieren
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share schedule */}
      <Dialog open={shareDialog.open} onOpenChange={(open) => {
        if (!open) setShareDialog({ open: false, employee: null, mode: "employee" });
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              {shareDialog.mode === "team"
                ? "Teamdienstplan teilen"
                : `Dienstplan – ${shareDialog.employee?.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Preview */}
            <div className="bg-muted/30 rounded-lg p-3 max-h-48 overflow-y-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                {getShareText()}
              </pre>
            </div>

            <p className="text-xs text-muted-foreground text-center">Wählen Sie eine Übertragungsart:</p>

            {/* WhatsApp */}
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant="outline"
                className="justify-start gap-3 h-auto py-3 border-green-500/30 hover:bg-green-500/10 hover:border-green-500/60"
                onClick={() => shareViaWhatsApp(getShareText(), shareDialog.employee?.phone)}
              >
                <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                  <MessageCircle className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">Per WhatsApp senden</div>
                  <div className="text-xs text-muted-foreground">
                    {shareDialog.employee?.phone ? `An ${shareDialog.employee.phone}` : "Nummer manuell eingeben"}
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="justify-start gap-3 h-auto py-3 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/60"
                onClick={() => shareViaEmail(getShareText(), shareDialog.employee?.email)}
              >
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">Per E-Mail senden</div>
                  <div className="text-xs text-muted-foreground">
                    {shareDialog.employee?.email ? `An ${shareDialog.employee.email}` : "E-Mail-Adresse eingeben"}
                  </div>
                </div>
              </Button>

              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button
                  variant="outline"
                  className="justify-start gap-3 h-auto py-3"
                  onClick={async () => {
                    const ok = await shareViaNative(
                      getShareText(),
                      `Dienstplan – ${shareDialog.employee?.name ?? "Team"}`
                    );
                    if (!ok) toast({ title: "Teilen nicht verfügbar", variant: "destructive" });
                  }}
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Share2 className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">Weitere Optionen</div>
                    <div className="text-xs text-muted-foreground">Systemfreigabe (SMS, Messenger, …)</div>
                  </div>
                </Button>
              )}

              <Button
                variant="ghost"
                className="text-xs text-muted-foreground"
                onClick={() => {
                  navigator.clipboard.writeText(getShareText());
                  toast({ title: "In Zwischenablage kopiert" });
                }}
              >
                Text kopieren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vacation management */}
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
              <div>
                <p className="text-sm font-medium mb-2 text-muted-foreground">Eingetragene Urlaubszeiträume</p>
                {getEmployeeVacations(vacationDialogEmployee.id).length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Kein Urlaub eingetragen.</p>
                  </div>
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

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Neuen Urlaubszeitraum eintragen</p>
                <form onSubmit={handleVacationSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Von</label>
                      <Input type="date" value={vacationStart} onChange={(e) => setVacationStart(e.target.value)} required />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Bis</label>
                      <Input type="date" value={vacationEnd} min={vacationStart} onChange={(e) => setVacationEnd(e.target.value)} required />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Notiz (optional)</label>
                    <Input
                      placeholder="z.B. Familienurlaub, Erholung…"
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

      {/* AI Auto Schedule Dialog */}
      <Dialog open={aiDialog.open} onOpenChange={(open) => !open && setAiDialog((d) => ({ ...d, open: false }))}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Dienstplan automatisch erstellen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-1">
            <p className="text-sm text-muted-foreground">
              Erstellt einen vollständigen Wochenplan für alle aktiven Mitarbeiter — basierend auf Betriebstyp und typischen Stoßzeiten.
            </p>

            {/* Business type selector */}
            <div>
              <p className="text-sm font-medium mb-2">Betriebstyp</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: "restaurant", label: "Restaurant", icon: "🍽️" },
                    { key: "cafe",       label: "Café",       icon: "☕" },
                    { key: "bar",        label: "Bar",        icon: "🍺" },
                  ] as const
                ).map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAiDialog((d) => ({ ...d, businessType: key }))}
                    className={`py-3 rounded-lg border text-sm font-medium transition-all ${
                      aiDialog.businessType === key
                        ? "bg-violet-500/15 border-violet-500 text-violet-600"
                        : "border-border hover:border-violet-500/40 text-muted-foreground"
                    }`}
                  >
                    <div className="text-xl mb-1">{icon}</div>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Times preview */}
            <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Geplante Schichtzeiten:</p>
              <p className="text-sm font-mono font-semibold">
                {BUSINESS_TIMES[aiDialog.businessType].start} – {BUSINESS_TIMES[aiDialog.businessType].end}
              </p>
              <p className="text-xs text-muted-foreground">
                5 Arbeitstage + 2 Freitage pro Mitarbeiter, gleichmäßig verteilt
              </p>
            </div>

            <div className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
              Bestehende Schichten bleiben erhalten — nur fehlende Tage werden ergänzt.
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setAiDialog((d) => ({ ...d, open: false }))}>
                Abbrechen
              </Button>
              <Button
                onClick={handleAIGenerate}
                disabled={aiGenerating}
                className="gap-2 bg-violet-600 hover:bg-violet-700"
              >
                {aiGenerating
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird erstellt…</>
                  : <><Sparkles className="h-4 w-4" /> Dienstplan erstellen</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
