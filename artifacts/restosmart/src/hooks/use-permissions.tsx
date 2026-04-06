import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export type TeamRole = "owner" | "manager" | "staff";

export interface Permissions {
  canViewDashboard: boolean;
  canManageContent: boolean;
  canUseBoostTools: boolean;
  canViewAnalytics: boolean;
  canAccessBilling: boolean;
  canManagePremium: boolean;
  canManageTeam: boolean;
  canAccessSettings: boolean;
  canManageMenu: boolean;
  canManageReservations: boolean;
}

const ALL_PERMISSIONS: Permissions = {
  canViewDashboard: true,
  canManageContent: true,
  canUseBoostTools: true,
  canViewAnalytics: true,
  canAccessBilling: true,
  canManagePremium: true,
  canManageTeam: true,
  canAccessSettings: true,
  canManageMenu: true,
  canManageReservations: true,
};

const STAFF_PERMISSIONS: Permissions = {
  canViewDashboard: true,
  canManageContent: false,
  canUseBoostTools: false,
  canViewAnalytics: false,
  canAccessBilling: false,
  canManagePremium: false,
  canManageTeam: false,
  canAccessSettings: false,
  canManageMenu: false,
  canManageReservations: true,
};

interface PermissionContextValue {
  role: TeamRole;
  permissions: Permissions;
  isLoading: boolean;
  hasPermission: (key: keyof Permissions) => boolean;
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export const ROUTE_PERMISSIONS: Record<string, keyof Permissions | null> = {
  "/": null,
  "/profile": null,
  "/bookings": null,
  "/reservations": "canManageReservations",
  "/tables": null,
  "/staff": "canManageContent",
  "/payroll": "canAccessBilling",
  "/team": "canManageTeam",
  "/inventory": "canManageContent",
  "/menu": "canManageMenu",
  "/pos": null,
  "/finances": "canAccessBilling",
  "/analytics": "canViewAnalytics",
  "/boost": "canUseBoostTools",
  "/marketing": "canUseBoostTools",
  "/insights": "canViewAnalytics",
  "/campaigns": "canUseBoostTools",
  "/optimizer": "canUseBoostTools",
  "/reviews": null,
  "/billing": "canAccessBilling",
  "/onboarding": null,
  "/super-admin": "canAccessSettings",
};

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const ownerEmail = localStorage.getItem("restosmart_owner_email") ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["team-permissions", ownerEmail],
    queryFn: async () => {
      if (!ownerEmail) return { role: "staff" as TeamRole, permissions: STAFF_PERMISSIONS };
      try {
        const res = await fetch(`${API_BASE}/api/team/permissions`, {
          headers: { "x-user-email": ownerEmail },
        });
        if (!res.ok) return { role: "staff" as TeamRole, permissions: STAFF_PERMISSIONS };
        const json = await res.json();
        if (!json.role) return { role: "staff" as TeamRole, permissions: STAFF_PERMISSIONS };
        return json as { role: TeamRole; permissions: Permissions };
      } catch {
        return { role: "staff" as TeamRole, permissions: STAFF_PERMISSIONS };
      }
    },
    staleTime: 60_000,
    retry: 1,
  });

  const role = data?.role ?? "staff";
  const permissions = data?.permissions ?? STAFF_PERMISSIONS;

  const hasPermission = (key: keyof Permissions): boolean => {
    return permissions[key] === true;
  };

  return (
    <PermissionContext.Provider
      value={{
        role,
        permissions,
        isLoading,
        hasPermission,
        isOwner: role === "owner",
        isManager: role === "manager",
        isStaff: role === "staff",
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error("usePermissions must be used inside PermissionProvider");
  return ctx;
}

export function canAccessRoute(route: string, permissions: Permissions): boolean {
  const requiredPerm = ROUTE_PERMISSIONS[route];
  if (requiredPerm === null || requiredPerm === undefined) return true;
  return permissions[requiredPerm] === true;
}
