import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { Building2, FileText, Mail, MapPin, Phone } from "lucide-react";
import { redirect } from "next/navigation";

function InfoItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3">
      <p className="label-caps">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {value || "Não informado"}
      </p>
    </div>
  );
}

export default async function EmpresaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("workshop_id")
    .eq("id", user.id)
    .single();

  const { data: company } = profile?.workshop_id
    ? await supabase
        .from("workshops")
        .select("name, slug, email, phone, document, address")
        .eq("id", profile.workshop_id)
        .single()
    : { data: null };

  return (
    <>
      <Header
        title="Perfil da Empresa"
        description="Dados da empresa vinculada à sua conta"
      />

      <div className="card-surface">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-premium/10 text-premium">
            <Building2 className="h-9 w-9" />
          </div>
          <div>
            <h2 className="page-title text-2xl sm:text-3xl">
              {company?.name || "Empresa não cadastrada"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {company?.slug
                ? `Identificador: ${company.slug}`
                : "Complete os dados da empresa para identificar sua operação."}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoItem label="Nome da empresa" value={company?.name} />
          <InfoItem label="E-mail" value={company?.email} />
          <InfoItem label="Telefone" value={company?.phone} />
          <InfoItem label="Documento" value={company?.document} />
          <InfoItem label="Endereço" value={company?.address} />
          <InfoItem label="Identificador" value={company?.slug} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="card-surface">
          <Mail className="h-5 w-5 text-info" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Contato principal
          </p>
          <p className="mt-1 text-xs text-muted">
            E-mail comercial da empresa.
          </p>
        </div>
        <div className="card-surface">
          <Phone className="h-5 w-5 text-success" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Atendimento
          </p>
          <p className="mt-1 text-xs text-muted">
            Telefone usado com clientes.
          </p>
        </div>
        <div className="card-surface">
          <FileText className="h-5 w-5 text-warning" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Documento
          </p>
          <p className="mt-1 text-xs text-muted">
            CPF ou CNPJ da operação.
          </p>
        </div>
        <div className="card-surface">
          <MapPin className="h-5 w-5 text-primary" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Localização
          </p>
          <p className="mt-1 text-xs text-muted">
            Endereço da estética automotiva.
          </p>
        </div>
      </div>
    </>
  );
}
