"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Droplets,
  Mail,
  Filter,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Wrench,
  X,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPhone, normalizeOptionalPhone } from "@/lib/utils/format";
import {
  createProductId,
  createProductPriceHistoryId,
  createProductTypeId,
  emptyProductForm,
  formatStockAmount,
  getProductInitialStock,
  getProductRemainingStock,
  getProductStockPercent,
  getProductStockUnit,
  getProductTypeLabel,
  parseMoney,
  parsePositiveNumber,
  productTypeOptions,
  type ProductForm,
  type ProductItem,
  type ProductPriceHistoryReason,
  type ServiceProductUsage,
  type ProductType,
  type ProductTypeOption,
} from "@/lib/products/catalog";
import {
  clearLocalCatalogStorage,
  deleteSupabaseProduct,
  importLocalCatalogToSupabase,
  loadSupabaseCatalog,
  readLocalCatalogFromStorage,
  saveSupabaseProduct,
  saveSupabaseProductTypes,
} from "@/lib/products/supabase-catalog";

const PRODUCT_FORM_EXIT_MS = 180;

type ProductTypeFilter = "all" | "liquid" | "utensil";
type ProductPageTab = "products" | "suppliers";
interface Supplier {
  id: string;
  workshop_id: string;
  name: string;
  contactName?: string | null;
  phone: string | null;
  whatsapp?: string | null;
  email?: string | null;
  document?: string | null;
  cityState?: string | null;
  category: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SupplierForm {
  name: string;
  contactName: string;
  phone: string;
  whatsapp: string;
  email: string;
  document: string;
  cityState: string;
  notes: string;
}

interface ReplenishForm {
  supplierId: string;
  amount: string;
  paidAmount: string;
  purchaseDate: string;
}

const productTypeFilterOptions = [
  { value: "all", label: "Todos" },
  { value: "liquid", label: "Líquidos" },
  { value: "utensil", label: "Utensílios" },
];
const productPageTabs: { id: ProductPageTab; label: string }[] = [
  { id: "products", label: "Produtos" },
  { id: "suppliers", label: "Fornecedores" },
];
const emptySupplierForm: SupplierForm = {
  name: "",
  contactName: "",
  phone: "",
  whatsapp: "",
  email: "",
  document: "",
  cityState: "",
  notes: "",
};

function sortSuppliers(list: Supplier[]) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

function mergeSuppliers(current: Supplier[], incoming: Supplier[]) {
  const byId = new Map(current.map((supplier) => [supplier.id, supplier]));
  incoming.forEach((supplier) => {
    const existing = byId.get(supplier.id);
    byId.set(supplier.id, existing ? { ...existing, ...supplier } : supplier);
  });
  return sortSuppliers(Array.from(byId.values()));
}

function getSupplierExtra(supplier: Supplier, key: string) {
  const value = (supplier as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function getSupplierWhatsAppUrl(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

const PRODUCT_PHOTO_MAX_SIZE = 480;
const PRODUCT_PHOTO_QUALITY = 0.72;
const PRODUCT_PHOTO_COMPACT_THRESHOLD = 180_000;
const priceHistoryReasonLabels: Record<ProductPriceHistoryReason, string> = {
  created: "Cadastro",
  edited: "Edição",
  replenished: "Reposição",
};

function resizeProductImage(source: File | string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const objectUrl = source instanceof File ? URL.createObjectURL(source) : null;

    image.onload = () => {
      const scale = Math.min(
        1,
        PRODUCT_PHOTO_MAX_SIZE / Math.max(image.width, image.height)
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Não foi possível processar a foto."));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", PRODUCT_PHOTO_QUALITY));
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível carregar a foto."));
    };

    image.src = objectUrl ?? (source as string);
  });
}

async function compactProductPhoto(product: ProductItem) {
  if (
    !product.photoUrl?.startsWith("data:image/") ||
    product.photoUrl.length <= PRODUCT_PHOTO_COMPACT_THRESHOLD
  ) {
    return product;
  }

  try {
    return {
      ...product,
      photoUrl: await resizeProductImage(product.photoUrl),
    };
  } catch {
    return product;
  }
}

function formatPriceHistoryDate(date: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toLocaleDateString("pt-BR");
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function SupplierDetail({
  label,
  value,
  href,
  icon,
}: {
  label: string;
  value: string;
  href?: string;
  icon?: React.ReactNode;
}) {
  const displayValue = value.trim() || "—";
  const content = (
    <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-foreground">
      {icon}
      <span className="truncate">{displayValue}</span>
    </span>
  );

  return (
    <div className="rounded-lg bg-background px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">
        {label}
      </p>
      <div className="mt-1">
        {href && value.trim() ? (
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noreferrer" : undefined}
            className="text-primary transition-colors hover:text-primary-hover"
          >
            {content}
          </a>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

export function ProductsPage() {
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => new Date(), []);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [catalogSyncReady, setCatalogSyncReady] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplierForm);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [typeOptions, setTypeOptions] =
    useState<ProductTypeOption[]>(productTypeOptions);
  const [serviceProductUsages, setServiceProductUsages] = useState<
    Record<string, ServiceProductUsage[]>
  >({});
  const [typeError, setTypeError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ProductTypeFilter>("all");
  const [activeProductTab, setActiveProductTab] = useState<ProductPageTab>("products");
  const [showProductFilter, setShowProductFilter] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formClosing, setFormClosing] = useState(false);
  const [formAnimationKey, setFormAnimationKey] = useState(0);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProductForm);
  const [error, setError] = useState<string | null>(null);
  const [replenishingProductId, setReplenishingProductId] = useState<string | null>(
    null
  );
  const [replenishForm, setReplenishForm] = useState<ReplenishForm>({
    supplierId: "",
    amount: "",
    paidAmount: "",
    purchaseDate: dateKey(today),
  });
  const [replenishError, setReplenishError] = useState<string | null>(null);
  const [editingStockProductId, setEditingStockProductId] = useState<string | null>(
    null
  );
  const [stockEditValue, setStockEditValue] = useState("");
  const closeFormTimeoutRef = useRef<number | null>(null);
  const catalogSyncStartedRef = useRef(false);

  function clearCloseFormTimeout() {
    if (closeFormTimeoutRef.current) {
      window.clearTimeout(closeFormTimeoutRef.current);
      closeFormTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    async function loadSuppliers() {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("workshop_id")
        .single();

      if (profileError || !profile?.workshop_id) {
        setSupplierError(profileError?.message ?? "Oficina não encontrada.");
        setSuppliersLoaded(true);
        return;
      }

      setWorkshopId(profile.workshop_id);

      const { data, error: suppliersError } = await supabase
        .from("suppliers")
        .select("id, workshop_id, name, phone, category, notes, created_at, updated_at")
        .eq("workshop_id", profile.workshop_id)
        .order("name", { ascending: true });

      if (suppliersError) {
        setSupplierError(suppliersError.message);
      } else {
        setSuppliers(sortSuppliers((data as Supplier[] | null) ?? []));
      }

      setSuppliersLoaded(true);
    }

    void loadSuppliers();
  }, [supabase]);

  useEffect(() => {
    if (!workshopId || catalogSyncStartedRef.current) {
      return;
    }

    catalogSyncStartedRef.current = true;

    void Promise.resolve().then(async () => {
      try {
        const localCatalog = readLocalCatalogFromStorage();
        if (localCatalog.hasData) {
          await importLocalCatalogToSupabase(
            supabase,
            workshopId,
            localCatalog.products,
            localCatalog.typeOptions,
            localCatalog.serviceProductUsages
          );
          clearLocalCatalogStorage();
        }

        const catalog = await loadSupabaseCatalog(supabase, workshopId);
        setProducts(
          await Promise.all(catalog.products.map(compactProductPhoto))
        );
        setTypeOptions(catalog.typeOptions);
        setServiceProductUsages(catalog.serviceProductUsages);
        setCatalogSyncReady(true);
      } catch (err) {
        setCatalogSyncReady(false);
        setError(
          err instanceof Error
            ? `Persistência de produtos no Supabase indisponível: ${err.message}`
            : "Persistência de produtos no Supabase indisponível."
        );
      }
    });
  }, [supabase, workshopId]);

  useEffect(() => {
    if (!catalogSyncReady || !workshopId) return;

    void saveSupabaseProductTypes(supabase, workshopId, typeOptions).catch((err) => {
      setError(
        err instanceof Error
          ? `Tipos de produto não sincronizaram: ${err.message}`
          : "Tipos de produto não sincronizaram."
      );
    });
  }, [catalogSyncReady, supabase, typeOptions, workshopId]);

  useEffect(() => {
    return clearCloseFormTimeout;
  }, []);

  function showForm() {
    clearCloseFormTimeout();
    setFormClosing(false);
    setFormOpen(true);
    setFormAnimationKey((current) => current + 1);
  }

  function openCreateForm() {
    setEditingProduct(null);
    setForm(emptyProductForm);
    setError(null);
    setTypeError(null);
    setReplenishingProductId(null);
    setReplenishForm({
      supplierId: "",
      amount: "",
      paidAmount: "",
      purchaseDate: dateKey(today),
    });
    setReplenishError(null);
    setEditingStockProductId(null);
    setStockEditValue("");
    showForm();
  }

  function openEditForm(product: ProductItem) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      type: product.type,
      volumeMl: product.volumeMl,
      usagePerWashMl: product.usagePerWashMl,
      quantity: product.quantity,
      durabilityWashes: product.durabilityWashes,
      totalCost: product.totalCost,
      photoUrl: product.photoUrl ?? "",
      supplierId: product.supplierId ?? "",
    });
    setError(null);
    setTypeError(null);
    setReplenishingProductId(null);
    setReplenishForm({
      supplierId: product.supplierId ?? "",
      amount: "",
      paidAmount: "",
      purchaseDate: dateKey(today),
    });
    setReplenishError(null);
    setEditingStockProductId(null);
    setStockEditValue("");
    showForm();
  }

