import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        userEmail={user.email ?? ""}
        userName={profile?.full_name}
        avatarUrl={
          typeof user.user_metadata.avatar_url === "string"
            ? user.user_metadata.avatar_url
            : null
        }
      />
      <main className="pb-24 md:pl-20 md:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
