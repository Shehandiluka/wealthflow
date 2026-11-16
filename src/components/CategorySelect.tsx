import { useCategories } from "@/hooks/useCategories";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface CategorySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  /** Only show categories usable for this transaction type */
  kind?: "income" | "expense";
}

/** A reusable category/subcategory picker that groups subcategories under parents */
export function CategorySelect({ value, onValueChange, placeholder = "Select category", className, compact, kind }: CategorySelectProps) {
  const { data: categories = [] } = useCategories();
  const parents = categories
    .filter(c => !c.parent_id)
    .filter(c => !kind || c.kind === kind || c.kind === "both");

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className || `bg-secondary ${compact ? "w-[120px] text-xs" : ""}`}><SelectValue placeholder={compact ? "Category" : placeholder} /></SelectTrigger>
      <SelectContent>
        {parents.map(parent => {
          const children = categories.filter(c => c.parent_id === parent.id);
          if (children.length === 0) {
            return <SelectItem key={parent.id} value={parent.name}>{parent.name}</SelectItem>;
          }
          return (
            <SelectGroup key={parent.id}>
              <SelectLabel className="text-xs text-muted-foreground px-2 pt-2">{parent.name}</SelectLabel>
              <SelectItem value={parent.name}>{parent.name} (General)</SelectItem>
              {children.map(child => (
                <SelectItem key={child.id} value={`${parent.name} > ${child.name}`}>
                  &nbsp;&nbsp;{child.name}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
