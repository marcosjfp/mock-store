import { Activity, LayoutDashboard, LucideIcon, Package, ReceiptText, Users } from "lucide-react";

import { UserRole, canViewWorkspace } from "../auth/roles";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  allowed?: (role: UserRole) => boolean;
};

export const NAV_SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Store",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
      { to: "/orders", label: "Orders", icon: ReceiptText },
      { to: "/catalog", label: "Catalog", icon: Package },
    ],
  },
  {
    title: "Workspace",
    items: [
      { to: "/team", label: "Team", icon: Users, allowed: canViewWorkspace },
      { to: "/activity", label: "Activity", icon: Activity, allowed: canViewWorkspace },
    ],
  },
];

export function visibleSections(role: UserRole) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.allowed || item.allowed(role)),
  })).filter((section) => section.items.length > 0);
}
