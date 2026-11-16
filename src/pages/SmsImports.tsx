import { useMemo, useState } from "react";
import { format } from "date-fns";
import { MessageSquare, Trash2, Inbox, Loader2, CheckCircle2, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSetDraftAutoPost } from "@/hooks/useDraftReminders";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useSmsImports, useDeleteSmsImport, useSetDraftCategory, type SmsImport } from "@/hooks/useSmsImports";
import { CategorySelect } from "@/components/CategorySelect";

import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { ConfirmSmsDialog } from "@/components/sms/ConfirmSmsDialog";

export default function SmsImports() {
  const { data: items, isLoading } = useSmsImports();
  const del = useDeleteSmsImport();
  const setAutoPost = useSetDraftAutoPost();
  const setCategory = useSetDraftCategory();

  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [confirmSms, setConfirmSms] = useState<SmsImport | null>(null);

  const filtered = useMemo(() => {
    if (!items) return [];
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (x) =>
        x.sender.toLowerCase().includes(s) ||
        x.message.toLowerCase().includes(s) ||
        (x.parsed_account_ref ?? "").toLowerCase().includes(s),
    );
  }, [items, q]);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Draft Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bank SMS and quick notes (e.g. "500 LKR dry food") sent from your phone, waiting to be completed and saved.
          </p>
        </div>
        <Link to="/settings">
          <Button variant="outline" size="sm">Setup Apple Shortcut</Button>
        </Link>

      </div>

      <Input
        placeholder="Search sender, message, account…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No drafts yet</p>
            <p className="text-sm mt-1">
              Set up the Apple Shortcuts from Settings to send bank SMS or quick notes here.
            </p>
          </CardContent>
        </Card>

      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const typeColor =
              s.parsed_type === "income"
                ? "bg-success/15 text-success"
                : s.parsed_type === "expense"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-muted text-muted-foreground";
            return (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{s.sender}</CardTitle>
                      <CardDescription className="text-xs">
                        {format(new Date(s.received_at), "PPp")}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={typeColor} variant="secondary">
                        {s.parsed_type
                          ? s.parsed_type === "income"
                            ? "Credit"
                            : "Debit"
                          : "Unparsed"}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete draft"
                        onClick={() =>
                          del.mutate(s.id, {
                            onSuccess: () =>
                              toast({ title: "Deleted", description: "SMS removed" }),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm whitespace-pre-wrap break-words bg-muted/40 rounded-md p-3">
                    {s.message}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <Field label="Amount" value={s.parsed_amount?.toLocaleString() ?? "—"} />
                    <Field label="Account" value={s.parsed_account_ref ?? "—"} />
                    <Field
                      label="Available Bal."
                      value={s.parsed_balance?.toLocaleString() ?? "—"}
                    />
                    <Field
                      label="Status"
                      value={
                        s.transaction_id
                          ? "Transaction created"
                          : s.status === "parsed_no_account"
                            ? "No account"
                            : s.status === "unparsed"
                              ? "Could not parse"
                              : s.status
                      }
                    />
                  </div>
                  {s.error && (
                    <p className="text-xs text-destructive">Error: {s.error}</p>
                  )}
                  {!s.transaction_id && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] tracking-normal text-muted-foreground">Category</span>
                      <CategorySelect
                        value={(s as any).suggested_category ?? ""}
                        onValueChange={(v) =>
                          setCategory.mutate(
                            { id: s.id, category: v },
                            { onSuccess: () => toast({ title: "Category updated", description: v }) },
                          )
                        }
                        placeholder="Pick a category"
                        kind={s.parsed_type === "income" ? "income" : "expense"}
                        className="bg-secondary h-8 text-xs w-[190px]"
                      />
                    </div>
                  )}
                  {!s.transaction_id && (

                    <div className="pt-1 flex items-center justify-between gap-3 flex-wrap">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setConfirmSms(s)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Review & Confirm
                      </Button>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch
                          checked={!!(s as any).auto_post}
                          onCheckedChange={(v) =>
                            setAutoPost.mutate({ id: s.id, auto_post: v })
                          }
                        />
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Auto-post at cutoff
                        </span>
                      </label>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmSmsDialog sms={confirmSms} onClose={() => setConfirmSms(null)} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card/50 px-2 py-1.5">
      <div className="text-[10px] tracking-normal text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}
