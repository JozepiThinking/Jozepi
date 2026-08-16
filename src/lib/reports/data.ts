import { createClient } from "@/lib/supabase/client";
import { toCurrencyNumber } from "@/lib/reports/date-range";
import type {
  ReportClient,
  ReportExpenseEntry,
  ReportRevenueEntry,
  ReportServiceItem,
  ReportTransactionRow,
  ReportsSourceData,
} from "@/lib/reports/types";

type Supabase = ReturnType<typeof createClient>;

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

interface RawTransaction {
  id: string;
  type: "receita" | "despesa";
  description: string;
  amount: number | string;
  category: string | null;
  service_order_id: string | null;
  supplier_id: string | null;
  transaction_date: string;
}

interface RawServiceRelation {
  name: string;
  price?: number | string | null;
}

interface RawOrderItem {
  quantity: number | string | null;
  unit_price: number | string | null;
  services: RawServiceRelation | RawServiceRelation[] | null;
}

interface RawVehicle {
  brand: string;
  model: string;
  plate: string;
}

interface RawClientRelation {
  id: string;
  name: string;
}

interface RawOrder {
  id: string;
  total_amount: number | string;
  completed_at: string | null;
  opened_at: string | null;
  clients: RawClientRelation | RawClientRelation[] | null;
  vehicles: RawVehicle | RawVehicle[] | null;
  service_order_items: RawOrderItem[] | null;
}

function getOrderDate(order: RawOrder) {
  return (order.completed_at ?? order.opened_at ?? "").slice(0, 10);
}

async function loadTransactions(supabase: Supabase, workshopId: string) {
  const attempts = [
    "id, type, description, amount, category, service_order_id, supplier_id, transaction_date",
    "id, type, description, amount, category, service_order_id, transaction_date",
  ];

  for (const columns of attempts) {
    const { data, error } = await supabase
      .from("financial_transactions")
      .select(columns)
      .eq("workshop_id", workshopId)
      .order("transaction_date", { ascending: false });

    if (!error) {
      return ((data ?? []) as unknown as RawTransaction[]).map((row) => ({
        ...row,
        supplier_id: "supplier_id" in row ? row.supplier_id : null,
      }));
    }
  }

  return [] as RawTransaction[];
}

