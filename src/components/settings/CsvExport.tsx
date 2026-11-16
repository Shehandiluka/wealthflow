import { useState } from "react";
import { motion } from "framer-motion";
import { FileSpreadsheet, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

/** Escapes a value for a CSV cell — wraps in quotes and doubles any internal quotes if needed. */
function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function CsvExport() {
  const [exporting, setExporting] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { toast } = useToast();

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from("transactions")
        .select("date, type, category, description, amount, currency, account_id, to_account_id")
        .order("date", { ascending: false });
      if (startDate) query = query.gte("date", startDate);
      if (endDate) query = query.lte("date", endDate);

      const { data: transactions, error } = await query;
      if (error) throw error;

      const { data: accounts } = await supabase.from("accounts").select("id, name");
      const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));

      const headers = ["Date", "Type", "Category", "Description", "Amount", "Currency", "Account", "To Account"];
      const rows = (transactions ?? []).map((t) => [
        t.date,
        t.type,
        t.category,
        t.description,
        t.amount,
        t.currency,
        accountName.get(t.account_id) || "",
        t.to_account_id ? accountName.get(t.to_account_id) || "" : "",
      ]);

      const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const rangeLabel = startDate || endDate ? `_${startDate || "start"}_to_${endDate || "now"}` : "";
      a.href = url;
      a.download = `wealthflow-transactions${rangeLabel}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "CSV downloaded", description: `${rows.length} transaction${rows.length === 1 ? "" : "s"} exported.` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground tracking-normal">
          Export Transactions (CSV)
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        A spreadsheet-ready file — good for opening in Excel/Sheets or sharing for taxes. Leave the dates blank
        to export everything.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-secondary" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-secondary" />
        </div>
      </div>
      <Button onClick={handleExportCsv} disabled={exporting} className="w-full gap-1.5" variant="outline">
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Download CSV
      </Button>
    </motion.div>
  );
}
