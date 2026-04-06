import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, Shield, ShieldCheck, ShieldAlert, Mail, MoreVertical, Check, X, RefreshCw, Trash2, Copy, Info } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function getOwnerEmail(): string {
  return localStorage.getItem("restosmart_owner_email") ?? "owner@restosmart.app";
}

type TeamRole = "owner" | "manager" | "staff";

interface TeamMember {
  id: number;
  email: string;
  name: string;
  role: TeamRole;
  status: "active" | "pending" | "removed";
  isOwner: boolean;
  createdAt: string;
}

const ROLE_CONFIG: Record<TeamRole, { label: string; color: string; icon: typeof Shield; desc: string }> = {
  owner: {
    label: "Inhaber",
    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    icon: ShieldAlert,
    desc: "Voller Zugriff, Abrechnung, Team-Verwaltung",
  },
  manager: {
    label: "Manager",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    icon: ShieldCheck,
    desc: "Inhalte, Boost, Analyse — kein Zugriff auf Abrechnung",
  },
  staff: {
    label: "Mitarbeiter",
    color: "text-gray-400 bg-gray-400/10 border-gray-400/20",
    icon: Shield,
    desc: "Eingeschränkter Zugriff, Dashboard ansehen",
  },
};

const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  active: { label: "Aktiv", dot: "bg-emerald-400" },
  pending: { label: "Ausstehend", dot: "bg-amber-400" },
  removed: { label: "Entfernt", dot: "bg-red-400" },
};