  function closeForm() {
    if (!formOpen) return;

    clearCloseFormTimeout();
    setFormClosing(true);

    closeFormTimeoutRef.current = window.setTimeout(() => {
      setEditingProduct(null);
      setForm(emptyProductForm);
      setError(null);
      setTypeError(null);
      setFormOpen(false);
      setFormClosing(false);
      closeFormTimeoutRef.current = null;
    }, PRODUCT_FORM_EXIT_MS);
  }

  function updateForm(patch: Partial<ProductForm>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function getTypeLabel(type: ProductType) {
    return (
      typeOptions.find((option) => option.value === type)?.label ??
      getProductTypeLabel(type)
    );
  }

  const persistedSuppliers = suppliers.filter(
    (supplier) => supplier.workshop_id !== "local"
  );
  const supplierOptions = [
    { value: "", label: "Sem fornecedor" },
    ...persistedSuppliers.map((supplier) => ({
      value: supplier.id,
      label: supplier.name,
    })),
  ];

  function getSupplierName(supplierId?: string) {
    if (!supplierId) return "Sem fornecedor";
    return suppliers.find((supplier) => supplier.id === supplierId)?.name ?? "Fornecedor removido";
  }

  function updateSupplierForm(patch: Partial<SupplierForm>) {
    setSupplierForm((prev) => ({ ...prev, ...patch }));
  }

  function openSupplierForm() {
    setEditingSupplierId(null);
    setSupplierForm(emptySupplierForm);
    setSupplierError(null);
    setSupplierFormOpen(true);
  }

  function startEditingSupplier(supplier: Supplier) {
    setEditingSupplierId(supplier.id);
    const whatsapp = getSupplierExtra(supplier, "whatsapp");
    setSupplierForm({
      name: supplier.name,
      contactName: getSupplierExtra(supplier, "contactName"),
      phone: supplier.phone ? formatPhone(supplier.phone) : "",
      whatsapp: whatsapp ? formatPhone(whatsapp) : "",
      email: getSupplierExtra(supplier, "email"),
      document: getSupplierExtra(supplier, "document"),
      cityState: getSupplierExtra(supplier, "cityState"),
      notes: supplier.notes ?? "",
    });
    setSupplierError(null);
    setSupplierFormOpen(true);
  }

  function resetSupplierForm() {
    setEditingSupplierId(null);
    setSupplierForm(emptySupplierForm);
    setSupplierError(null);
    setSupplierFormOpen(false);
  }

  async function handleSaveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supplierForm.name.trim()) {
      setSupplierError("Informe o nome do fornecedor.");
      return;
    }

    if (!workshopId) {
      setSupplierError("Oficina não encontrada.");
      return;
    }

    setSavingSupplier(true);
    setSupplierError(null);

    let normalizedPhone: string | null = null;
    let normalizedWhatsapp: string | null = null;

