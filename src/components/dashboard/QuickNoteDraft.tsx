import { useState } from "react";
import { Plus, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { QuickNoteComposer } from "@/components/dashboard/QuickNoteComposer";

export function QuickNoteDraft() {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass-card p-3">
      {!open ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 text-sm font-medium text-foreground"
          >
            <span className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </span>
            Jot a quick note
          </button>
          <Link
            to="/sms-imports"
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Inbox className="h-3 w-3" /> Draft Inbox
          </Link>
        </div>
      ) : (
        <QuickNoteComposer onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
