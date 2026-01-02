import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import AdminLayout from "./components/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Scales from "./pages/Scales";
import Printers from "./pages/Printers";
import Routing from "./pages/Routing";
import Queue from "./pages/Queue";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import Monitoring from "./pages/Monitoring";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <Switch>
      {/* Public route - Login */}
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <Login />}
      </Route>

      {/* Protected routes */}
      <Route path="/">
        <ProtectedRoute>
          <AdminLayout>
            <Dashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/scales">
        <ProtectedRoute>
          <AdminLayout>
            <Scales />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/printers">
        <ProtectedRoute>
          <AdminLayout>
            <Printers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/routing">
        <ProtectedRoute>
          <AdminLayout>
            <Routing />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/queue">
        <ProtectedRoute>
          <AdminLayout>
            <Queue />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/logs">
        <ProtectedRoute>
          <AdminLayout>
            <Logs />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <AdminLayout>
            <Settings />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/monitoring">
        <ProtectedRoute>
          <AdminLayout>
            <Monitoring />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
