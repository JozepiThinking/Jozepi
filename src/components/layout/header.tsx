interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-base text-muted sm:text-sm">{description}</p>
        )}
      </div>
      {actions && <div className="flex w-full items-center gap-3 sm:w-auto">{actions}</div>}
    </div>
  );
}