    try {
      normalizedPhone = normalizeOptionalPhone(supplierForm.phone);
      normalizedWhatsapp = normalizeOptionalPhone(supplierForm.whatsapp);
    } catch (err) {
      setSavingSupplier(false);
      setSupplierError(
        err instanceof Error ? err.message : "Informe um telefone válido com DDD."
      );
      return;
    }

    const now = new Date().toISOString();
    const existingSupplier = suppliers.find((supplier) => supplier.id === editingSupplierId);
    const payload = {
      workshop_id: workshopId,
      name: supplierForm.name.trim(),
      phone: normalizedPhone,
      category: existingSupplier?.category ?? "Outros",
      notes: supplierForm.notes.trim() || null,
      updated_at: now,
    };

    const result = editingSupplierId
      ? await supabase
          .from("suppliers")
          .update(payload)
          .eq("id", editingSupplierId)
          .eq("workshop_id", workshopId)
          .select("id, workshop_id, name, phone, category, notes, created_at, updated_at")
          .single()
      : await supabase
          .from("suppliers")
          .insert(payload)
          .select("id, workshop_id, name, phone, category, notes, created_at, updated_at")
          .single();

    setSavingSupplier(false);

    if (result.error || !result.data) {
      setSupplierError(
        result.error?.message ?? "Não foi possível salvar o fornecedor no Supabase."
      );
      return;
    }

    const supplier: Supplier = {
      ...(result.data as Supplier),
      contactName: supplierForm.contactName.trim() || null,
      whatsapp: normalizedWhatsapp,
      email: supplierForm.email.trim() || null,
      document: supplierForm.document.trim() || null,
      cityState: supplierForm.cityState.trim() || null,
    };

