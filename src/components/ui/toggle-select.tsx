import { cn } from "@/lib/utils";

interface ToggleSelectOption {
  value: string;
  label: string;
}

interface ToggleSelectProps {
  options: ToggleSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

/** Chip/pill selector for small option sets (2-6 items) — replaces dropdowns */
export function ToggleSelect({ options, value, onValueChange, className }: ToggleSelectProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onValueChange(opt.value)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
            value === opt.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