export default function Team() {
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("staff");
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [lastInviteToken, setLastInviteToken] = useState<string | null>(null);

  const ownerEmail = getOwnerEmail();

  const { data, isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/team`, {
        headers: { "x-user-email": ownerEmail },
      });
      if (!res.ok) {
        if (res.status === 403) {
          await fetch(`${API_BASE}/api/team/bootstrap-owner`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: ownerEmail }),
          });
          const retry = await fetch(`${API_BASE}/api/team`, {
            headers: { "x-user-email": ownerEmail },
          });
          if (!retry.ok) throw new Error("Failed to load team");
          return retry.json() as Promise<{ members: TeamMember[] }>;
        }
        throw new Error("Failed to load team");
      }
      const json = await res.json() as { members: TeamMember[]; needsOwnerSetup?: boolean };
      if (json.needsOwnerSetup) {
        await fetch(`${API_BASE}/api/team/bootstrap-owner`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: ownerEmail }),
        });
        const retry = await fetch(`${API_BASE}/api/team`, {
          headers: { "x-user-email": ownerEmail },
        });
        if (!retry.ok) throw new Error("Failed to load team");
        return retry.json() as Promise<{ members: TeamMember[] }>;
      }
      return json;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: { email: string; name: string; role: string }) => {
      const res = await fetch(`${API_BASE}/api/team/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": ownerEmail },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fehler beim Einladen");
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setShowInvite(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("staff");
      if (data.inviteToken) setLastInviteToken(data.inviteToken);
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await fetch(`${API_BASE}/api/team/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-email": ownerEmail },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fehler");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setActionMenuId(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/api/team/${id}`, {
        method: "DELETE",
        headers: { "x-user-email": ownerEmail },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fehler");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setActionMenuId(null);
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (memberId: number) => {
      const res = await fetch(`${API_BASE}/api/team/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": ownerEmail },
        body: JSON.stringify({ memberId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fehler");
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setActionMenuId(null);
      if (data.inviteToken) {
        setLastInviteToken(data.inviteToken);
      }
    },
  });

  const members = data?.members?.filter((m) => m.status !== "removed") ?? [];
  const activeCount = members.filter((m) => m.status === "active").length;
  const pendingCount = members.filter((m) => m.status === "pending").length;

  function copyToken(token: string) {
    navigator.clipboard.writeText(token).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Team verwalten
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {activeCount} aktiv{pendingCount > 0 ? ` · ${pendingCount} ausstehend` : ""}
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Mitarbeiter einladen
        </button>
      </div>

      {lastInviteToken && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-300">Einladung erfolgreich gesendet</p>
              <p className="text-xs text-gray-400 mt-1">Einladungs-Token (zum Teilen):</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs bg-[#1a1a1a] text-gray-300 px-2 py-1 rounded font-mono truncate block">
                  {lastInviteToken}
                </code>
                <button
                  onClick={() => copyToken(lastInviteToken)}
                  className="text-gray-400 hover:text-white transition-colors shrink-0"
                  title="Kopieren"
                >
                  {copiedToken === lastInviteToken ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button onClick={() => setLastInviteToken(null)} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(["owner", "manager", "staff"] as TeamRole[]).map((role) => {
          const cfg = ROLE_CONFIG[role];
          const Icon = cfg.icon;
          return (
            <div key={role} className="bg-[#141414] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${cfg.color.split(" ")[0]}`} />
                <span className="text-sm font-medium text-white">{cfg.label}</span>
              </div>
              <p className="text-xs text-gray-500">{cfg.desc}</p>
            </div>
          );
        })}
      </div>

      {showInvite && (
        <div className="bg-[#141414] border border-white/10 rounded-xl p-5">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Neues Teammitglied einladen
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Name</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="z.B. Maria Schmidt"
                className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">E-Mail</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="maria@beispiel.at"
                className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-xs text-gray-400 mb-2 block">Rolle</label>
            <div className="flex gap-3">
              {(["manager", "staff"] as TeamRole[]).map((r) => {
                const cfg = ROLE_CONFIG[r];
                const Icon = cfg.icon;
                return (
                  <button
                    key={r}
                    onClick={() => setInviteRole(r)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-all ${
                      inviteRole === r
                        ? `${cfg.color} border-current`
                        : "bg-[#0d0d0d] border-white/10 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => inviteMutation.mutate({ email: inviteEmail, name: inviteName, role: inviteRole })}
              disabled={!inviteName.trim() || !inviteEmail.trim() || inviteMutation.isPending}
              className="bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {inviteMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Einladung senden
            </button>
            <button
              onClick={() => { setShowInvite(false); setInviteName(""); setInviteEmail(""); }}
              className="text-gray-400 hover:text-white px-4 py-2 text-sm transition-colors"
            >
              Abbrechen
            </button>
          </div>
          {inviteMutation.isError && (
            <p className="text-xs text-red-400 mt-2">{(inviteMutation.error as Error).message}</p>
          )}
        </div>
      )}

      <div className="bg-[#141414] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5">
          <h3 className="text-sm font-medium text-white">Teammitglieder</h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-5 h-5 text-gray-500 animate-spin mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Lade Team...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-8 h-8 text-gray-600 mx-auto" />
            <p className="text-sm text-gray-400 mt-2">Noch keine Teammitglieder</p>
            <p className="text-xs text-gray-600 mt-1">Laden Sie Ihr Team ein, um den Zugriff zu teilen</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {members.map((member) => {
              const roleCfg = ROLE_CONFIG[member.role];
              const RoleIcon = roleCfg.icon;
              const statusCfg = STATUS_LABELS[member.status] ?? STATUS_LABELS.active;

              return (
                <div key={member.id} className="px-5 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-sm font-medium text-gray-300 shrink-0">
                    {member.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{member.name}</span>
                      {member.isOwner && (
                        <span className="text-[10px] bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded">
                          Inhaber
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{member.email}</p>
                  </div>

                  <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs ${roleCfg.color}`}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    {roleCfg.label}
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                  </div>

                  {!member.isOwner && (
                    <div className="relative">
                      <button
                        onClick={() => setActionMenuId(actionMenuId === member.id ? null : member.id)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {actionMenuId === member.id && (
                        <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-20 w-48 py-1">
                          {member.status === "pending" && (
                            <button
                              onClick={() => resendMutation.mutate(member.id)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Erneut einladen
                            </button>
                          )}
                          {member.status === "active" && member.role !== "manager" && (
                            <button
                              onClick={() => changeRoleMutation.mutate({ id: member.id, role: "manager" })}
                              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Zum Manager machen
                            </button>
                          )}
                          {member.status === "active" && member.role !== "staff" && (
                            <button
                              onClick={() => changeRoleMutation.mutate({ id: member.id, role: "staff" })}
                              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              Zum Mitarbeiter machen
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`${member.name} wirklich entfernen?`)) {
                                removeMutation.mutate(member.id);
                              }
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Entfernen
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-[#141414] border border-white/5 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-gray-400">
              <span className="font-medium text-gray-300">Tipp:</span>{" "}
              Team hinzufügen und Zugriff teilen — so können Manager und Mitarbeiter direkt im Dashboard mitarbeiten,
              ohne Zugang zu sensiblen Einstellungen zu erhalten.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
