import { toLocalISODate } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { User, Globe, Lock, Loader2, Check, Download, Upload, Database, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Currency, CURRENCY_SYMBOLS, EXCHANGE_RATES } from "@/lib/data";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogTrigger as DialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger } from
"@/components/ui/alert-dialog";
import { z } from "zod";
import { SmsImportSettings } from "@/components/settings/SmsImportSettings";
import { DraftReminderSettings } from "@/components/settings/DraftReminderSettings";
import { PushNotificationSettings } from "@/components/settings/PushNotificationSettings";
import { DataHealthCheck } from "@/components/settings/DataHealthCheck";
import { CsvExport } from "@/components/settings/CsvExport";

// ... keep existing code (displayNameSchema, pinSchema, hashPin, currencies)
const displayNameSchema = z.
string().
trim().
min(1, "Name cannot be empty").
max(50, "Name must be under 50 characters");

const pinSchema = z.
string().
length(4, "PIN must be exactly 4 digits").
regex(/^\d{4}$/, "PIN must contain only digits");

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).
  map((b) => b.toString(16).padStart(2, "0")).
  join("");
}

const currencies: Currency[] = ["LKR", "USD", "EUR", "GBP", "ILS"];

const BACKUP_TABLES = [
  "accounts", "categories", "transactions", "budgets", "debts",
  "investments", "investment_types", "investment_contributions", "recurring_transactions",
  "trips", "trip_planned_expenses",
  "pay_later", "pay_later_items", "pay_later_payments",
  "lending_contacts", "lending_transactions",
] as const;

const AUTO_FX_KEY = "wf:autoFxIntervalMin";
const AUTO_FX_LAST_KEY = "wf:autoFxLastRunMs";
const AUTO_FX_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Off" },
  { value: "15", label: "Every 15 min" },
  { value: "30", label: "Every 30 min" },
  { value: "60", label: "Every hour" },
  { value: "360", label: "Every 6 hours" },
  { value: "1440", label: "Every 24 hours" },
];

