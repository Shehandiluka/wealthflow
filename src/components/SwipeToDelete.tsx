import { useRef, useState, ReactNode } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface SwipeToDeleteProps {
  /** Called once the undo window has passed with no undo — this is where the real delete happens. */
  onDelete: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Shown in the confirmation toast, e.g. "Transaction deleted". Defaults to "Deleted". */
  itemLabel?: string;
  /** How long the user has to tap Undo before the delete actually happens. */
  undoWindowMs?: number;
}

/**
 * Swipe-left-to-delete with a grace period: the row visually collapses right away,
 * but the actual onDelete() call is held back behind an "Undo" toast so an accidental
 * swipe (very easy to trigger on a scrolling touch list) doesn't silently destroy data —
 * especially here, where deleting reverses real account/debt balance effects.
 */
export function SwipeToDelete({
  onDelete,
  children,
  disabled,
  className = "",
  itemLabel = "Deleted",
  undoWindowMs = 4000,
}: SwipeToDeleteProps) {
  const [deleting, setDeleting] = useState(false);
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-120, -60, 0], [1, 0.8, 0]);
  const iconScale = useTransform(x, [-120, -60, 0], [1.2, 1, 0.5]);
  const threshold = -100;
  const { toast } = useToast();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPending = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setDeleting(false);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < threshold && !disabled) {
      setDeleting(true);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        onDelete();
      }, undoWindowMs);
      toast({
        title: itemLabel,
        action: (
          <ToastAction altText="Undo" onClick={cancelPending}>
            Undo
          </ToastAction>
        ),
      });
    }
  };

  if (deleting) return null;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Red background revealed on swipe */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end px-6 bg-destructive"
        style={{ opacity: bgOpacity }}
      >
        <motion.div style={{ scale: iconScale }}>
          <Trash2 className="h-5 w-5 text-destructive-foreground" />
        </motion.div>
      </motion.div>

      {/* Draggable content */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -150, right: 0 }}
        dragElastic={0.1}
        dragSnapToOrigin
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative z-10 bg-card"
      >
        {children}
      </motion.div>
    </div>
  );
}