export async function fetchReportsSourceData(
  workshopId: string
): Promise<ReportsSourceData> {
  const supabase = createClient();

  const [
    { data: workshopData },
    { data: clientsData },
    { data: suppliersData },
    { data: ordersData },
    transactions,
  ] = await Promise.all([
    supabase
      .from("workshops")
      .select("name, document, phone, address, logo_url")
      .eq("id", workshopId)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("id, name, phone, document, address")
      .eq("workshop_id", workshopId)
      .order("name", { ascending: true }),
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("workshop_id", workshopId),
    supabase
      .from("service_orders")
      .select(
        `
        id,
        total_amount,
        completed_at,
        opened_at,
        clients(id, name),
        vehicles(brand, model, plate),
        service_order_items(
          quantity,
          unit_price,
          services(name, price)
        )
      `
      )
      .eq("workshop_id", workshopId)
      .eq("status", "finalizada")
      .order("completed_at", { ascending: false }),
    loadTransactions(supabase, workshopId),
  ]);

  const clients: ReportClient[] = (
    (clientsData as
      | {
          id: string;
          name: string;
          phone: string | null;
          document: string | null;
          address: string | null;
        }[]
      | null) ?? []
  ).map((client) => ({
    id: client.id,
    name: client.name,
    phone: client.phone ?? null,
    document: client.document ?? null,
    address: client.address ?? null,
  }));

  const suppliersById = new Map(
    ((suppliersData as { id: string; name: string }[] | null) ?? []).map((s) => [
      s.id,
      s.name,
    ])
  );

  const orders = ((ordersData as unknown as RawOrder[] | null) ?? []);
  const ordersById = new Map(orders.map((order) => [order.id, order]));

  const revenueEntries: ReportRevenueEntry[] = [];
  const expenseEntries: ReportExpenseEntry[] = [];
  const reportOrderIds = new Set<string>();

  for (const transaction of transactions) {
    const amount = toCurrencyNumber(transaction.amount);
    const date = transaction.transaction_date;

    if (transaction.type === "receita") {
      const order = transaction.service_order_id
        ? ordersById.get(transaction.service_order_id)
        : undefined;
      const client = order ? firstRelation(order.clients) : null;
      const serviceName =
        order?.service_order_items
          ?.map((item) => firstRelation(item.services)?.name)
          .filter(Boolean)
          .join(", ") || transaction.category || "Receita manual";

      if (order) reportOrderIds.add(order.id);

      revenueEntries.push({
        id: transaction.id,
        date,
        clientId: client?.id ?? null,
        clientName: client?.name ?? "Avulso",
        serviceName,
        category: transaction.category ?? "Outros",
        kind: transaction.service_order_id ? "automatic" : "manual",
        amount,
      });
      continue;
    }

    expenseEntries.push({
      id: transaction.id,
      date,
      description: transaction.description,
      supplierName: transaction.supplier_id
        ? suppliersById.get(transaction.supplier_id) ?? "Fornecedor removido"
        : "—",
      category: transaction.category ?? "Outros",
      amount,
    });
  }

  const serviceItems: ReportServiceItem[] = [];
  for (const order of orders) {
    if (!reportOrderIds.has(order.id)) continue;

    const client = firstRelation(order.clients);
    const vehicle = firstRelation(order.vehicles);
    const vehicleLabel = vehicle
      ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`.trim()
      : null;
    const date = getOrderDate(order);
    const items = order.service_order_items ?? [];

    if (items.length === 0) {
      serviceItems.push({
        id: `${order.id}-service`,
        orderId: order.id,
        date,
        clientId: client?.id ?? null,
        clientName: client?.name ?? "Cliente não encontrado",
        vehicleLabel,
        serviceName: "Serviço",
        quantity: 1,
        amount: toCurrencyNumber(order.total_amount),
      });
      continue;
    }

    items.forEach((item, index) => {
      const service = firstRelation(item.services);
      const quantity = Number(item.quantity) || 1;
      // Prioritize the value actually charged on this order item
      // (`unit_price`, set when the appointment was created/customized) over
      // the service's current catalog price, which may have since changed
      // and does not reflect what the client was really charged.
      const unitPrice = toCurrencyNumber(item.unit_price ?? service?.price);

      serviceItems.push({
        id: `${order.id}-${index}`,
        orderId: order.id,
        date,
        clientId: client?.id ?? null,
        clientName: client?.name ?? "Cliente não encontrado",
        vehicleLabel,
        serviceName: service?.name ?? "Serviço",
        quantity,
        amount: unitPrice * quantity,
      });
    });
  }

  const workshop = workshopData as {
    name?: string;
    document?: string | null;
    phone?: string | null;
    address?: string | null;
    logo_url?: string | null;
  } | null;

  return {
    workshop: {
      name: workshop?.name ?? "Jozep's Garage",
      document: workshop?.document ?? null,
      phone: workshop?.phone ?? null,
      address: workshop?.address ?? null,
      logoUrl: workshop?.logo_url ?? null,
    },
    clients,
    revenueEntries,
    expenseEntries,
    serviceItems,
  };
}

/**
 * Flattens the three separate report sources (revenue, expense, service items)
 * into a single row shape so the reports table can filter/sort/select across
 * all of them uniformly.
 */
export function buildTransactionRows(
  source: Pick<ReportsSourceData, "revenueEntries" | "expenseEntries" | "serviceItems">
): ReportTransactionRow[] {
  const revenueRows: ReportTransactionRow[] = source.revenueEntries.map((entry) => ({
    id: `receita-${entry.id}`,
    type: "receita",
    date: entry.date,
    clientId: entry.clientId,
    clientName: entry.clientName,
    description: entry.serviceName,
    category: entry.category,
    amount: entry.amount,
  }));

  const expenseRows: ReportTransactionRow[] = source.expenseEntries.map((entry) => ({
    id: `despesa-${entry.id}`,
    type: "despesa",
    date: entry.date,
    clientId: null,
    clientName: entry.supplierName,
    description: entry.description,
    category: entry.category,
    amount: entry.amount,
  }));

  const serviceRows: ReportTransactionRow[] = source.serviceItems.map((item) => ({
    id: `servico-${item.id}`,
    type: "servico",
    date: item.date,
    clientId: item.clientId,
    clientName: item.clientName,
    description: item.serviceName,
    category: item.vehicleLabel ?? "Serviço",
    amount: item.amount,
  }));

  return [...revenueRows, ...expenseRows, ...serviceRows];
}