    setSuppliers((prev) =>
      editingSupplierId
        ? sortSuppliers([
            ...prev.filter((item) => item.id !== editingSupplierId),
            supplier,
          ])
        : mergeSuppliers(prev, [supplier])
    );
    setSelectedSupplierId(supplier.id);
    resetSupplierForm();
  }

  async function handleDeleteSupplier(supplier: Supplier) {
    if (products.some((product) => product.supplierId === supplier.id)) {
      setSupplierError("Não é possível excluir um fornecedor vinculado a produtos.");
      return;
    }

    const confirmed = window.confirm(`Deseja excluir ${supplier.name}?`);
    if (!confirmed) return;

    if (supplier.workshop_id !== "local") {
      await supabase.from("suppliers").delete().eq("id", supplier.id);
    }

    setSuppliers((prev) => prev.filter((item) => item.id !== supplier.id));
    if (selectedSupplierId === supplier.id) {
      setSelectedSupplierId(null);
    }
    if (editingSupplierId === supplier.id) {
      resetSupplierForm();
    }
  }

  function handleAddType(label: string) {
    const alreadyExists = typeOptions.some(
      (option) => option.label.toLowerCase() === label.toLowerCase()
    );

    if (alreadyExists) {
      return "Esse tipo já existe.";
    }

    const nextType: ProductTypeOption = {
      value: createProductTypeId(label),
      label,
      custom: true,
    };

    setTypeOptions((prev) => [...prev, nextType]);
    updateForm({ type: nextType.value });
    setTypeError(null);
  }

  function handleDeleteType(type: string) {
    const option = typeOptions.find((item) => item.value === type);
    if (!option?.custom) return;

    const typeInUse = products.some((product) => product.type === type);
    if (typeInUse) {
      setTypeError("Não é possível apagar um tipo usado em produtos cadastrados.");
      return;
    }

    setTypeOptions((prev) => prev.filter((item) => item.value !== type));
    if (form.type === type) {
      updateForm({ type: "liquid" });
    }
    setTypeError(null);
  }

  async function handleProductPhotoChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecione uma imagem válida para a foto do produto.");
      return;
    }

    try {
      updateForm({ photoUrl: await resizeProductImage(file) });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar a foto.");
    }
    event.target.value = "";
  }

  function createPriceHistoryEntry(
    price: string,
    reason: ProductPriceHistoryReason
  ) {
    return {
      id: createProductPriceHistoryId(),
      price,
      date: new Date().toISOString(),
      reason,
    };
  }

  function validateProductForm() {
    if (!form.name.trim()) {
      throw new Error("Informe o nome do produto.");
    }

    parseMoney(form.totalCost || "0");

    if (form.type === "liquid") {
      parsePositiveNumber(form.volumeMl);
      return;
    }

    parsePositiveNumber(form.quantity);
  }

  async function handleSaveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!workshopId) {
      setError("Oficina não encontrada.");
      return;
    }

    try {
      validateProductForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Informe os dados do produto.");
      return;
    }

    const persistedSupplierId =
      form.supplierId &&
      persistedSuppliers.some((supplier) => supplier.id === form.supplierId)
        ? form.supplierId
        : undefined;

    if (form.supplierId && !persistedSupplierId) {
      setError(
        "O fornecedor selecionado não está salvo no Supabase. Cadastre-o na aba Fornecedores antes de vincular ao produto."
      );
      return;
    }

    const baseProduct: ProductItem = {
      id: editingProduct?.id ?? createProductId(),
      name: form.name.trim(),
      type: form.type,
      volumeMl: form.type === "liquid" ? form.volumeMl : "",
      usagePerWashMl: "",
      quantity: form.type === "utensil" ? form.quantity : "",
      durabilityWashes: "",
      totalCost: form.totalCost,
      photoUrl: form.photoUrl || undefined,
      supplierId: persistedSupplierId,
      priceHistory: editingProduct?.priceHistory ?? [],
    };
    const previousPrice = editingProduct
      ? parseMoney(editingProduct.totalCost || "0")
      : null;
    const nextPrice = parseMoney(form.totalCost || "0");
    if (
      editingProduct &&
      previousPrice !== nextPrice &&
      editingProduct.totalCost
    ) {
      baseProduct.priceHistory = [
        createPriceHistoryEntry(editingProduct.totalCost, "edited"),
        ...(editingProduct.priceHistory ?? []),
      ];
    }
    const initialStock = getProductInitialStock(baseProduct);
    const preservedRemaining =
      editingProduct && editingProduct.type === baseProduct.type
        ? getProductRemainingStock(editingProduct)
        : initialStock;
    const nextProduct: ProductItem = {
      ...baseProduct,
      stockRemaining: String(Math.min(initialStock, preservedRemaining)),
    };

    try {
      await saveSupabaseProduct(supabase, workshopId, nextProduct);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Não foi possível salvar no Supabase: ${err.message}`
          : "Não foi possível salvar no Supabase."
      );
      return;
    }

    setProducts((prev) =>
      editingProduct
        ? prev.map((product) =>
            product.id === editingProduct.id ? nextProduct : product
          )
        : [nextProduct, ...prev]
    );
    closeForm();
  }

  async function handleDeleteProduct(product: ProductItem) {
    const confirmed = window.confirm(`Deseja excluir ${product.name}?`);
    if (!confirmed) return;

    try {
      await deleteSupabaseProduct(supabase, product.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Não foi possível excluir no Supabase: ${err.message}`
          : "Não foi possível excluir no Supabase."
      );
      return;
    }

    setProducts((prev) => prev.filter((item) => item.id !== product.id));

    if (editingProduct?.id === product.id) {
      closeForm();
    }
  }

  function openReplenish(productId: string) {
    const product = products.find((item) => item.id === productId);
    setReplenishingProductId(productId);
    setReplenishForm({
      supplierId: product?.supplierId ?? "",
      amount: "",
      paidAmount: "",
      purchaseDate: dateKey(today),
    });
    setReplenishError(null);
    setEditingStockProductId(null);
    setStockEditValue("");
  }

  function closeReplenish() {
    setReplenishingProductId(null);
    setReplenishForm({
      supplierId: "",
      amount: "",
      paidAmount: "",
      purchaseDate: dateKey(today),
    });
    setReplenishError(null);
  }

  async function handleReplenishProduct(product: ProductItem) {
    setReplenishError(null);

    let addedAmount: number;
    try {
      addedAmount = parsePositiveNumber(replenishForm.amount);
    } catch {
      setReplenishError("Informe uma quantidade válida para repor.");
      return;
    }

    let paidAmount: number;
    try {
      paidAmount = parseMoney(replenishForm.paidAmount || "0");
    } catch {
      setReplenishError("Informe um valor pago válido.");
      return;
    }

    if (paidAmount <= 0) {
      setReplenishError("Informe o valor pago na reposição.");
      return;
    }

    if (!replenishForm.purchaseDate) {
      setReplenishError("Informe a data da compra.");
      return;
    }

    if (!workshopId) {
      setReplenishError("Oficina não encontrada.");
      return;
    }

    const currentStock = getProductRemainingStock(product);
    const nextStock = currentStock + addedAmount;
    const nextInitialStock = Math.max(getProductInitialStock(product), nextStock);
    const stockFieldPatch =
      product.type === "liquid"
        ? { volumeMl: String(nextInitialStock) }
        : { quantity: String(nextInitialStock) };

    const supplierName = getSupplierName(replenishForm.supplierId);
    const baseTransactionPayload = {
      workshop_id: workshopId,
      type: "despesa",
      description: `Reposição: ${product.name}`,
      amount: paidAmount,
      category: "Produtos",
      transaction_date: replenishForm.purchaseDate,
    };
    const { error: transactionError } = await supabase
      .from("financial_transactions")
      .insert({
        ...baseTransactionPayload,
        supplier_id: replenishForm.supplierId || null,
        product_id: product.id,
        source: "stock_replenishment",
      });

    if (transactionError) {
      const { error: fallbackTransactionError } = await supabase
        .from("financial_transactions")
        .insert({
          ...baseTransactionPayload,
          notes: replenishForm.supplierId
            ? `Fornecedor: ${supplierName}`
            : null,
        });

      if (fallbackTransactionError) {
        setReplenishError(fallbackTransactionError.message);
        return;
      }
    }

    const updatedProduct: ProductItem = {
      ...product,
      ...stockFieldPatch,
      supplierId: replenishForm.supplierId || product.supplierId,
      stockRemaining: String(nextStock),
      priceHistory: product.priceHistory ?? [],
    };

    try {
      await saveSupabaseProduct(supabase, workshopId, updatedProduct);
    } catch (err) {
      setReplenishError(
        err instanceof Error
          ? `Reposição registrada, mas estoque não sincronizou: ${err.message}`
          : "Reposição registrada, mas estoque não sincronizou."
      );
      return;
    }

    setProducts((prev) =>
      prev.map((item) =>
        item.id === product.id ? updatedProduct : item
      )
    );
    closeReplenish();
  }

  function openStockEdit(product: ProductItem) {
    setEditingStockProductId(product.id);
    setStockEditValue(String(getProductRemainingStock(product)));
    setReplenishingProductId(null);
    setReplenishForm({
      supplierId: "",
      amount: "",
      paidAmount: "",
      purchaseDate: dateKey(today),
    });
    setReplenishError(null);
  }

  function closeStockEdit() {
    setEditingStockProductId(null);
    setStockEditValue("");
  }

  function updateCurrentStock(product: ProductItem, value: string) {
    const currentStock = Number(value);
    const maxStock = getProductInitialStock(product);
    const nextStock = Math.min(maxStock, Math.max(0, currentStock));
    const nextProduct = { ...product, stockRemaining: String(nextStock) };

    if (workshopId) {
      void saveSupabaseProduct(supabase, workshopId, nextProduct).catch((err) => {
        setError(
          err instanceof Error
            ? `Estoque ajustado na tela, mas não sincronizou: ${err.message}`
            : "Estoque ajustado na tela, mas não sincronizou."
        );
      });
    }

    setProducts((prev) =>
      prev.map((item) =>
        item.id === product.id
          ? nextProduct
          : item
      )
    );
  }

  function getProductUsageSummary(product: ProductItem) {
    const summary = Object.values(serviceProductUsages).reduce(
      (acc, usages) => {
        const usage = usages.find((item) => item.productId === product.id);
        if (!usage) return acc;

        try {
          const amount = parsePositiveNumber(usage.amount);
          return {
            serviceCount: acc.serviceCount + 1,
            totalUsage: acc.totalUsage + amount,
          };
        } catch {
          return acc;
        }
      },
      { serviceCount: 0, totalUsage: 0 }
    );
    const averageUsage =
      summary.serviceCount > 0 ? summary.totalUsage / summary.serviceCount : 0;
    const estimatedUses =
      averageUsage > 0
        ? Math.floor(getProductRemainingStock(product) / averageUsage)
        : null;

    return {
      ...summary,
      averageUsage,
      estimatedUses,
    };
  }

  const filteredProducts = products.filter((product) => {
    if (typeFilter === "all") return true;
    if (typeFilter === "liquid") return product.type === "liquid";
    return product.type !== "liquid";
  });
  const totalInvested = products.reduce(
    (total, product) => total + parseMoney(product.totalCost || "0"),
    0
  );
  const stockProducts = products.filter((product) => product.type === "liquid");
  const selectedSupplier =
    suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null;

  return (
    <>
      <div className="mb-6 border-b border-border">
        <div className="flex items-center gap-6">
          {productPageTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveProductTab(tab.id);
                setShowProductFilter(false);
              }}
              className={`border-b-2 px-0 pb-3 pt-1 text-sm transition-all duration-200 ease-out ${
                activeProductTab === tab.id
                  ? "border-primary font-bold text-primary"
                  : "border-transparent font-semibold text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeProductTab === "products" && (
        <div key="products-tab" className="product-tab-panel-enter">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <button
          type="button"
          onClick={() => setShowProductFilter(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 text-foreground/70 transition-colors hover:bg-background hover:text-foreground"
          aria-label="Abrir filtros de produtos"
          title="Abrir filtros"
        >
          <Filter className="h-4 w-4" />
        </button>

        {products.length > 0 && (
          <Button
            variant="success"
            onClick={openCreateForm}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Adicionar produto
          </Button>
        )}
      </div>

      {showProductFilter && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 px-4 pt-28 backdrop-blur-[2px]"
          onClick={() => setShowProductFilter(false)}
        >
          <div
            className="product-filter-panel-enter w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl ring-1 ring-slate-900/5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-foreground">
                Filtros
              </h3>
              <p className="mt-1 text-sm text-muted">
                Filtre o catálogo por tipo de produto.
              </p>
            </div>
            <div className="space-y-4">
              <Dropdown
                label="Filtrar por tipo"
                value={typeFilter}
                options={productTypeFilterOptions}
                onChange={(value) => setTypeFilter(value as ProductTypeFilter)}
              />
              <div className="rounded-lg bg-background px-4 py-3 text-sm font-semibold text-foreground">
                {filteredProducts.length} produto
                {filteredProducts.length !== 1 ? "s" : ""} encontrado
                {filteredProducts.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTypeFilter("all")}
                className="w-full sm:w-auto"
              >
                Limpar filtros
              </Button>
              <Button
                type="button"
                onClick={() => setShowProductFilter(false)}
                className="w-full sm:w-auto"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] xl:items-start">
        <section className="order-2 xl:order-1">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card shadow-card py-16 text-center shadow-card">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <Package className="h-7 w-7 text-success" />
              </div>
              <p className="font-medium text-foreground">
                Nenhum produto cadastrado
              </p>
              <p className="mt-1 text-sm text-muted">
                Crie seu catálogo para usar nos serviços.
              </p>
              <Button variant="success" className="mt-4" onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Adicionar produto
              </Button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card py-14 text-center shadow-card">
              <p className="font-medium text-foreground">
                Nenhum produto encontrado
              </p>
              <p className="mt-1 text-sm text-muted">
                Troque o filtro para ver outros produtos cadastrados.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map((product) => {
                const isLiquid = product.type === "liquid";

                return (
                  <article
                    key={product.id}
                    className="relative z-0 rounded-lg border border-border bg-card shadow-card p-5 shadow-card transition-all hover:z-50 hover:-translate-y-0.5 hover:shadow-card-hover"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {product.photoUrl ? (
                          <span className="product-photo-preview group/photo relative h-10 w-10 shrink-0 cursor-zoom-in overflow-visible rounded-lg border border-border bg-card shadow-card shadow-card transition-all duration-300 hover:border-success/40 hover:shadow-card-hover hover:ring-2 hover:ring-success/15">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={product.photoUrl}
                              alt={`Foto de ${product.name}`}
                              className="h-full w-full rounded-lg object-cover transition duration-300 group-hover/photo:scale-105 group-hover/photo:brightness-110"
                            />
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-foreground/0 text-white opacity-0 transition-all duration-300 group-hover/photo:bg-foreground/25 group-hover/photo:opacity-100">
                              <ZoomIn className="h-4 w-4 drop-shadow-card" />
                            </span>
                            <span className="pointer-events-none absolute left-0 top-12 z-[999] hidden h-44 w-44 overflow-hidden rounded-lg border border-border bg-card shadow-card p-1 opacity-0 shadow-2xl ring-1 ring-slate-900/5 group-hover/photo:block product-photo-preview-popover">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={product.photoUrl}
                                alt={`Prévia ampliada de ${product.name}`}
                                className="h-full w-full rounded-lg object-cover"
                              />
                            </span>
                          </span>
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                            {isLiquid ? (
                              <Droplets className="h-5 w-5" />
                            ) : (
                              <Wrench className="h-5 w-5" />
                            )}
                          </span>
                        )}
                        <div>
                          <h2 className="font-semibold text-foreground">
                            {product.name}
                          </h2>
                          <p className="text-xs font-medium text-muted">
                            {getTypeLabel(product.type)}
                            {product.supplierId
                              ? ` • ${getSupplierName(product.supplierId)}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(product)}
                          className="rounded-lg bg-success/10 p-2 text-success transition-colors hover:bg-success hover:text-white"
                          title="Editar produto"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(product)}
                          className="rounded-lg bg-danger/10 p-2 text-danger transition-colors hover:bg-danger hover:text-white"
                          title="Excluir produto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-background px-4 py-3">
                        <span className="font-medium text-muted">
                          {isLiquid ? "Volume total" : "Quantidade"}
                        </span>
                        <p className="mt-1 font-bold text-foreground">
                          {isLiquid ? `${product.volumeMl} ml` : product.quantity}
                        </p>
                      </div>
                      <div className="rounded-lg bg-background px-4 py-3">
                        <span className="font-medium text-muted">Valor</span>
                        <p className="mt-1 font-bold text-foreground">
                          {formatCurrency(parseMoney(product.totalCost || "0"))}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="order-1 xl:order-2 xl:sticky xl:top-4 xl:self-start">
          {formOpen ? (
            <form
              key={formAnimationKey}
              onSubmit={handleSaveProduct}
              autoComplete="off"
              className={`rounded-lg border border-border bg-card shadow-card p-6 shadow-card ${
                formClosing ? "product-form-exit" : "product-form-enter"
              }`}
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {editingProduct ? "Editar produto" : "Novo produto"}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Cadastre o catálogo geral usado nos serviços.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-background hover:text-foreground"
                  aria-label="Fechar formulário"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="rounded-lg border border-border bg-background shadow-card p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card shadow-card bg-cover bg-center text-muted"
                      style={
                        form.photoUrl
                          ? { backgroundImage: `url(${form.photoUrl})` }
                          : undefined
                      }
                    >
                      {!form.photoUrl && <Camera className="h-6 w-6" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        Foto do produto
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Opcional. Use uma imagem para identificar o produto.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-xs font-semibold text-success transition-colors hover:bg-success hover:text-white">
                          <Camera className="h-3.5 w-3.5" />
                          {form.photoUrl ? "Trocar foto" : "Adicionar foto"}
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={handleProductPhotoChange}
                          />
                        </label>
                        {form.photoUrl && (
                          <button
                            type="button"
                            onClick={() => updateForm({ photoUrl: "" })}
                            className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger transition-colors hover:bg-danger hover:text-white"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Input
                  label="Nome do produto"
                  value={form.name}
                  autoComplete="off"
                  onChange={(event) => updateForm({ name: event.target.value })}
                  placeholder="Shampoo automotivo"
                />
                <Dropdown
                  label="Tipo"
                  value={form.type}
                  options={typeOptions}
                  onChange={(type) => {
                    updateForm({ type: type as ProductType });
                    setTypeError(null);
                  }}
                  actionLabel="Adicionar"
                  createPlaceholder="Ex: Cera, Equipamento, Químico"
                  onCreateOption={handleAddType}
                  onDeleteOption={handleDeleteType}
                />
                {typeError && (
                  <p className="text-xs font-medium text-danger">{typeError}</p>
                )}

                <Dropdown
                  label="Fornecedor"
                  value={form.supplierId}
                  options={supplierOptions}
                  onChange={(supplierId) => updateForm({ supplierId })}
                  disabled={!suppliersLoaded}
                />

                {form.type === "liquid" ? (
                  <Input
                    label="Volume total (ml)"
                    type="number"
                    min="0"
                    step="1"
                    value={form.volumeMl}
                    onChange={(event) =>
                      updateForm({ volumeMl: event.target.value })
                    }
                    placeholder="5000"
                  />
                ) : (
                  <Input
                    label="Quantidade"
                    type="number"
                    min="0"
                    step="1"
                    value={form.quantity}
                    onChange={(event) =>
                      updateForm({ quantity: event.target.value })
                    }
                    placeholder="3"
                  />
                )}

                <Input
                  label="Custo total do produto"
                  value={form.totalCost}
                  autoComplete="off"
                  onChange={(event) =>
                    updateForm({ totalCost: event.target.value })
                  }
                  placeholder="80,00"
                />
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={closeForm}>
                  Cancelar
                </Button>
                <Button type="submit" variant="success">
                  Salvar produto
                </Button>
              </div>
            </form>
          ) : products.length > 0 ? (
            <div className="flex h-[calc(100vh-2rem)] min-h-[28rem] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card p-5 shadow-card">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">
                    Estoque
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">
                    Produtos disponíveis
                  </h2>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                  <Package className="h-5 w-5" />
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-lg bg-background px-4 py-3">
                  <p className="text-xs font-semibold text-muted">
                    Total investido
                  </p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {formatCurrency(totalInvested)}
                  </p>
                </div>
                <div className="rounded-lg bg-background px-4 py-3">
                  <p className="text-xs font-semibold text-muted">
                    Produtos no estoque
                  </p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {stockProducts.length}
                  </p>
                </div>
              </div>

              <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
                {stockProducts.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted">
                    Nenhum produto líquido no estoque.
                  </p>
                ) : stockProducts.map((product) => {
                  const initialStock = getProductInitialStock(product);
                  const remainingStock = getProductRemainingStock(product);
                  const stockPercent = getProductStockPercent(product);
                  const usageSummary = getProductUsageSummary(product);
                  const progressWidth = Math.max(
                    0,
                    Math.min(100, stockPercent)
                  );
                  const stockUnit = getProductStockUnit(product);
                  const criticalStock = stockPercent < 20;
                  const warningStock = stockPercent >= 20 && stockPercent <= 50;
                  const priceHistory = product.priceHistory ?? [];
                  const progressClass = criticalStock
                    ? "bg-danger"
                    : warningStock
                      ? "bg-warning"
                      : "bg-success";

                  return (
                    <div
                      key={product.id}
                      className={`rounded-lg border p-4 transition-colors ${
                        criticalStock
                          ? "border-danger/25 bg-danger/5"
                          : "border-border bg-background"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {product.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {editingStockProductId === product.id
                              ? `${formatStockAmount(Number(stockEditValue) || 0)} ${stockUnit} / ${formatStockAmount(initialStock)} ${stockUnit}`
                              : `${formatStockAmount(remainingStock)} ${stockUnit} / ${formatStockAmount(initialStock)} ${stockUnit}`}
                          </p>
                          <button
                            type="button"
                            onClick={() => openStockEdit(product)}
                            className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar estoque
                          </button>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {criticalStock && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-1 text-[10px] font-bold text-danger">
                              <AlertTriangle className="h-3 w-3" />
                              Repor estoque
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openReplenish(product.id)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success hover:text-white"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Repor
                          </button>
                        </div>
                      </div>

                      {editingStockProductId === product.id ? (
                        <div className="mt-3">
                          <input
                            type="range"
                            min="0"
                            max={initialStock}
                            step={product.type === "liquid" ? "1" : "0.01"}
                            value={stockEditValue}
                            onChange={(event) => {
                              setStockEditValue(event.target.value);
                            }}
                            onMouseUp={(event) => {
                              updateCurrentStock(product, event.currentTarget.value);
                              closeStockEdit();
                            }}
                            onTouchEnd={(event) => {
                              updateCurrentStock(product, event.currentTarget.value);
                              closeStockEdit();
                            }}
                            onBlur={(event) => {
                              updateCurrentStock(product, event.currentTarget.value);
                              closeStockEdit();
                            }}
                            className="stock-range-slider w-full"
                            style={{
                              background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${
                                initialStock > 0
                                  ? Math.max(
                                      0,
                                      Math.min(
                                        100,
                                        ((Number(stockEditValue) || 0) /
                                          initialStock) *
                                          100
                                      )
                                    )
                                  : 0
                              }%, #e2e8f0 ${
                                initialStock > 0
                                  ? Math.max(
                                      0,
                                      Math.min(
                                        100,
                                        ((Number(stockEditValue) || 0) /
                                          initialStock) *
                                          100
                                      )
                                    )
                                  : 0
                              }%, #e2e8f0 100%)`,
                            }}
                            aria-label={`Ajustar estoque atual de ${product.name}`}
                          />
                        </div>
                      ) : (
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                          <div
                            className={`h-full rounded-full transition-all ${progressClass}`}
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>
                      )}

                      {usageSummary.serviceCount > 0 ? (
                        <div className="mt-3 rounded-lg bg-card px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                            Autonomia
                          </p>
                          <p className="mt-0.5 text-sm font-bold text-foreground">
                            {usageSummary.estimatedUses ?? 0} usos
                          </p>
                        </div>
                      ) : null}

                      {priceHistory.length > 0 && (
                        <div className="mt-3 rounded-lg border border-border bg-card shadow-card px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                            Histórico de preços
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {priceHistory.slice(0, 3).map((entry) => (
                              <div
                                key={entry.id}
                                className="flex items-center justify-between gap-3 text-xs"
                              >
                                <span className="min-w-0 truncate font-semibold text-foreground">
                                  {priceHistoryReasonLabels[entry.reason]}
                                  {formatPriceHistoryDate(entry.date)
                                    ? ` • ${formatPriceHistoryDate(entry.date)}`
                                    : ""}
                                </span>
                                <span className="shrink-0 font-bold text-muted">
                                  {formatCurrency(parseMoney(entry.price || "0"))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {replenishingProductId === product.id && (
                        <div className="mt-3 rounded-lg border border-border bg-card shadow-card p-3">
                          <p className="mb-3 rounded-lg bg-background px-3 py-2 text-xs font-semibold text-muted">
                            Produto:{" "}
                            <span className="text-foreground">
                              {product.name}
                            </span>
                          </p>
                          <div className="grid grid-cols-1 gap-3">
                            <Dropdown
                              label="Fornecedor"
                              value={replenishForm.supplierId}
                              options={supplierOptions}
                              onChange={(supplierId) => {
                                setReplenishForm((prev) => ({ ...prev, supplierId }));
                                setReplenishError(null);
                              }}
                            />
                            <Input
                              label={`Quantidade reposta (${stockUnit})`}
                              type="number"
                              min="0"
                              step={product.type === "liquid" ? "1" : "0.01"}
                              className="number-input-no-spinner"
                              value={replenishForm.amount}
                              onChange={(event) => {
                                setReplenishForm((prev) => ({
                                  ...prev,
                                  amount: event.target.value,
                                }));
                                setReplenishError(null);
                              }}
                              placeholder={product.type === "liquid" ? "500" : "1"}
                            />
                            <Input
                              label="Valor pago na reposição"
                              prefix="R$"
                              value={replenishForm.paidAmount}
                              autoComplete="off"
                              onChange={(event) => {
                                setReplenishForm((prev) => ({
                                  ...prev,
                                  paidAmount: event.target.value,
                                }));
                                setReplenishError(null);
                              }}
                              placeholder="120,00"
                            />
                            <Input
                              label="Data da compra"
                              type="date"
                              value={replenishForm.purchaseDate}
                              onChange={(event) => {
                                setReplenishForm((prev) => ({
                                  ...prev,
                                  purchaseDate: event.target.value,
                                }));
                                setReplenishError(null);
                              }}
                            />
                          </div>
                          {replenishError && (
                            <p className="mt-2 text-xs font-medium text-danger">
                              {replenishError}
                            </p>
                          )}
                          <div className="mt-3 flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={closeReplenish}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              variant="success"
                              onClick={() => handleReplenishProduct(product)}
                            >
                              Salvar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
        </div>
      )}

      {activeProductTab === "suppliers" && (
      <section key="suppliers-tab" className="product-tab-panel-enter space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Fornecedores</h2>
            <p className="mt-1 text-sm text-muted">
              Cadastre fornecedores para vincular produtos e reposições de estoque.
            </p>
          </div>
          <Button
            type="button"
            variant="success"
            onClick={openSupplierForm}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Adicionar fornecedor
          </Button>
        </div>

        {supplierError && (
          <p className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            {supplierError}
          </p>
        )}

        <div className="space-y-5">
          {supplierFormOpen && (
          <form
            onSubmit={handleSaveSupplier}
            autoComplete="off"
            className="rounded-lg border border-border bg-card shadow-card p-5 shadow-card"
          >
            <h3 className="text-sm font-semibold text-foreground">
              {editingSupplierId ? "Editar fornecedor" : "Novo fornecedor"}
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Nome da empresa"
                value={supplierForm.name}
                onChange={(event) => updateSupplierForm({ name: event.target.value })}
                placeholder="Distribuidora Auto Clean"
              />
              <Input
                label="Nome do contato (opcional)"
                value={supplierForm.contactName}
                onChange={(event) =>
                  updateSupplierForm({ contactName: event.target.value })
                }
                placeholder="Carlos Souza"
              />
              <Input
                label="Telefone (opcional)"
                value={supplierForm.phone}
                onChange={(event) => updateSupplierForm({ phone: event.target.value })}
                placeholder="(51) 99999-9999"
              />
              <Input
                label="WhatsApp (opcional)"
                value={supplierForm.whatsapp}
                onChange={(event) => updateSupplierForm({ whatsapp: event.target.value })}
                placeholder="(51) 99999-9999"
              />
              <Input
                label="E-mail (opcional)"
                type="email"
                value={supplierForm.email}
                onChange={(event) => updateSupplierForm({ email: event.target.value })}
                placeholder="contato@fornecedor.com"
              />
              <Input
                label="CNPJ (opcional)"
                value={supplierForm.document}
                onChange={(event) => updateSupplierForm({ document: event.target.value })}
                placeholder="00.000.000/0001-00"
              />
              <Input
                label="Cidade/UF (opcional)"
                value={supplierForm.cityState}
                onChange={(event) => updateSupplierForm({ cityState: event.target.value })}
                placeholder="Caxias do Sul/RS"
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-foreground">
                  Observações <span className="text-muted">(opcional)</span>
                </label>
                <textarea
                  value={supplierForm.notes}
                  onChange={(event) => updateSupplierForm({ notes: event.target.value })}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-border bg-input px-4 py-3 text-base text-foreground placeholder:text-muted/60 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:py-2.5 sm:text-sm"
                  placeholder="Condições de pagamento, entrega, contato..."
                />
              </div>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {editingSupplierId && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetSupplierForm}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                variant="success"
                loading={savingSupplier}
                className="w-full sm:w-auto"
                disabled={!suppliersLoaded}
              >
                <Plus className="h-4 w-4" />
                {editingSupplierId ? "Salvar alterações" : "Cadastrar fornecedor"}
              </Button>
            </div>
          </form>
          )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
              {suppliers.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm font-semibold text-muted">
                  Nenhum fornecedor cadastrado
                </p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <div className="min-w-[720px]">
                    <div className="grid grid-cols-[minmax(260px,1fr)_190px_96px] gap-4 border-b border-border px-3 py-3 text-xs font-semibold text-muted">
                      <span>Nome</span>
                      <span>Telefone/WhatsApp</span>
                      <span className="text-right">Ações</span>
                    </div>
                    {suppliers.map((supplier) => (
                      <article
                        key={supplier.id}
                        onClick={() => setSelectedSupplierId(supplier.id)}
                        className={`grid cursor-pointer grid-cols-[minmax(260px,1fr)_190px_96px] items-center gap-4 border-b border-border/70 px-3 py-3 transition-colors hover:bg-background/70 ${
                          selectedSupplierId === supplier.id ? "bg-background/80" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {supplier.name}
                          </p>
                          {getSupplierExtra(supplier, "contactName") && (
                            <p className="mt-1 truncate text-xs text-muted">
                              {getSupplierExtra(supplier, "contactName")}
                            </p>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {supplier.phone
                            ? formatPhone(supplier.phone)
                            : getSupplierExtra(supplier, "whatsapp")
                              ? formatPhone(getSupplierExtra(supplier, "whatsapp"))
                              : "-"}
                        </p>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              startEditingSupplier(supplier);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-success transition-colors hover:bg-success/10"
                            aria-label={`Editar ${supplier.name}`}
                            title="Editar fornecedor"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteSupplier(supplier);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger/10"
                            aria-label={`Excluir ${supplier.name}`}
                            title="Excluir fornecedor"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              <aside className="rounded-lg border border-border bg-card shadow-card p-5 shadow-card xl:sticky xl:top-4">
                {selectedSupplier ? (
                  <div>
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted">
                          Fornecedor
                        </p>
                        <h3 className="mt-1 text-xl font-bold text-foreground">
                          {selectedSupplier.name}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEditingSupplier(selectedSupplier)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-success transition-colors hover:bg-success/10"
                        aria-label={`Editar ${selectedSupplier.name}`}
                        title="Editar fornecedor"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-3 text-sm">
                      <SupplierDetail label="Contato" value={getSupplierExtra(selectedSupplier, "contactName")} />
                      <SupplierDetail
                        label="Telefone"
                        value={
                          selectedSupplier.phone
                            ? formatPhone(selectedSupplier.phone)
                            : ""
                        }
                      />
                      <SupplierDetail
                        label="WhatsApp"
                        value={
                          getSupplierExtra(selectedSupplier, "whatsapp")
                            ? formatPhone(getSupplierExtra(selectedSupplier, "whatsapp"))
                            : ""
                        }
                        href={getSupplierWhatsAppUrl(getSupplierExtra(selectedSupplier, "whatsapp"))}
                        icon={<MessageCircle className="h-4 w-4" />}
                      />
                      <SupplierDetail
                        label="E-mail"
                        value={getSupplierExtra(selectedSupplier, "email")}
                        href={
                          getSupplierExtra(selectedSupplier, "email")
                            ? `mailto:${getSupplierExtra(selectedSupplier, "email")}`
                            : ""
                        }
                        icon={<Mail className="h-4 w-4" />}
                      />
                      <SupplierDetail label="CNPJ" value={getSupplierExtra(selectedSupplier, "document")} />
                      <SupplierDetail label="Cidade/UF" value={getSupplierExtra(selectedSupplier, "cityState")} />
                      <SupplierDetail label="Observações" value={selectedSupplier.notes ?? ""} />
                    </div>
                  </div>
                ) : (
                  <p className="py-12 text-center text-sm font-semibold text-muted">
                    Selecione um fornecedor para ver os detalhes
                  </p>
                )}
              </aside>
            </div>
        </div>
      </section>
      )}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .product-form-enter {
            animation: product-form-enter 220ms ease-out both;
            transform-origin: top center;
          }

          .product-form-exit {
            animation: product-form-exit ${PRODUCT_FORM_EXIT_MS}ms ease-in both;
            transform-origin: top center;
            pointer-events: none;
          }

          .product-tab-panel-enter {
            animation: product-tab-panel-enter 180ms ease-out both;
          }

          .product-filter-panel-enter {
            animation: product-filter-panel-enter 180ms ease-out both;
          }
        }

        .stock-range-slider {
          appearance: none;
          height: 0.5rem;
          border-radius: 9999px;
          outline: none;
        }

        .stock-range-slider::-webkit-slider-thumb {
          appearance: none;
          height: 1.15rem;
          width: 1.15rem;
          border-radius: 9999px;
          border: 3px solid #ffffff;
          background: var(--primary);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
          cursor: pointer;
        }

        .stock-range-slider::-moz-range-thumb {
          height: 1.15rem;
          width: 1.15rem;
          border-radius: 9999px;
          border: 3px solid #ffffff;
          background: var(--primary);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
          cursor: pointer;
        }

        .number-input-no-spinner::-webkit-outer-spin-button,
        .number-input-no-spinner::-webkit-inner-spin-button {
          appearance: none;
          margin: 0;
        }

        .number-input-no-spinner {
          appearance: textfield;
          -moz-appearance: textfield;
        }

        @media (hover: hover) and (prefers-reduced-motion: no-preference) {
          .product-photo-preview-popover {
            animation: product-photo-preview-popover 180ms ease-out 1s both;
          }
        }

        @media (hover: hover) and (prefers-reduced-motion: reduce) {
          .product-photo-preview:hover .product-photo-preview-popover {
            display: block;
            opacity: 1;
          }
        }

        @keyframes product-form-enter {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes product-form-exit {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }
        }

        @keyframes product-tab-panel-enter {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes product-filter-panel-enter {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes product-photo-preview-popover {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}
