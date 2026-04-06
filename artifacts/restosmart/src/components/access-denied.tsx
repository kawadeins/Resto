import { ShieldX } from "lucide-react";
import { usePermissions, type TeamRole } from "@/hooks/use-permissions";

const ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Inhaber",
  manager: "Manager",
  staff: "Mitarbeiter",
};

interface AccessDeniedProps {
  requiredRole?: TeamRole | TeamRole[];
  section?: string;
}

export function AccessDenied({ requiredRole, section }: AccessDeniedProps) {
  const { role } = usePermissions();

  const allowedRoles = requiredRole
    ? Array.isArray(requiredRole)
      ? requiredRole.map((r) => ROLE_LABELS[r]).join(" oder ")
      : ROLE_LABELS[requiredRole]
    : "Inhaber";

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Kein Zugriff</h2>
        <p className="text-sm text-gray-400 mb-4">
          {section
            ? `Der Bereich "${section}" ist nur für ${allowedRoles} verfügbar.`
            : `Dieser Bereich ist nur für ${allowedRoles} verfügbar.`}
        </p>
        <p className="text-xs text-gray-600">
          Deine aktuelle Rolle: <span className="text-gray-400 font-medium">{ROLE_LABELS[role]}</span>
        </p>
        <a
          href={import.meta.env.BASE_URL}
          className="inline-block mt-6 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          Zur Übersicht
        </a>
      </div>
    </div>
  );
}

interface RoleGuardProps {
  children: React.ReactNode;
  allowed: TeamRole | TeamRole[];
  section?: string;
}

export function RoleGuard({ children, allowed, section }: RoleGuardProps) {
  const { role, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  const allowedArr = Array.isArray(allowed) ? allowed : [allowed];
  if (!allowedArr.includes(role)) {
    return <AccessDenied requiredRole={allowed} section={section} />;
  }

  return <>{children}</>;
}
