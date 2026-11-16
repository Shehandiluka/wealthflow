import { NetWorthWidget } from "@/components/dashboard/NetWorthWidget";
import { FinancialHealthScore } from "@/components/dashboard/FinancialHealthScore";
import { SavingsGoalsWidget } from "@/components/dashboard/SavingsGoalsWidget";
import { AccountCards } from "@/components/dashboard/AccountCards";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { SpendingChart } from "@/components/dashboard/SpendingChart";
import { IncomeChart } from "@/components/dashboard/IncomeChart";
import { SmartInsights } from "@/components/dashboard/SmartInsights";
import { BudgetAlerts } from "@/components/dashboard/BudgetAlerts";
import { BudgetSummary } from "@/components/dashboard/BudgetSummary";
import { UpcomingRecurring } from "@/components/dashboard/UpcomingRecurring";
import { SyncIndicator } from "@/components/dashboard/SyncIndicator";
import { PullToRefreshWrapper } from "@/components/PullToRefreshWrapper";
import { QuickNoteDraft } from "@/components/dashboard/QuickNoteDraft";
import { DraftReminderBanner } from "@/components/dashboard/DraftReminderBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

const Dashboard = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "there";

  return (
    <PullToRefreshWrapper className="h-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold tracking-tight">Hi, {displayName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Here's your financial overview
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SyncIndicator />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <DraftReminderBanner />

        <QuickNoteDraft />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section aria-labelledby="overview-heading" className="lg:col-span-2 space-y-6">
            <h2 id="overview-heading" className="sr-only">Balances and recent activity</h2>
            <NetWorthWidget />
            <FinancialHealthScore />
            <SavingsGoalsWidget />
            <AccountCards />
            <RecentTransactions />
          </section>

          <section aria-labelledby="insights-heading" className="space-y-6">
            <h2 id="insights-heading" className="sr-only">Budgets, upcoming payments and insights</h2>
            <BudgetAlerts />
            <UpcomingRecurring />
            <BudgetSummary />
            <SpendingChart />
            <IncomeChart />
            <SmartInsights />
          </section>
        </div>
      </div>
    </PullToRefreshWrapper>
  );
};

export default Dashboard;
