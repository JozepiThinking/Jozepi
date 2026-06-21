import { cn } from "@/lib/utils/cn";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  variant?: "default" | "success" | "warning" | "info";
}

const variantStyles = {
  default: "bg-primary/10 text-primary",
  success: "bg-premium/10 text-premium",
  warning: "bg-warning/10 text-warning",
  info: "bg-premium/10 text-premium",
};

export function StatCard({
  title,
  value,
  icon,
  trend,
  variant = "default",
}: StatCardProps) {
  return (
    <div className="card-surface">
      <div className="flex items-start justify-between">
        <div>
          <p className="label-caps">{title}</p>
          <p className="currency-display mt-2">{value}</p>
          {trend && <p className="mt-2 text-xs text-muted">{trend}</p>}
        </div>
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-md",
            variantStyles[variant]
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
