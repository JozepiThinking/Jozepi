interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="flex w-full flex-col justify-center bg-background px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="font-brand flex h-12 w-14 flex-col justify-center rounded-md bg-primary px-2 leading-none text-white shadow-card">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em]">
              Jozep&apos;s
            </span>
            <span className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.14em]">
              Garage
            </span>
          </div>
          <div className="font-brand">
            <span className="block text-xl font-bold uppercase leading-none tracking-[0.12em] text-foreground">
              Jozep&apos;s Garage
            </span>
            <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.34em] text-muted">
              ESTÉTICA AUTOMOTIVA
            </span>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="page-title text-2xl sm:text-3xl">{title}</h2>
          <p className="page-subtitle mt-2">{subtitle}</p>
        </div>

        <div className="card-surface">{children}</div>
      </div>
    </div>
  );
}
