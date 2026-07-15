export interface ServicePackage {
  id: string;
  badge: string;
  price: number;
  popular?: boolean;
  prevBadge: string | null;
  newItems: string[];
  allServiceNames: string[];
  accentBorder: string;
  badgeBg: string;
  badgeText: string;
}

interface PackageOverride {
  price?: number;
  newItems?: string[];
}
type PackageOverrides = Record<string, PackageOverride>;

const STAGE_PACKAGES_STORAGE_KEY = "auto-estetica-stage-packages";

const STAGE_1_SERVICES = [
  "Lavagem técnica completa",
  "Limpeza interna detalhada",
  "Aspiração completa",
  "Limpeza dos vidros",
  "Limpeza das rodas e caixas de roda",
  "Aplicação de cera protetora SiO₂ (até 3 meses)",
];

const STAGE_2_NEW_SERVICES = [
  "Condicionamento de plásticos internos e externos",
  "Desmontagem dos bancos (quando necessário)",
  "Higienização dos bancos",
  "Limpeza do teto",
  "Limpeza do estepe e do alojamento",
];

const STAGE_3_NEW_SERVICES = [
  "Descontaminação química da pintura",
  "Aplicação de selante cerâmico com grafeno (até 18 meses)",
  "Descontaminação e cristalização dos vidros",
];

const STAGE_4_NEW_SERVICES = [
  "Polimento comercial (remoção parcial de riscos e aumento de brilho)",
  "Remoção das 4 rodas para limpeza profunda",
  "Limpeza detalhada no cofre do motor",
  "Lavagem básica de manutenção em até 40 dias após o serviço",
];

export const STAGE_PACKAGES: ServicePackage[] = [
  {
    id: "stage-1",
    badge: "STAGE 1",
    price: 219,
    prevBadge: null,
    newItems: STAGE_1_SERVICES,
    allServiceNames: STAGE_1_SERVICES,
    accentBorder: "border-l-[#9ca3af]",
    badgeBg: "#1a2744",
    badgeText: "#ffffff",
  },
  {
    id: "stage-2",
    badge: "STAGE 2",
    price: 450,
    prevBadge: "Stage 1",
    newItems: STAGE_2_NEW_SERVICES,
    allServiceNames: [...STAGE_1_SERVICES, ...STAGE_2_NEW_SERVICES],
    accentBorder: "border-l-[#60a5fa]",
    badgeBg: "#1a2744",
    badgeText: "#ffffff",
  },
  {
    id: "stage-3",
    badge: "STAGE 3",
    price: 750,
    popular: true,
    prevBadge: "Stage 2",
    newItems: STAGE_3_NEW_SERVICES,
    allServiceNames: [...STAGE_1_SERVICES, ...STAGE_2_NEW_SERVICES, ...STAGE_3_NEW_SERVICES],
    accentBorder: "border-l-[#1a2744]",
    badgeBg: "#1a2744",
    badgeText: "#ffffff",
  },
  {
    id: "stage-4",
    badge: "STAGE 4",
    price: 1390,
    prevBadge: "Stage 3",
    newItems: STAGE_4_NEW_SERVICES,
    allServiceNames: [
      ...STAGE_1_SERVICES,
      ...STAGE_2_NEW_SERVICES,
      ...STAGE_3_NEW_SERVICES,
      ...STAGE_4_NEW_SERVICES,
    ],
    accentBorder: "border-l-[#c9a84c]",
    badgeBg: "#c9a84c",
    badgeText: "#1a1a0a",
  },
];

function readOverrides(): PackageOverrides {
  if (typeof window === "undefined") return {};
  try {
    return (JSON.parse(localStorage.getItem(STAGE_PACKAGES_STORAGE_KEY) ?? "{}") as PackageOverrides);
  } catch {
    return {};
  }
}

export function loadStagePackages(): ServicePackage[] {
  const overrides = readOverrides();
  return STAGE_PACKAGES.map((pkg) => {
    const o = overrides[pkg.id];
    if (!o) return pkg;
    return {
      ...pkg,
      ...(o.price !== undefined ? { price: o.price } : {}),
      ...(o.newItems !== undefined ? { newItems: o.newItems } : {}),
    };
  });
}

export function saveStagePackageOverride(id: string, override: PackageOverride): void {
  if (typeof window === "undefined") return;
  try {
    const stored = readOverrides();
    stored[id] = { ...stored[id], ...override };
    localStorage.setItem(STAGE_PACKAGES_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }
}
