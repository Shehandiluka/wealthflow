import { toLocalISODate } from "@/lib/utils";
import { useState, useRef } from "react";
import { Camera, Loader2, Check, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/hooks/useAccounts";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useToast } from "@/hooks/use-toast";
import { useBudgetAlertCheck } from "@/hooks/useBudgetAlertCheck";
import { supabase } from "@/integrations/supabase/client";

const categories = ["Food", "Transport", "Shopping", "Utilities", "Health", "Entertainment", "Other"];

interface ExtractedData {
  amount: number;
  currency: string;
  category: string;
  description: string;
}

export function ReceiptScanner() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "scanning" | "review">("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(toLocalISODate(new Date()));
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: accounts = [] } = useAccounts();
  const createTransaction = useCreateTransaction();
  const { toast } = useToast();
  const checkBudgetAlert = useBudgetAlertCheck();

  const reset = () => {
    setStep("upload");
    setPreview(null);
    setExtracted(null);
    setAccountId("");
    setDate(toLocalISODate(new Date()));
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image must be under 10MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    setStep("scanning");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("scan-receipt", {
        body: { imageBase64: base64, mimeType: file.type },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setExtracted(data);
      setStep("review");
    } catch (err: any) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
      setStep("upload");
    }
  };

  const handleSave = async () => {
    if (!extracted || !accountId) return;
    const account = accounts.find(a => a.id === accountId);
    try {
      await createTransaction.mutateAsync({
        account_id: accountId,
        type: "expense",
        amount: extracted.amount,
        currency: extracted.currency || account?.currency || "LKR",
        category: extracted.category,
        description: extracted.description,
        date,
      });
      toast({ title: "Transaction added from receipt!" });
      checkBudgetAlert(extracted.category, "expense");
      setOpen(false);
      reset();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <ResponsiveDialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Camera className="h-3.5 w-3.5" /> Scan
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="glass-card border-glass-border">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Scan Receipt</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {step === "upload" && (
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a receipt photo or tap to upload</p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 10MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        )}

        {step === "scanning" && (
          <div className="space-y-4">
            {preview && (
              <img src={preview} alt="Receipt" className="w-full max-h-48 object-contain rounded-lg" />
            )}
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing receipt with AI...</p>
            </div>
          </div>
        )}

        {step === "review" && extracted && (
          <div className="space-y-4">
            {preview && (
              <img src={preview} alt="Receipt" className="w-full max-h-32 object-contain rounded-lg opacity-70" />
            )}
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                value={extracted.amount}
                onChange={(e) => setExtracted({ ...extracted, amount: parseFloat(e.target.value) || 0 })}
                className="bg-secondary"
                step="0.01"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={extracted.category} onValueChange={(v) => setExtracted({ ...extracted, category: v })}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={extracted.description}
                onChange={(e) => setExtracted({ ...extracted, description: e.target.value })}
                className="bg-secondary"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => { reset(); }}>
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={handleSave}
                disabled={!accountId || createTransaction.isPending}
              >
                {createTransaction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
            </div>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
