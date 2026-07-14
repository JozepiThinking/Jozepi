export interface ServicePackage {
  id: string;
  badge: string;
  price: number;
  popular?: boolean;
  newItems: string[];
  allServiceNames: string[];
}

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
    newItems: STAGE_1_SERVICES,
    allServiceNames: STAGE_1_SERVICES,
  },
  {
    id: "stage-2",
    badge: "STAGE 2",
    price: 450,
    newItems: STAGE_2_NEW_SERVICES,
    allServiceNames: [...STAGE_1_SERVICES, ...STAGE_2_NEW_SERVICES],
  },
  {
    id: "stage-3",
    badge: "STAGE 3",
    price: 750,
    popular: true,
    newItems: STAGE_3_NEW_SERVICES,
    allServiceNames: [...STAGE_1_SERVICES, ...STAGE_2_NEW_SERVICES, ...STAGE_3_NEW_SERVICES],
  },
  {
    id: "stage-4",
    badge: "STAGE 4",
    price: 1390,
    newItems: STAGE_4_NEW_SERVICES,
    allServiceNames: [
      ...STAGE_1_SERVICES,
      ...STAGE_2_NEW_SERVICES,
      ...STAGE_3_NEW_SERVICES,
      ...STAGE_4_NEW_SERVICES,
    ],
  },
];
