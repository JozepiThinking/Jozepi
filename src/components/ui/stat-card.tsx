import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  variant?: "default" | "success" | "warning" | "info";
  href?: string;
}

const variantStyles = {
  default: "bg-primary/10 text-primary",
  success: "bg-premium/10 text-premium",
  warning: "bg-warning/10 text-warning",
  info: "bg-premium/10 text-premium",
};

function StatCardInner({
  title,
  value,
  icon,
  trend,
  variant = "default",
}: Omit<StatCardProps, "href">) {
  return (
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
  );
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  variant = "default",
  href,
}: StatCardProps) {
  if (href) {
    return (
      <Link href={href} className="card-surface block transition-opacity hover:opacity-80">
        <StatCardInner title={title} value={value} icon={icon} trend={trend} variant={variant} />
      </Link>
    );
  }

  return (
    <div className="card-surface">
      <StatCardInner title={title} value={value} icon={icon} trend={trend} variant={variant} />
    </div>
  );
}
