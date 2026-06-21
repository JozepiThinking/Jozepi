"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  POPULAR_VEHICLE_BRANDS,
  VEHICLE_BRANDS,
  normalizeVehicleBrand,
} from "@/lib/vehicles/vehicle-brands";

interface BrandAutocompleteProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

const MAX_SUGGESTIONS = 8;

export function BrandAutocomplete({
  label,
  value,
  placeholder,
  onChange,
}: BrandAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(() => {
    const term = normalizeVehicleBrand(value);

    if (!term) return POPULAR_VEHICLE_BRANDS;

    return VEHICLE_BRANDS.filter((brand) =>
      normalizeVehicleBrand(brand).includes(term)
    )
      .sort((a, b) => {
        const aStarts = normalizeVehicleBrand(a).startsWith(term);
        const bStarts = normalizeVehicleBrand(b).startsWith(term);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.localeCompare(b, "pt-BR");
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [value]);

  function selectBrand(brand: string) {
    onChange(brand);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + suggestions.length) % suggestions.length
      );
    }

    if (e.key === "Enter") {
      e.preventDefault();
      selectBrand(suggestions[activeIndex]);
    }

    if (e.key === "Escape") {
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
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground",
            "placeholder:text-muted/60 transition-colors",
            "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          )}
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-xl">
          {suggestions.map((brand, index) => {
            const selected =
              normalizeVehicleBrand(value) === normalizeVehicleBrand(brand);

            return (
              <button
                key={brand}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectBrand(brand)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                  index === activeIndex
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-background"
                )}
              >
                {brand}
                {selected && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
