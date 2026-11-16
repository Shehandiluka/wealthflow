import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  DAY_NAMES,
  useDraftReminderSettings,
  useSaveDraftReminderSettings,
} from "@/hooks/useDraftReminders";

export function DraftReminderSettings() {
  const { data: settings, isLoading } = useDraftReminderSettings();
  const save = useSaveDraftReminderSettings();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(true);
  const [dow, setDow] = useState("0");
  const [time, setTime] = useState("20:00");
  const [autoPost, setAutoPost] = useState(false);
  const [lead, setLead] = useState("24");

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.enabled);
    setDow(String(settings.cutoff_dow));
    setTime(settings.cutoff_time.slice(0, 5));
    setAutoPost(settings.auto_post);
    setLead(String(settings.reminder_lead_hours));
  }, [settings]);

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        ...(settings ? { id: settings.id } : {}),
        enabled,
        cutoff_dow: Number(dow),
        cutoff_time: time,
        auto_post: autoPost,
        reminder_lead_hours: Number(lead),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
      toast({ title: "Reminder settings saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BellRing className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Draft Reminders & Weekly Cutoff</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Get reminded to review your Draft Inbox before your weekly cutoff. Drafts you mark
        "Auto-post" are turned into transactions automatically at the cutoff.
      </p>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dr-enabled">Reminders enabled</Label>
            <Switch id="dr-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cutoff day</Label>
              <Select value={dow} onValueChange={setDow}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((d, i) => (
                    <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cutoff time</Label>
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="bg-secondary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Remind me this many hours before</Label>
            <Select value={lead} onValueChange={setLead}>
              <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["6", "12", "24", "48", "72"].map(h => (
                  <SelectItem key={h} value={h}>{h} hours</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <Label htmlFor="dr-auto">Auto-post marked drafts at cutoff</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Only drafts you flagged in the Draft Inbox are posted.
              </p>
            </div>
            <Switch id="dr-auto" checked={autoPost} onCheckedChange={setAutoPost} />
          </div>

          <Button onClick={handleSave} disabled={save.isPending} className="w-full">
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save reminder settings
          </Button>
        </div>
      )}
    </div>
  );
}
