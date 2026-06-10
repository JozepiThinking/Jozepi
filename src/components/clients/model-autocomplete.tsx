"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  getVehicleModelSuggestions,
  normalizeVehicleModel,
} from "@/lib/vehicles/vehicle-models";

interface ModelAutocompleteProps {
  label: string;
  brand: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function ModelAutocomplete({
  label,
  brand,
  value,
  placeholder,
  onChange,
}: ModelAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(
    () => getVehicleModelSuggestions(brand, value),
    [brand, value]
  );

  function selectModel(model: string) {
    onChange(model);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + suggestions.length) % suggestions.length
      );
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectModel(suggestions[activeIndex]);
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative space-y-1.5">
      <label className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-border bg-slate-50 px-4 py-2.5 text-sm text-foreground",
            "placeholder:text-muted/60 transition-colors",
            "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          )}
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-xl">
          {suggestions.map((model, index) => {
            const selected =
              normalizeVehicleModel(value) === normalizeVehicleModel(model);

            return (
              <button
                key={model}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectModel(model)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                  index === activeIndex
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-background"
                )}
              >
                {model}
                {selected && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
