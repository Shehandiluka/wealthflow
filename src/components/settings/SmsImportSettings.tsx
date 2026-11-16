import { useState } from "react";
import { Copy, Check, Plus, Trash2, KeyRound, Smartphone, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSmsApiKeys,
  useCreateSmsApiKey,
  useDeleteSmsApiKey,
} from "@/hooks/useSmsImports";
import { useAccounts } from "@/hooks/useAccounts";
import { useToast } from "@/hooks/use-toast";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sms-import`;

export function SmsImportSettings() {
  const { data: keys } = useSmsApiKeys();
  const { data: accounts } = useAccounts();
  const create = useCreateSmsApiKey();
  const del = useDeleteSmsApiKey();
  const { toast } = useToast();

  const [newKey, setNewKey] = useState<string | null>(null);
  const [label, setLabel] = useState("Apple Shortcut");
  const [accountId, setAccountId] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
    toast({ title: "Copied", description: "Copied to clipboard" });
  };

  const handleCreate = async () => {
    try {
      const key = await create.mutateAsync({
        label,
        default_account_id: accountId || null,
      });
      setNewKey(key);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message ?? "Failed to create key",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          SMS Import (Apple Shortcut)
        </CardTitle>
        <CardDescription>
          Forward bank SMS messages from your iPhone into WealthFlow using an Apple
          Shortcut. Each message is parsed and saved as a transaction automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Webhook URL */}
        <div className="space-y-1.5">
          <Label>Webhook URL</Label>
          <div className="flex gap-2">
            <Input value={WEBHOOK_URL} readOnly className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy webhook URL"
              onClick={() => copy(WEBHOOK_URL, "url")}
            >
              {copied === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Create new key */}
        <div className="rounded-lg border p-3 space-y-3">
          <div className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Create API key
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="First account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={create.isPending} size="sm">
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Generate key
          </Button>

          {newKey && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-medium">
                Copy your key now — it won't be shown again.
              </p>
              <div className="flex gap-2">
                <Input value={newKey} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copy API key"
                  onClick={() => copy(newKey, "newkey")}
                >
                  {copied === "newkey" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setNewKey(null)}
              >
                I've saved it
              </Button>
            </div>
          )}
        </div>

        {/* Existing keys */}
        <div className="space-y-2">
          <Label>Active keys</Label>
          {!keys || keys.length === 0 ? (
            <p className="text-xs text-muted-foreground">No keys yet.</p>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{k.label}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {k.key_prefix}…{" "}
                      {k.last_used_at
                        ? `• used ${new Date(k.last_used_at).toLocaleDateString()}`
                        : "• never used"}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete API key"
                    onClick={() => del.mutate(k.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
          <div className="font-medium">Apple Shortcut setup</div>
          <ol className="list-decimal pl-5 space-y-1.5 text-xs text-muted-foreground">
            <li>Open the Shortcuts app on iPhone → tap <b>+</b> to create a new shortcut.</li>
            <li>
              Add action <b>Get Contents of URL</b>:
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>URL: <span className="font-mono">{WEBHOOK_URL}</span></li>
                <li>Method: <b>POST</b></li>
                <li>
                  Headers: <span className="font-mono">x-api-key</span> ={" "}
                  <span className="font-mono">YOUR_API_KEY</span>,{" "}
                  <span className="font-mono">Content-Type</span> ={" "}
                  <span className="font-mono">application/json</span>
                </li>
                <li>
                  Request Body → JSON:
                  <pre className="mt-1 rounded bg-background p-2 overflow-x-auto text-[11px]">{`{
  "sender": "Shortcut Input",
  "message": "Shortcut Input",
  "receivedAt": "Current Date (ISO 8601)"
}`}</pre>
                </li>
              </ul>
            </li>
            <li>
              In Shortcut <b>Details</b> → enable <b>Receive Text from Share Sheet</b>.
            </li>
            <li>
              When a bank SMS arrives, tap and hold → <b>Share</b> → choose this Shortcut.
              The transaction will appear in your dashboard within seconds.
            </li>
          </ol>
          <p className="text-[11px] text-muted-foreground">
            For full automation, use the Shortcuts <b>Automation</b> tab and trigger this
            shortcut on incoming messages from specific bank senders.
          </p>
        </div>

        {/* Quick Note shortcut */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
          <div className="font-medium">Quick Note shortcut (WhatsApp, Notes, anywhere)</div>
          <p className="text-xs text-muted-foreground">
            Send yourself a message like <span className="font-mono">500 LKR dry food</span>,
            share it to this shortcut, and it lands in your Draft Inbox. Open the draft later
            to set the account, category and date, then save it as a transaction.
          </p>
          <ol className="list-decimal pl-5 space-y-1.5 text-xs text-muted-foreground">
            <li>Create a second shortcut named <b>Add to WealthFlow</b>.</li>
            <li>
              Add <b>Get Contents of URL</b> with the same URL, method <b>POST</b> and{" "}
              <span className="font-mono">x-api-key</span> header, but this JSON body:
              <pre className="mt-1 rounded bg-background p-2 overflow-x-auto text-[11px]">{`{
  "source": "note",
  "sender": "Quick Note",
  "message": "Shortcut Input",
  "receivedAt": "Current Date (ISO 8601)"
}`}</pre>
            </li>
            <li>
              In <b>Details</b> → enable <b>Receive Text from Share Sheet</b>. In WhatsApp,
              long-press your message → <b>Share</b> → <b>Add to WealthFlow</b>.
            </li>
            <li>
              Open <b>SMS &amp; Note Drafts</b> in the app to review, complete and save each draft.
            </li>
          </ol>
        </div>

      </CardContent>
    </Card>
  );
}
