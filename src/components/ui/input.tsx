"use client";

import { cn } from "@/lib/utils/cn";
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, prefix, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s/g, "-");

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-foreground"
        >
          {label}
        </label>
        <div className="relative">
          {prefix && (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full rounded-lg border border-border bg-slate-50 px-4 py-2.5 text-sm text-foreground",
              prefix && "pl-11",
              "placeholder:text-muted/60 transition-colors",
              "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-danger focus:border-danger focus:ring-danger/20",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
