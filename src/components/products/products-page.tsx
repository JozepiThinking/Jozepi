"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Droplets,
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
import { formatCurrency } from "@/lib/utils/format";
import {
  createProductId,
  createProductTypeId,
  emptyProductForm,
  formatStockAmount,
  getProductInitialStock,
  getProductRemainingStock,
  getProductStockPercent,
  getProductStockUnit,
  getProductTypeLabel,
  normalizeProductStock,
  parseMoney,
  parsePositiveNumber,
  PRODUCT_TYPES_STORAGE_KEY,
  productTypeOptions,
  PRODUCTS_STORAGE_KEY,
  SERVICE_PRODUCT_USAGE_STORAGE_KEY,
  type ProductForm,
  type ProductItem,
  type ServiceProductUsage,
  type ProductType,
  type ProductTypeOption,
} from "@/lib/products/catalog";

const PRODUCT_FORM_EXIT_MS = 180;

type ProductTypeFilter = "all" | "liquid" | "utensil";

const productTypeFilterOptions = [
  { value: "all", label: "Todos" },
  { value: "liquid", label: "Líquidos" },
  { value: "utensil", label: "Utensílios" },
];

const PRODUCT_PHOTO_MAX_SIZE = 480;
const PRODUCT_PHOTO_QUALITY = 0.72;
const PRODUCT_PHOTO_COMPACT_THRESHOLD = 180_000;

function isQuotaExceededError(err: unknown) {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.code === 22)
  );
}

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

    image.src = objectUrl ?? source;
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

