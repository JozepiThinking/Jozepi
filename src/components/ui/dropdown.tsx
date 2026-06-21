"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface DropdownOption {
  value: string;
  label: string;
  custom?: boolean;
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
  actionLabel?: string;
  onAction?: () => void;
  createPlaceholder?: string;
  onCreateOption?: (label: string) => string | void;
  onDeleteOption?: (value: string) => void;
}

const DROPDOWN_EXIT_MS = 160;

export function Dropdown({
  label,
  value,
  options,
  onChange,
  placeholder = "Selecione uma opção",
  id,
  disabled = false,
  className,
  actionLabel,
  onAction,
  createPlaceholder = "Digite o nome",
  onCreateOption,
  onDeleteOption,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createValue, setCreateValue] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const inputId = id ?? label.toLowerCase().replace(/\s/g, "-");
  const selectedOption = options.find((option) => option.value === value);

  function clearCloseTimeout() {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }

  function openDropdown() {
    clearCloseTimeout();
    setClosing(false);
    setOpen(true);
  }

  function closeDropdown() {
    if (!open) return;

    clearCloseTimeout();
    setClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setCreating(false);
      setCreateValue("");
      setCreateError(null);
      closeTimeoutRef.current = null;
    }, DROPDOWN_EXIT_MS);
  }

  function toggleDropdown() {
    if (open && !closing) {
      closeDropdown();
      return;
    }

    openDropdown();
  }

  function selectOption(nextValue: string) {
    onChange(nextValue);
    closeDropdown();
  }

  function startCreating() {
    setCreating(true);
    setCreateError(null);
    setCreateValue("");
  }

  function cancelCreating() {
    setCreating(false);
    setCreateError(null);
    setCreateValue("");
  }

  function submitCreatedOption() {
    if (!onCreateOption) return;

    const label = createValue.trim();
    if (!label) {
      setCreateError("Digite o nome.");
      return;
    }

    const error = onCreateOption(label);
    if (error) {
      setCreateError(error);
      return;
    }

    closeDropdown();
  }

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("relative space-y-1.5", className)}>
      <label htmlFor={inputId} className="label-caps">
        {label}
      </label>
      <button
        id={inputId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open && !closing}
        onClick={toggleDropdown}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-border bg-input px-4 py-3 text-left text-base text-foreground transition-colors duration-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-2.5 sm:text-sm"
      >
        <span className={selectedOption ? "font-medium" : "text-muted/70"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform duration-200"
          )}
        />
      </button>

      {open && !disabled && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-40 mt-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-card-hover",
            closing ? "dropdown-menu-exit" : "dropdown-menu-enter"
          )}
        >
          <div role="listbox" aria-labelledby={inputId} className="space-y-1">
            {options.map((option) => {
              const selected = option.value === value;

              return (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center gap-2 rounded-md transition-colors duration-300",
                    selected ? "bg-premium/10" : "hover:bg-background"
                  )}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectOption(option.value)}
                    className={cn(
                      "min-h-11 min-w-0 flex-1 px-3 py-3 text-left text-base font-semibold transition-colors sm:min-h-0 sm:py-2.5 sm:text-sm",
                      selected ? "text-premium" : "text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                  {option.custom && onDeleteOption && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteOption(option.value);
                      }}
                      className="mr-1 min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 sm:min-h-0 sm:px-2 sm:py-1.5 sm:text-xs"
                      aria-label={`Apagar ${option.label}`}
                      title={`Apagar ${option.label}`}
                    >
                      Apagar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {creating && onCreateOption ? (
            <div className="mt-2 rounded-lg border border-dashed border-success/30 bg-success/5 p-2">
              <input
                value={createValue}
                onChange={(event) => {
                  setCreateValue(event.target.value);
                  setCreateError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitCreatedOption();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelCreating();
                  }
                }}
                autoFocus
                placeholder={createPlaceholder}
                className="w-full rounded-md border border-border bg-input px-3 py-3 text-base font-medium text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:py-2 sm:text-sm"
              />
              {createError && (
                <p className="mt-2 text-xs font-medium text-danger">
                  {createError}
                </p>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelCreating}
                  className="min-h-11 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background sm:min-h-0 sm:text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submitCreatedOption}
                  className="min-h-11 rounded-lg bg-success px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-success/90 sm:min-h-0 sm:text-xs"
                >
                  Adicionar
                </button>
              </div>
            </div>
          ) : actionLabel && (onAction || onCreateOption) && (
            <button
              type="button"
              onClick={() => {
                if (onCreateOption) {
                  startCreating();
                  return;
                }

                onAction?.();
                closeDropdown();
              }}
              className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-success/30 px-3 py-3 text-left text-base font-semibold tracking-wide text-success transition-colors duration-300 hover:bg-success/10 sm:min-h-0 sm:py-2.5 sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              {actionLabel}
            </button>
          )}
        </div>
      )}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .dropdown-menu-enter {
            animation: dropdown-menu-enter 180ms ease-out both;
            transform-origin: top center;
          }

          .dropdown-menu-exit {
            animation: dropdown-menu-exit ${DROPDOWN_EXIT_MS}ms ease-in both;
            pointer-events: none;
            transform-origin: top center;
          }
        }

        @keyframes dropdown-menu-enter {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes dropdown-menu-exit {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
        }
      `}</style>
    </div>
  );
}
