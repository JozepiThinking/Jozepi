import type { SVGProps } from "react";

export function PlateIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="2" y="7" width="20" height="10" rx="2" />
      <circle cx="5.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <path d="M9 12h6" />
    </svg>
  );
}
