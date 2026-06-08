"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Wrench,
  Wallet,
  Building2,
  Package,
} from "lucide-react";
import { UserMenu } from "./user-menu";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Agenda", href: "/agenda", icon: CalendarDays },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Serviços", href: "/servicos", icon: Wrench },
  { name: "Produtos", href: "/produtos", icon: Package },
  { name: "Financeiro", href: "/financeiro", icon: Wallet },
  { name: "Perfil da Empresa", href: "/empresa", icon: Building2 },
];

interface SidebarProps {
  userEmail: string;
  userName?: string;
  avatarUrl?: string | null;
}

function GarageMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M7 22 28 11l21 11"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M10 16 28 7l18 9"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="square"
        strokeLinejoin="miter"
        opacity="0.85"
      />
      <path
        d="M12 22v25"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
      />
      <path
        d="M22 31h24v16H22"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M22 39h17"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function Sidebar({ userEmail, userName, avatarUrl }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside className="group fixed inset-y-0 left-0 z-50 hidden w-20 flex-col overflow-hidden bg-sidebar shadow-xl transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:w-64 md:flex">
        <div className="flex h-16 items-center border-b border-white/10 px-3">
          <div className="flex h-11 w-14 shrink-0 items-center justify-center">
            <GarageMark className="h-12 w-12 text-white" />
          </div>
          <div className="-ml-1 w-44 translate-x-2 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0 group-hover:opacity-100">
            <p className="whitespace-nowrap text-2xl font-semibold tracking-[0.12em] text-white">
              arage
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigation.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                title={item.name}
                className={`flex h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors duration-300 ${
                  isActive
                    ? "bg-sidebar-active text-white"
                    : "text-white/70 hover:bg-sidebar-hover hover:text-white"
                }`}
              >
                <span className="flex w-8 shrink-0 justify-center">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="ml-3 translate-x-2 whitespace-nowrap opacity-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0 group-hover:opacity-100">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        <UserMenu email={userEmail} fullName={userName} avatarUrl={avatarUrl} />
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-sidebar/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 shadow-[0_-16px_40px_rgba(15,23,42,0.22)] backdrop-blur md:hidden"
        aria-label="Navegação principal"
      >
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navigation.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex min-h-14 min-w-[4.75rem] flex-1 flex-col items-center justify-center rounded-2xl px-2 text-[11px] font-semibold transition-colors ${
                isActive
                  ? "bg-sidebar-active text-white shadow-sm"
                  : "text-white/65 hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              <item.icon className="mb-1 h-5 w-5" />
              <span className="max-w-[4.25rem] truncate">{item.name}</span>
            </Link>
          );
        })}
        </div>
      </nav>
    </>
  );
}
