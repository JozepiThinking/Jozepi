"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, UserRound } from "lucide-react";

interface UserMenuProps {
  email: string;
  fullName?: string;
  avatarUrl?: string | null;
}

export function UserMenu({ email, fullName, avatarUrl }: UserMenuProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="border-t border-white/10 p-3">
      <Link
        href="/perfil"
        className="mb-3 flex h-11 items-center rounded-lg px-0 text-white/70 transition-colors duration-300 hover:bg-sidebar-hover hover:text-white"
        title="Meu perfil"
      >
        <div className="flex h-11 w-14 shrink-0 items-center justify-center">
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-semibold text-white transition-colors duration-300 group-hover:bg-white/15">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Foto do perfil"
                fill
                sizes="36px"
                className="object-cover"
                unoptimized
              />
            ) : (
              (fullName ?? email ?? "U").slice(0, 1).toUpperCase() || (
                <UserRound className="h-4 w-4" />
              )
            )}
          </div>
        </div>
        <div className="ml-3 w-44 translate-x-2 overflow-hidden opacity-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0 group-hover:opacity-100">
          <p className="truncate text-sm font-medium text-white">
            {fullName ?? "Usuário"}
          </p>
          <p className="truncate text-xs text-white/50">{email}</p>
        </div>
      </Link>
      <Link
        href="/configuracoes"
        className="flex h-11 items-center rounded-lg px-0 text-white/70 transition-colors duration-300 hover:bg-sidebar-hover hover:text-white"
        title="Configurações"
      >
        <span className="flex h-11 w-14 shrink-0 items-center justify-center">
          <Settings className="h-4 w-4" />
        </span>
        <span className="ml-3 translate-x-2 whitespace-nowrap opacity-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0 group-hover:opacity-100">
          Configurações
        </span>
      </Link>
      <Button
        variant="ghost"
        onClick={handleLogout}
        className="h-11 w-full justify-start gap-0 px-0 text-white/70 transition-colors duration-300 hover:bg-sidebar-hover hover:text-white"
        title="Sair"
      >
        <span className="flex h-11 w-14 shrink-0 items-center justify-center">
          <LogOut className="h-4 w-4" />
        </span>
        <span className="ml-3 translate-x-2 whitespace-nowrap opacity-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0 group-hover:opacity-100">
          Sair
        </span>
      </Button>
    </div>
  );
}
