import { Role } from "../api/client";

/**
 * Accounts created by `backend/scripts/seed_demo.py`. They only exist in a
 * locally seeded database and are shown on the sign-in screen so a reviewer
 * can explore each role in one click.
 */
export const DEMO_TENANT = "rail-byte";
export const DEMO_PASSWORD = "StrongPass123!";

export const DEMO_ACCOUNTS: Array<{ role: Role; email: string; name: string; blurb: string }> = [
  { role: "owner", email: "owner@railbyte.com", name: "Marina Costa", blurb: "Everything, including the team" },
  { role: "manager", email: "manager@railbyte.com", name: "Daniel Okafor", blurb: "Catalog, stock and orders" },
  { role: "staff", email: "staff@railbyte.com", name: "Priya Nair", blurb: "Sells and fulfils orders" },
];
