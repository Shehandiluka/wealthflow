import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/AppLayout";
import { Seo } from "@/components/Seo";
import { PinLockScreen } from "@/components/PinLockScreen";
import { useAutoLock } from "@/hooks/useAutoLock";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// Everything behind the PIN lock is only needed after sign-in (and PIN unlock),
// so it's route-split rather than bundled into the initial load — this was the
// single biggest contributor to the ~1.6MB main bundle.
const Index = lazy(() => import("./pages/Index"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Investments = lazy(() => import("./pages/Investments"));
const Debts = lazy(() => import("./pages/Debts"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Settings = lazy(() => import("./pages/Settings"));
const Recurring = lazy(() => import("./pages/Recurring"));
const Trips = lazy(() => import("./pages/Trips"));
const PayLater = lazy(() => import("./pages/PayLater"));
const Lending = lazy(() => import("./pages/Lending"));
const Categories = lazy(() => import("./pages/Categories"));
const SmsImports = lazy(() => import("./pages/SmsImports"));
const SavingsGoals = lazy(() => import("./pages/SavingsGoals"));

function RouteLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const queryClient = new QueryClient();

// PIN-unlock is remembered per signed-in user for the lifetime of this browser
// tab (sessionStorage, not localStorage) — so refreshing or navigating around
// the app doesn't re-prompt for the PIN, but closing the tab/browser, or
// switching accounts, does require it again.
const pinUnlockKey = (userId: string) => `wealthflow_pin_unlocked_${userId}`;
const AUTO_LOCK_MS = 15 * 60 * 1000; // 15 minutes of no mouse/keyboard/touch activity

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (user && sessionStorage.getItem(pinUnlockKey(user.id)) === "1") {
      setUnlocked(true);
    }
  }, [user]);

  const handleUnlock = () => {
    if (user) sessionStorage.setItem(pinUnlockKey(user.id), "1");
    setUnlocked(true);
  };

  const handleAutoLock = useCallback(() => {
    if (user) sessionStorage.removeItem(pinUnlockKey(user.id));
    setUnlocked(false);
  }, [user]);

  useAutoLock(unlocked ? user?.id : undefined, AUTO_LOCK_MS, handleAutoLock);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!unlocked) {
    return <PinLockScreen onUnlock={handleUnlock} />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Seo />
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      {!user && <Route path="/" element={<Landing />} />}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Suspense fallback={<RouteLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/investments" element={<Investments />} />
                  <Route path="/debts" element={<Debts />} />
                  <Route path="/savings-goals" element={<SavingsGoals />} />
                  <Route path="/budgets" element={<Budgets />} />
                  <Route path="/recurring" element={<Recurring />} />
                  <Route path="/trips" element={<Trips />} />
                  <Route path="/pay-later" element={<PayLater />} />
                  <Route path="/lending" element={<Lending />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/sms-imports" element={<SmsImports />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
