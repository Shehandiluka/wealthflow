import { useState } from "react";
import { PenLine } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QuickNoteComposer } from "@/components/dashboard/QuickNoteComposer";

export function QuickNoteFab() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Jot a quick note"
        className="fixed right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6"
      >
        <PenLine className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Jot a quick note</DialogTitle>
            <DialogDescription>
              Type something like "LKR 500 Milk" — we'll save it as a draft.
            </DialogDescription>
          </DialogHeader>
          <QuickNoteComposer onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
