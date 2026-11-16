import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  BarChart3,
  MoreHorizontal,
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
  X,
  PiggyBank,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const mainItems = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Accounts", url: "/accounts", icon: Wallet },
  { title: "Txns", url: "/transactions", icon: ArrowRightLeft },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

// Same routes as before, grouped under headings instead of one flat list —
// nothing removed, nothing reordered across groups.
const moreGroups = [
  {
    label: "Money",
    items: [{ title: "Budgets", url: "/budgets", icon: Target }],
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

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      {/* More menu overlay */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl p-4 pb-8 space-y-1 max-h-[75vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-sm font-semibold">More</span>
                <button onClick={() => setMoreOpen(false)} aria-label="Close more menu" className="p-1 rounded-lg hover:bg-secondary">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                {moreGroups.map((group) => (
                  <div key={group.label}>
                    <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {group.label}
                    </p>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.url}
                          to={item.url}
                          end={false}
                          className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-foreground hover:bg-secondary transition-colors"
                          activeClassName="bg-secondary text-primary font-medium"
                          onClick={() => setMoreOpen(false)}
                        >
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border my-2" />

              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-foreground hover:bg-secondary transition-colors w-full"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
              </button>

              <button
                onClick={signOut}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-foreground hover:bg-secondary transition-colors w-full"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/90 backdrop-blur-xl border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around py-2">
          {mainItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-muted-foreground transition-colors"
              activeClassName="text-primary"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.title}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-muted-foreground transition-colors"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
