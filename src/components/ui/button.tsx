import { cn } from "@/lib/utils/cn";
import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "success";
  loading?: boolean;
}

const variants = {
  primary:
    "bg-primary text-white hover:bg-primary-hover focus:ring-primary/30 shadow-sm",
  secondary:
    "border border-border bg-white text-foreground hover:bg-background focus:ring-accent/20",
  ghost: "text-muted hover:bg-background hover:text-foreground",
  success: "bg-success text-white hover:bg-success/90 focus:ring-success/30 shadow-sm",
};

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-3 sm:min-h-0 sm:py-2.5",
        "text-base font-medium transition-colors focus:outline-none focus:ring-2 sm:text-sm",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Aguarde...
        </>
      ) : (
        children
      )}
    </button>
  );
}
