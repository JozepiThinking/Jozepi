export type ProductType = "liquid" | "utensil";

export interface ProductItem {
  id: string;
  name: string;
  type: ProductType;
  volumeMl: string;
  usagePerWashMl: string;
  quantity: string;
  durabilityWashes: string;
  totalCost: string;
}

export interface ProductForm {
  name: string;
  type: ProductType;
  volumeMl: string;
  usagePerWashMl: string;
  quantity: string;
  durabilityWashes: string;
  totalCost: string;
}

export interface ServiceProductUsage {
  id: string;
  productId: string;
  amount: string;
}

export const PRODUCTS_STORAGE_KEY = "auto-estetica-products-utensils";
export const SERVICE_PRODUCT_USAGE_STORAGE_KEY =
  "auto-estetica-service-product-usages";

export const emptyProductForm: ProductForm = {
  name: "",
  type: "liquid",
  volumeMl: "",
  usagePerWashMl: "",
  quantity: "",
  durabilityWashes: "",
  totalCost: "",
};

export const productTypeOptions = [
  { value: "liquid", label: "Produto líquido" },
  { value: "utensil", label: "Utensílio" },
];

export function parseMoney(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const price = Number(normalized);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Informe um preço válido.");
  }

  return price;
}

export function parsePositiveNumber(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error("Informe valores maiores que zero.");
  }

  return number;
}

export function calculateProductUsageCost(
  product: ProductItem,
  amountValue: string
) {
  try {
    const totalCost = parseMoney(product.totalCost || "0");
    const amount = parsePositiveNumber(amountValue);

    if (product.type === "liquid") {
      const volumeMl = parsePositiveNumber(product.volumeMl);
      return (totalCost * amount) / volumeMl;
    }

    const quantity = parsePositiveNumber(product.quantity);
    return (totalCost * amount) / quantity;
  } catch {
    return 0;
  }
}

export function getProductTypeLabel(type: ProductType) {
  return type === "liquid" ? "Produto líquido" : "Utensílio";
}

export function getProductAmountLabel(type: ProductType) {
  return type === "liquid" ? "Quantidade usada neste serviço (ml)" : "Quantidade usada neste serviço";
}

export function createProductId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `product-${Date.now()}-${Math.random()}`;
}

export function createUsageId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `usage-${Date.now()}-${Math.random()}`;
}
