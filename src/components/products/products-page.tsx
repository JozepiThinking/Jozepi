"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Droplets,
  Package,
  Pencil,
  Plus,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/format";
import {
  createProductId,
  createProductTypeId,
  emptyProductForm,
  getProductTypeLabel,
  parseMoney,
  parsePositiveNumber,
  PRODUCT_TYPES_STORAGE_KEY,
  productTypeOptions,
  PRODUCTS_STORAGE_KEY,
  type ProductForm,
  type ProductItem,
  type ProductType,
  type ProductTypeOption,
} from "@/lib/products/catalog";

const PRODUCT_FORM_EXIT_MS = 180;

export function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [typeOptions, setTypeOptions] =
    useState<ProductTypeOption[]>(productTypeOptions);
  const [typeOptionsLoaded, setTypeOptionsLoaded] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formClosing, setFormClosing] = useState(false);
  const [formAnimationKey, setFormAnimationKey] = useState(0);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProductForm);
  const [error, setError] = useState<string | null>(null);
  const closeFormTimeoutRef = useRef<number | null>(null);

  function clearCloseFormTimeout() {
    if (closeFormTimeoutRef.current) {
      window.clearTimeout(closeFormTimeoutRef.current);
      closeFormTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      const storedProducts = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
      const storedTypes = window.localStorage.getItem(PRODUCT_TYPES_STORAGE_KEY);
      if (storedProducts) {
        try {
          setProducts(JSON.parse(storedProducts) as ProductItem[]);
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

      setProductsLoaded(true);
      setTypeOptionsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!productsLoaded) return;
    window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
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

  function handleProductPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecione uma imagem válida para a foto do produto.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateForm({ photoUrl: typeof reader.result === "string" ? reader.result : "" });
      setError(null);
    };
    reader.readAsDataURL(file);
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

    const nextProduct: ProductItem = {
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

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button variant="success" onClick={openCreateForm}>
          <Plus className="h-4 w-4" />
          Adicionar produto
        </Button>
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
                Novo produto
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => {
                const isLiquid = product.type === "liquid";

                return (
                  <article
                    key={product.id}
                    className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {product.photoUrl ? (
                          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={product.photoUrl}
                              alt={`Foto de ${product.name}`}
                              className="h-full w-full object-cover"
                            />
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
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-foreground">
                Novo cadastro
              </p>
              <p className="mt-1 text-sm text-muted">
                Clique em adicionar para cadastrar um produto.
              </p>
              <Button variant="success" className="mt-4" onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Adicionar produto
              </Button>
            </div>
          )}
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
      `}</style>
    </>
  );
}