export function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [typeOptions, setTypeOptions] =
    useState<ProductTypeOption[]>(productTypeOptions);
  const [typeOptionsLoaded, setTypeOptionsLoaded] = useState(false);
  const [serviceProductUsages, setServiceProductUsages] = useState<
    Record<string, ServiceProductUsage[]>
  >({});
  const [typeError, setTypeError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ProductTypeFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [formClosing, setFormClosing] = useState(false);
  const [formAnimationKey, setFormAnimationKey] = useState(0);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProductForm);
  const [error, setError] = useState<string | null>(null);
  const [replenishingProductId, setReplenishingProductId] = useState<string | null>(
    null
  );
  const [replenishAmount, setReplenishAmount] = useState("");
  const [replenishError, setReplenishError] = useState<string | null>(null);
  const [editingStockProductId, setEditingStockProductId] = useState<string | null>(
    null
  );
  const [stockEditValue, setStockEditValue] = useState("");
  const closeFormTimeoutRef = useRef<number | null>(null);

  function clearCloseFormTimeout() {
    if (closeFormTimeoutRef.current) {
      window.clearTimeout(closeFormTimeoutRef.current);
      closeFormTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    void Promise.resolve().then(async () => {
      const storedProducts = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
      const storedTypes = window.localStorage.getItem(PRODUCT_TYPES_STORAGE_KEY);
      const storedServiceProductUsages = window.localStorage.getItem(
        SERVICE_PRODUCT_USAGE_STORAGE_KEY
      );
      if (storedProducts) {
        try {
          const parsedProducts = JSON.parse(storedProducts) as ProductItem[];
          const normalizedProducts = parsedProducts.map(normalizeProductStock);
          setProducts(await Promise.all(normalizedProducts.map(compactProductPhoto)));
        } catch {
          window.localStorage.removeItem(PRODUCTS_STORAGE_KEY);
        }
      }

      if (storedTypes) {
        try {
          const customTypes = JSON.parse(storedTypes) as ProductTypeOption[];
          setTypeOptions([...productTypeOptions, ...customTypes]);
        } catch {
          window.localStorage.removeItem(PRODUCT_TYPES_STORAGE_KEY);
        }
      }

      if (storedServiceProductUsages) {
        try {
          setServiceProductUsages(
            JSON.parse(storedServiceProductUsages) as Record<
              string,
              ServiceProductUsage[]
            >
          );
        } catch {
          window.localStorage.removeItem(SERVICE_PRODUCT_USAGE_STORAGE_KEY);
        }
      }

      setProductsLoaded(true);
      setTypeOptionsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!productsLoaded) return;
    try {
      window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    } catch (err) {
      if (isQuotaExceededError(err)) {
        window.setTimeout(() => {
          setError(
            "O armazenamento do navegador ficou cheio. Remova fotos grandes de produtos ou use imagens menores."
          );
        }, 0);
        return;
      }

      throw err;
    }
  }, [products, productsLoaded]);

  useEffect(() => {
    if (!typeOptionsLoaded) return;

    const customTypes = typeOptions.filter((option) => option.custom);
    window.localStorage.setItem(
      PRODUCT_TYPES_STORAGE_KEY,
      JSON.stringify(customTypes)
    );
  }, [typeOptions, typeOptionsLoaded]);

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
    setReplenishAmount("");
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
    });
    setError(null);
    setTypeError(null);
    setReplenishingProductId(null);
    setReplenishAmount("");
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

  function handleSaveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      validateProductForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Informe os dados do produto.");
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
    };
    const initialStock = getProductInitialStock(baseProduct);
    const preservedRemaining =
      editingProduct && editingProduct.type === baseProduct.type
        ? getProductRemainingStock(editingProduct)
        : initialStock;
    const nextProduct: ProductItem = {
      ...baseProduct,
      stockRemaining: String(Math.min(initialStock, preservedRemaining)),
    };

    setProducts((prev) =>
      editingProduct
        ? prev.map((product) =>
            product.id === editingProduct.id ? nextProduct : product
          )
        : [nextProduct, ...prev]
    );
    closeForm();
  }

  function handleDeleteProduct(product: ProductItem) {
    const confirmed = window.confirm(`Deseja excluir ${product.name}?`);
    if (!confirmed) return;

    setProducts((prev) => prev.filter((item) => item.id !== product.id));

    if (editingProduct?.id === product.id) {
      closeForm();
    }
  }

  function openReplenish(productId: string) {
    setReplenishingProductId(productId);
    setReplenishAmount("");
    setReplenishError(null);
    setEditingStockProductId(null);
    setStockEditValue("");
  }

  function closeReplenish() {
    setReplenishingProductId(null);
    setReplenishAmount("");
    setReplenishError(null);
  }

  function handleReplenishProduct(product: ProductItem) {
    setReplenishError(null);

    let addedAmount: number;
    try {
      addedAmount = parsePositiveNumber(replenishAmount);
    } catch {
      setReplenishError("Informe uma quantidade válida para repor.");
      return;
    }

    const initialStock = getProductInitialStock(product);
    const currentStock = getProductRemainingStock(product);
    const nextStock = Math.min(initialStock, currentStock + addedAmount);

    setProducts((prev) =>
      prev.map((item) =>
        item.id === product.id
          ? { ...item, stockRemaining: String(nextStock) }
          : item
      )
    );
    closeReplenish();
  }

  function openStockEdit(product: ProductItem) {
    setEditingStockProductId(product.id);
    setStockEditValue(String(getProductRemainingStock(product)));
    setReplenishingProductId(null);
    setReplenishAmount("");
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

    setProducts((prev) =>
      prev.map((item) =>
        item.id === product.id
          ? { ...item, stockRemaining: String(nextStock) }
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

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-[minmax(220px,280px)_auto] sm:items-end">
          <Dropdown
            label="Filtrar por tipo"
            value={typeFilter}
            options={productTypeFilterOptions}
            onChange={(value) => setTypeFilter(value as ProductTypeFilter)}
          />
          <div className="rounded-xl bg-background px-4 py-3 text-base font-semibold text-foreground sm:text-sm">
            {filteredProducts.length} produto
            {filteredProducts.length !== 1 ? "s" : ""} encontrado
            {filteredProducts.length !== 1 ? "s" : ""}
          </div>
        </div>

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

      {error && (
        <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] xl:items-start">
        <section className="order-2 xl:order-1">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center shadow-sm">
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
            <div className="rounded-xl border border-dashed border-border bg-card py-14 text-center shadow-sm">
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
                    className="relative z-0 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:z-50 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {product.photoUrl ? (
                          <span className="product-photo-preview group/photo relative h-10 w-10 shrink-0 cursor-zoom-in overflow-visible rounded-xl border border-border bg-card shadow-sm transition-all duration-300 hover:border-success/40 hover:shadow-md hover:ring-2 hover:ring-success/15">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={product.photoUrl}
                              alt={`Foto de ${product.name}`}
                              className="h-full w-full rounded-xl object-cover transition duration-300 group-hover/photo:scale-105 group-hover/photo:brightness-110"
                            />
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/0 text-white opacity-0 transition-all duration-300 group-hover/photo:bg-slate-950/25 group-hover/photo:opacity-100">
                              <ZoomIn className="h-4 w-4 drop-shadow-sm" />
                            </span>
                            <span className="pointer-events-none absolute left-0 top-12 z-[999] hidden h-44 w-44 overflow-hidden rounded-2xl border border-border bg-card p-1 opacity-0 shadow-2xl ring-1 ring-slate-900/5 group-hover/photo:block product-photo-preview-popover">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={product.photoUrl}
                                alt={`Prévia ampliada de ${product.name}`}
                                className="h-full w-full rounded-xl object-cover"
                              />
                            </span>
                          </span>
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
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
                      <div className="rounded-xl bg-background px-4 py-3">
                        <span className="font-medium text-muted">
                          {isLiquid ? "Volume total" : "Quantidade"}
                        </span>
                        <p className="mt-1 font-bold text-foreground">
                          {isLiquid ? `${product.volumeMl} ml` : product.quantity}
                        </p>
                      </div>
                      <div className="rounded-xl bg-background px-4 py-3">
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

        <aside className="order-1 xl:order-2 xl:sticky xl:top-8">
          {formOpen ? (
            <form
              key={formAnimationKey}
              onSubmit={handleSaveProduct}
              autoComplete="off"
              className={`rounded-xl border border-border bg-card p-6 shadow-sm ${
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
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card bg-cover bg-center text-muted"
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
            <div className="flex h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Estoque
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">
                    Produtos disponíveis
                  </h2>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                  <Package className="h-5 w-5" />
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-xl bg-background px-4 py-3">
                  <p className="text-xs font-semibold text-muted">
                    Total investido
                  </p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {formatCurrency(totalInvested)}
                  </p>
                </div>
                <div className="rounded-xl bg-background px-4 py-3">
                  <p className="text-xs font-semibold text-muted">
                    Produtos no estoque
                  </p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {stockProducts.length}
                  </p>
                </div>
              </div>

              <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {stockProducts.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted">
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
                  const progressClass = criticalStock
                    ? "bg-danger"
                    : warningStock
                      ? "bg-warning"
                      : "bg-success";

                  return (
                    <div
                      key={product.id}
                      className={`rounded-xl border p-4 transition-colors ${
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
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full transition-all ${progressClass}`}
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>
                      )}

                      {usageSummary.serviceCount > 0 ? (
                        <div className="mt-3 rounded-xl bg-card px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                            Autonomia
                          </p>
                          <p className="mt-0.5 text-sm font-bold text-foreground">
                            {usageSummary.estimatedUses ?? 0} usos
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 rounded-xl border border-dashed border-border bg-card px-3 py-2 text-xs text-muted">
                          Ainda não vinculado a serviços.
                        </p>
                      )}

                      {replenishingProductId === product.id && (
                        <div className="mt-3 rounded-xl border border-border bg-card p-3">
                          <Input
                            label={`Adicionar ao estoque (${stockUnit})`}
                            type="number"
                            min="0"
                            step={product.type === "liquid" ? "1" : "0.01"}
                            value={replenishAmount}
                            onChange={(event) => {
                              setReplenishAmount(event.target.value);
                              setReplenishError(null);
                            }}
                            placeholder={product.type === "liquid" ? "500" : "1"}
                          />
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
