import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  BarChart3,
  TrendingUp,
  Receipt,
  Target,
  RefreshCw,
  Plane,
  HandCoins,
  Users,
  Tag,
  MessageSquare,
  Settings,
  LogOut,
  Sun,
  Moon,
  PiggyBank,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

// Grouped for scannability — every existing route stays, same URLs, same
// order within its group; only the visual hierarchy changes.
const navGroups = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
  },
  {
    label: "Money",
    items: [
      { title: "Accounts", url: "/accounts", icon: Wallet },
      { title: "Transactions", url: "/transactions", icon: ArrowRightLeft },
      { title: "Analytics", url: "/analytics", icon: BarChart3 },
      { title: "Budgets", url: "/budgets", icon: Target },
    ],
  },
  {
    label: "Growth & Goals",
    items: [
      { title: "Investments", url: "/investments", icon: TrendingUp },
      { title: "Savings Goals", url: "/savings-goals", icon: PiggyBank },
      { title: "Recurring", url: "/recurring", icon: RefreshCw },
      { title: "Trips", url: "/trips", icon: Plane },
    ],
  },
  {
    label: "Credit & Lending",
    items: [
      { title: "Debts & EMI", url: "/debts", icon: Receipt },
      { title: "Pay Later", url: "/pay-later", icon: HandCoins },
      { title: "Lend & Borrow", url: "/lending", icon: Users },
    ],
  },
  {
    label: "Setup",
    items: [
      { title: "Categories", url: "/categories", icon: Tag },
      { title: "SMS Imports", url: "/sms-imports", icon: MessageSquare },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-sidebar border-r border-sidebar-border p-4">
      <div className="mb-6 px-3">
        <div className="font-display text-xl">WealthFlow</div>
        <p className="text-xs text-muted-foreground mt-1">Smart Money Manager</p>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.url === "/"}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  activeClassName="bg-sidebar-accent text-primary font-medium"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-sidebar-border space-y-1">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
