import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/data";
import { useTransactions } from "@/hooks/useTransactions";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

const COLORS = [
  "hsl(145, 70%, 45%)",
  "hsl(200, 80%, 50%)",
  "hsl(250, 70%, 60%)",
  "hsl(35, 90%, 55%)",
  "hsl(320, 65%, 55%)",
  "hsl(170, 75%, 42%)",
  "hsl(15, 80%, 55%)",
  "hsl(220, 65%, 55%)",
];

export function IncomeChart() {
  const { data: transactions = [], isLoading } = useTransactions();

  const incomeByCategory = useMemo(() => {
    const map = new Map<string, number>();
    transactions
      .filter((t) => t.type === "income")
      .forEach((t) => {
        map.set(t.category, (map.get(t.category) || 0) + t.amount);
      });
    return Array.from(map.entries())
      .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const total = incomeByCategory.reduce((s, c) => s + c.value, 0);

  if (isLoading) {
    return (
      <div className="glass-card p-5 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (incomeByCategory.length === 0) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground tracking-normal mb-4">Income by Category</h3>
        <p className="text-sm text-muted-foreground text-center py-6">No income data yet.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      className="glass-card p-5"
    >
      <h3 className="text-sm font-semibold text-muted-foreground tracking-normal mb-4">
        Income by Category
      </h3>

      <div className="flex items-center gap-4">
        <div className="w-32 h-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={incomeByCategory}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={55}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {incomeByCategory.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "hsl(var(--popover-foreground))",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-2">
          {incomeByCategory.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                <span className="text-muted-foreground">{cat.name}</span>
              </div>
              <span className="font-mono font-medium">{formatCurrency(cat.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border text-center">
        <span className="text-xs text-muted-foreground">Total: </span>
        <span className="text-sm font-semibold font-mono">{formatCurrency(total)}</span>
      </div>
    </motion.div>
  );
}
