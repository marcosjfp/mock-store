import { useAuth } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  const { auth, setAuth, clearAuth } = useAuth();

  if (!auth) {
    return <LoginPage onAuthenticated={setAuth} />;
  }

  return <DashboardPage auth={auth} onLogout={clearAuth} />;
}
