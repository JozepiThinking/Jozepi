"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function Dropdown({
  label,
  value,
  options,
  onChange,
  placeholder = "Selecione uma opção",
  id,
  disabled = false,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const inputId = id ?? label.toLowerCase().replace(/\s/g, "-");
  const selectedOption = options.find((option) => option.value === value);

  function selectOption(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className={cn("relative space-y-1.5", className)}>
      <label
        htmlFor={inputId}
        className="block text-sm font-semibold text-foreground"
      >
        {label}
      </label>
      <button
        id={inputId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-slate-50 px-4 py-2.5 text-left text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selectedOption ? "font-medium" : "text-muted/70"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-xl">
          <div role="listbox" aria-labelledby={inputId} className="space-y-1">
            {options.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => selectOption(option.value)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                    selected
                      ? "bg-success/10 text-success"
                      : "text-foreground hover:bg-background"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
