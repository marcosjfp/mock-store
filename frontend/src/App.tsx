import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { canViewWorkspace } from "./auth/roles";
import { useAuth } from "./context/AuthContext";
import { AppShell } from "./layout/AppShell";
import ActivityPage from "./pages/ActivityPage";
import CatalogPage from "./pages/CatalogPage";
import LoginPage from "./pages/LoginPage";
import NewOrderPage from "./pages/NewOrderPage";
import NotFoundPage from "./pages/NotFoundPage";
import OrdersPage from "./pages/OrdersPage";
import OverviewPage from "./pages/OverviewPage";
import TeamPage from "./pages/TeamPage";

export default function App() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();

  // Never let one session's cached data outlive it.
  useEffect(() => {
    if (!auth) {
      queryClient.clear();
    }
  }, [auth, queryClient]);

  if (!auth) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  const workspace = canViewWorkspace(auth.role);

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/new" element={<NewOrderPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        {workspace && <Route path="team" element={<TeamPage />} />}
        {workspace && <Route path="activity" element={<ActivityPage />} />}
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
