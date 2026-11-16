import { useState } from "react";
import { motion } from "framer-motion";
import { Database, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "accounts", "transactions", "categories", "budgets", "debts",
  "investments", "investment_types", "investment_contributions",
  "recurring_transactions", "trips", "trip_planned_expenses",
  "pay_later", "pay_later_items", "pay_later_payments",
  "lending_contacts", "lending_transactions",
  "savings_goals", "savings_goal_contributions",
  "sms_imports", "sms_api_keys",
] as const;

interface Counts {
  [table: string]: number | "error";
}

export function DataHealthCheck() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const runCheck = async () => {
    setLoading(true);
    const results: Counts = {};
    await Promise.all(
      TABLES.map(async (table) => {
        const { count, error } = await supabase
          .from(table as any)
          .select("*", { count: "exact", head: true });
        results[table] = error ? "error" : (count ?? 0);
      })
    );
    setCounts(results);
    setCheckedAt(new Date());
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground tracking-normal">Data Health Check</h2>
        </div>
        <Button size="sm" variant="outline" onClick={runCheck} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {counts ? "Recheck" : "Check now"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        See exactly how many rows of each type are actually in your database right now — no command line needed.
      </p>

      {counts && (
        <div className="space-y-1 pt-2 border-t border-border">
          {TABLES.map((table) => (
            <div key={table} className="flex items-center justify-between text-xs py-1">
              <span className="text-muted-foreground">{table}</span>
              <span className={`font-mono font-medium ${counts[table] === "error" ? "text-destructive" : ""}`}>
                {counts[table] === "error" ? "couldn't read" : counts[table]}
              </span>
            </div>
          ))}
          {checkedAt && (
            <p className="text-[10px] text-muted-foreground text-right pt-1">
              Checked at {checkedAt.toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