function ExchangeRateEditor() {
  const { data: liveRates } = useExchangeRates();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const ratesCurrencies: Currency[] = ["USD", "EUR", "GBP", "ILS"];
  const [localRates, setLocalRates] = useState<Record<string, string>>({});
  const [autoMin, setAutoMin] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem(AUTO_FX_KEY)) || "0"
  );
  const [lastAutoAt, setLastAutoAt] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem(AUTO_FX_LAST_KEY);
    return v ? parseInt(v) : null;
  });

  const handleFetchLive = async (silent = false) => {
    if (!silent) setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-exchange-rates");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to fetch rates");
      const next: Record<string, string> = {};
      ratesCurrencies.forEach((c) => {
        if (data.rates?.[c]) next[c] = String(data.rates[c]);
      });
      setLocalRates((prev) => ({ ...prev, ...next }));
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
      const now = Date.now();
      localStorage.setItem(AUTO_FX_LAST_KEY, String(now));
      setLastAutoAt(now);
      if (!silent) toast({ title: "Live rates fetched", description: "Rates updated from market data." });
    } catch (err: any) {
      if (!silent) toast({ title: "Couldn't fetch rates", description: err.message, variant: "destructive" });
      else console.warn("Auto FX refresh failed:", err.message);
    } finally {
      if (!silent) setFetching(false);
    }
  };

  // Auto-refresh interval
  useEffect(() => {
    localStorage.setItem(AUTO_FX_KEY, autoMin);
    const mins = parseInt(autoMin);
    if (!mins || mins <= 0) return;
    const intervalMs = mins * 60 * 1000;
    // Catch-up if last run is older than interval
    const last = parseInt(localStorage.getItem(AUTO_FX_LAST_KEY) || "0");
    const sinceLast = Date.now() - last;
    const firstDelay = last && sinceLast < intervalMs ? intervalMs - sinceLast : 0;
    const firstTimer = setTimeout(() => {
      handleFetchLive(true);
      const id = setInterval(() => handleFetchLive(true), intervalMs);
      (firstTimer as any)._intervalId = id;
    }, firstDelay);
    return () => {
      clearTimeout(firstTimer);
      const id = (firstTimer as any)._intervalId;
      if (id) clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMin]);

  const formatLastRun = (ms: number | null) => {
    if (!ms) return "never";
    const diff = Math.floor((Date.now() - ms) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff} min ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };


  useEffect(() => {
    const rates = liveRates || EXCHANGE_RATES;
    const initial: Record<string, string> = {};
    ratesCurrencies.forEach((c) => {
      initial[c] = String(rates[c] ?? EXCHANGE_RATES[c]);
    });
    setLocalRates(initial);
  }, [liveRates]);

  const handleSaveRates = async () => {
    setSaving(true);
    const rates: Record<string, number> = { LKR: 1 };
    for (const c of ratesCurrencies) {
      const val = parseFloat(localRates[c]);
      if (isNaN(val) || val <= 0) {
        toast({ title: `Invalid rate for ${c}`, variant: "destructive" });
        setSaving(false);
        return;
      }
      rates[c] = val;
    }

    const { error } = await supabase
      .from("exchange_rates")
      .upsert(
        { base_currency: "LKR", rates } as any,
        { onConflict: "base_currency" }
      );

    setSaving(false);
    if (error) {
      toast({ title: "Error saving rates", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
      toast({ title: "Exchange rates saved!" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="glass-card p-5 space-y-5"
    >
      <div className="flex items-center gap-2 mb-1">
        <RefreshCw className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground tracking-normal">
          Exchange Rates
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Set how much 1 unit of each currency equals in LKR. These rates are used for all conversions.
      </p>
      <div className="space-y-3">
        {ratesCurrencies.map((c) => (
          <div key={c} className="flex items-center gap-3">
            <Label className="w-16 text-sm font-medium shrink-0">
              {CURRENCY_SYMBOLS[c]} {c}
            </Label>
            <Input
              type="number"
              value={localRates[c] || ""}
              onChange={(e) => setLocalRates((prev) => ({ ...prev, [c]: e.target.value }))}
              className="bg-secondary"
              min="0.01"
              step="0.01"
              placeholder="0.00"
            />
            <span className="text-xs text-muted-foreground shrink-0">LKR</span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Auto-refresh</Label>
        <Select value={autoMin} onValueChange={setAutoMin}>
          <SelectTrigger className="bg-secondary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTO_FX_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {autoMin !== "0" && (
          <p className="text-[11px] text-muted-foreground">
            Last auto-refresh: {formatLastRun(lastAutoAt)}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => handleFetchLive(false)} disabled={fetching || saving} size="sm" variant="outline" className="flex-1 gap-2">
          {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Fetch Live
        </Button>
        <Button onClick={handleSaveRates} disabled={saving || fetching} size="sm" variant="outline" className="flex-1 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save Rates
        </Button>
      </div>
    </motion.div>
  );
}

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState<Currency>("LKR");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // PIN reset state
  const [pinOpen, setPinOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.
    from("profiles").
    select("display_name, base_currency").
    eq("user_id", user.id).
    single().
    then(({ data }) => {
      if (data) {
        setDisplayName(data.display_name || "");
        setBaseCurrency(data.base_currency as Currency || "LKR");
      }
      setLoading(false);
    });
  }, [user]);

  // ... keep existing code (handleSaveProfile, handleResetPin)
  const handleSaveProfile = async () => {
    if (!user) return;
    const result = displayNameSchema.safeParse(displayName);
    if (!result.success) {
      toast({
        title: "Invalid name",
        description: result.error.errors[0].message,
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.
    from("profiles").
    update({
      display_name: result.data,
      base_currency: baseCurrency
    }).
    eq("user_id", user.id);
    setSaving(false);

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings saved!" });
    }
  };

  const handleResetPin = async () => {
    if (!user) return;

    const currentResult = pinSchema.safeParse(currentPin);
    if (!currentResult.success) {
      toast({ title: "Invalid current PIN", description: currentResult.error.errors[0].message, variant: "destructive" });
      return;
    }
    const newResult = pinSchema.safeParse(newPin);
    if (!newResult.success) {
      toast({ title: "Invalid new PIN", description: newResult.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (newPin !== confirmPin) {
      toast({ title: "PINs don't match", variant: "destructive" });
      return;
    }

    setPinSaving(true);

    const currentHash = await hashPin(currentPin);
    const { data } = await supabase.
    from("profiles").
    select("pin_hash").
    eq("user_id", user.id).
    single();

    if (data?.pin_hash !== currentHash) {
      setPinSaving(false);
      toast({ title: "Current PIN is incorrect", variant: "destructive" });
      return;
    }

    const newHash = await hashPin(newPin);
    const { error } = await supabase.
    from("profiles").
    update({ pin_hash: newHash }).
    eq("user_id", user.id);

    setPinSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "PIN updated!" });
      setPinOpen(false);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const backup: Record<string, any[]> = {};
      for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase.
        from(table as any).
        select("*");
        if (error) throw error;
        backup[table] = (data || []).map((row: any) => {
          const { user_id, ...rest } = row;
          return rest;
        });
      }

      // Include profile settings
      const { data: profile } = await supabase.
      from("profiles").
      select("display_name, base_currency").
      eq("user_id", user.id).
      single();
      backup["profile"] = profile ? [profile] : [];

      const blob = new Blob(
        [JSON.stringify({ version: 1, exported_at: new Date().toISOString(), data: backup }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wealthflow-backup-${toLocalISODate(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded!" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
    setExporting(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    setImporting(true);

    try {
      const text = await e.target.files[0].text();
      const parsed = JSON.parse(text);

      if (!parsed.version || !parsed.data) {
        throw new Error("Invalid backup file format");
      }

      const backupData = parsed.data;

      // Delete existing data in reverse dependency order
      for (const table of [...BACKUP_TABLES].reverse()) {
        if (backupData[table]) {
          await (supabase.from(table as any).delete() as any).eq("user_id", user.id);
        }
      }

      // Import in dependency order (accounts/categories/etc. before things that reference them)
      for (const table of BACKUP_TABLES) {
        const rows = backupData[table];
        if (!rows || rows.length === 0) continue;

        const withUserId = rows.map((row: any) => ({ ...row, user_id: user.id }));

        if (table === "categories") {
          // Categories can self-reference via parent_id — parents must exist before
          // the children that point at them, so insert in two passes.
          const parents = withUserId.filter((r: any) => !r.parent_id);
          const children = withUserId.filter((r: any) => r.parent_id);
          if (parents.length > 0) {
            const { error } = await supabase.from(table as any).insert(parents as any);
            if (error) throw new Error(`Failed to import ${table}: ${error.message}`);
          }
          if (children.length > 0) {
            const { error } = await supabase.from(table as any).insert(children as any);
            if (error) throw new Error(`Failed to import ${table}: ${error.message}`);
          }
          continue;
        }

        const { error } = await supabase.from(table as any).insert(withUserId as any);
        if (error) throw new Error(`Failed to import ${table}: ${error.message}`);
      }

      // Restore profile settings
      if (backupData.profile?.[0]) {
        const { display_name, base_currency } = backupData.profile[0];
        await supabase.
        from("profiles").
        update({ display_name, base_currency }).
        eq("user_id", user.id);
        setDisplayName(display_name || "");
        setBaseCurrency(base_currency as Currency || "LKR");
      }

      await queryClient.invalidateQueries();
      toast({ title: "Data restored successfully!" });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    }

    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReset = async () => {
    if (!user) return;
    setResetting(true);
    try {
      const RESET_TABLES = [
      "sms_imports",
      "sms_api_keys",
      "pay_later_payments",
      "pay_later_items",
      "pay_later",
      "lending_transactions",
      "lending_contacts",
      "trip_planned_expenses",
      "trips",
      "recurring_transactions",
      "transactions",
      "budgets",
      "debts",
      "investments",
      "investment_types",
      "categories",
      "accounts"];


      for (const table of RESET_TABLES) {
        const { error } = await (supabase.from(table as any).delete() as any).eq("user_id", user.id);
        if (error) throw new Error(`${table}: ${error.message}`);
      }

      await supabase.
      from("profiles").
      update({ pin_hash: null, base_currency: "LKR" }).
      eq("user_id", user.id);

      // Clear this session's PIN-unlock flag too — otherwise the app would treat this
      // browser tab as still unlocked and skip straight past PIN setup after a reset.
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("wealthflow_pin_unlocked_"))
        .forEach((k) => sessionStorage.removeItem(k));
      setBaseCurrency("LKR");
      await queryClient.invalidateQueries();
      toast({ title: "Account reset", description: "All your data has been deleted." });
      // Reload so the app re-checks PIN state fresh — otherwise this tab would stay
      // "unlocked" in memory and skip straight past PIN setup for the fresh account.
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    }
    setResetting(false);
    setResetConfirm("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>);

  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-display font-semibold tracking-tight">Settings</h1>

      <nav
        aria-label="Settings sections"
        className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
      >
        {[
          { id: "settings-profile", label: "Profile" },
          { id: "settings-currency", label: "Currency" },
          { id: "settings-exchange-rates", label: "Exchange Rates" },
          { id: "settings-sms", label: "SMS Import" },
          { id: "settings-reminders", label: "Reminders" },
          { id: "settings-push", label: "Notifications" },
          { id: "settings-health", label: "Data Health" },
          { id: "settings-export", label: "Export" },
          { id: "settings-backup", label: "Backup" },
          { id: "settings-security", label: "Security" },
          { id: "settings-danger", label: "Danger Zone" },
        ].map((s) => (
          <a
            key={s.id}
            href={"#" + s.id}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground bg-secondary/50 hover:bg-secondary hover:text-foreground transition-colors whitespace-nowrap"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        id="settings-profile"
        className="scroll-mt-24 glass-card p-5 space-y-5">
        
        <div className="flex items-center gap-2 mb-1">
          <User className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground tracking-normal">
            Profile
          </h2>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="bg-secondary"
            maxLength={50} />
          
        </div>

        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            value={user?.email || ""}
            disabled
            className="bg-secondary/50 text-muted-foreground" />
          
        </div>
      </motion.div>

      {/* Currency Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        id="settings-currency"
        className="scroll-mt-24 glass-card p-5 space-y-5">
        
        <div className="flex items-center gap-2 mb-1">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground tracking-normal">
            Currency
          </h2>
        </div>

        <div className="space-y-1.5">
          <Label>Base Currency</Label>
          <Select
            value={baseCurrency}
            onValueChange={(v) => setBaseCurrency(v as Currency)}>
            
            <SelectTrigger className="bg-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) =>
              <SelectItem key={c} value={c}>
                  {CURRENCY_SYMBOLS[c]} {c}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Used for net worth calculations and default values
          </p>
        </div>
      </motion.div>

      {/* Exchange Rates Section */}
      <div id="settings-exchange-rates" className="scroll-mt-24">
        <ExchangeRateEditor />
      </div>

      {/* SMS Import (Apple Shortcut) */}
      <div id="settings-sms" className="scroll-mt-24">
        <SmsImportSettings />
      </div>

      {/* Draft reminders & weekly cutoff */}
      <div id="settings-reminders" className="scroll-mt-24">
        <DraftReminderSettings />
      </div>

      {/* Push notifications for loan due dates */}
      <div id="settings-push" className="scroll-mt-24">
        <PushNotificationSettings />
      </div>

      {/* Data health check - live row counts, no psql needed */}
      <div id="settings-health" className="scroll-mt-24">
        <DataHealthCheck />
      </div>

      {/* CSV export for transactions */}
      <div id="settings-export" className="scroll-mt-24">
        <CsvExport />
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSaveProfile}
        disabled={saving}
        className="w-full gap-2">
        
        {saving ?
        <Loader2 className="h-4 w-4 animate-spin" /> :

        <Check className="h-4 w-4" />
        }
        Save Changes
      </Button>

      {/* Data Backup Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        id="settings-backup"
        className="scroll-mt-24 glass-card p-5 space-y-5">
        
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground tracking-normal">
            Data Backup
          </h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Export Data</p>
            <p className="text-xs text-muted-foreground">
              Download all your financial data as JSON
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="gap-1.5">
            
            {exporting ?
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> :

            <Download className="h-3.5 w-3.5" />
            }
            Export
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Import Data</p>
            <p className="text-xs text-muted-foreground">
              Restore from a backup file (replaces current data)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden" />
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={importing}
                className="gap-1.5">
                
                {importing ?
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> :

                <Upload className="h-3.5 w-3.5" />
                }
                Import
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-card border-glass-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Restore from backup?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will <strong>replace all your current data</strong> with the backup file contents. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  
                  Choose File & Restore
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </motion.div>

      {/* Security Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        id="settings-security"
        className="scroll-mt-24 glass-card p-5 space-y-5">
        
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground tracking-normal">
            Security
          </h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">App Lock PIN</p>
            <p className="text-xs text-muted-foreground">
              Change your 4-digit security PIN
            </p>
          </div>
          <Dialog open={pinOpen} onOpenChange={setPinOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Reset PIN
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-glass-border">
              <DialogHeader>
                <DialogTitle>Reset PIN</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Current PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={currentPin}
                    onChange={(e) =>
                    setCurrentPin(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="••••"
                    className="bg-secondary text-center tracking-[0.5em] text-lg" />
                  
                </div>
                <div className="space-y-1.5">
                  <Label>New PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) =>
                    setNewPin(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="••••"
                    className="bg-secondary text-center tracking-[0.5em] text-lg" />
                  
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm New PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) =>
                    setConfirmPin(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="••••"
                    className="bg-secondary text-center tracking-[0.5em] text-lg" />
                  
                </div>
                <Button
                  onClick={handleResetPin}
                  disabled={pinSaving}
                  className="w-full">
                  
                  {pinSaving &&
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  }
                  Update PIN
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        id="settings-danger"
        className="scroll-mt-24 glass-card p-5 space-y-4 border-destructive/40">

        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="font-semibold text-destructive">Danger Zone</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Reset your account — permanently deletes all accounts, transactions, budgets, debts,
          investments, trips, lending records, categories, SMS imports and your PIN. Your login stays.
        </p>
        <AlertDialog onOpenChange={() => setResetConfirm("")}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={resetting}>
              {resetting ?
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> :
              <Trash2 className="h-4 w-4 mr-2" />}
              Reset Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass-card border-glass-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Reset everything?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. Export a backup first if you want to keep your data.
                Type <span className="font-semibold text-foreground">RESET</span> to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="RESET"
              className="bg-secondary border-border" />

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={resetConfirm !== "RESET"}
                onClick={handleReset}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Reset Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>

      




























































      
    </div>);

};

export default SettingsPage;