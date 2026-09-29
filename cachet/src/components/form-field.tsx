import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormField({
  id,
  label,
  error,
  hint,
  children,
  className,
  action,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-foreground/85 text-[13px] font-medium">
          {label}
        </Label>
        {action}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
