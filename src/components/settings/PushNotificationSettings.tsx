import { motion } from "framer-motion";
import { Bell, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

export function PushNotificationSettings() {
  const { subscribed, loading, subscribe, unsubscribe, supported } = usePushNotifications();
  const { toast } = useToast();

  if (!supported) return null;

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      const result = await subscribe();
      if (result.ok) {
        toast({ title: "Reminders enabled", description: "You'll get a notification when a loan payment is coming up." });
      } else if (result.reason === "denied") {
        toast({ title: "Notifications blocked", description: "Allow notifications for this site in your browser settings to enable this.", variant: "destructive" });
      } else {
        toast({ title: "Couldn't enable reminders", variant: "destructive" });
      }
    } else {
      await unsubscribe();
      toast({ title: "Reminders turned off" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-3"
    >
      <div className="flex items-center gap-2 mb-1">
        <Bell className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground tracking-normal">
          Notifications
        </h2>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Loan due-date reminders</p>
          <p className="text-xs text-muted-foreground">
            Get a push notification a few days before a loan/EMI payment is due.
          </p>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Switch checked={subscribed} onCheckedChange={handleToggle} />
        )}
      </div>
    </motion.div>
  );
}
