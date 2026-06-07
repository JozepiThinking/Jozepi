"use client";

import { useEffect, useState } from "react";
import { Droplets, Package, Pencil, Plus, Trash2, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/format";
import {
  createProductId,
  emptyProductForm,
  getProductTypeLabel,
  parseMoney,
  parsePositiveNumber,
  productTypeOptions,
  PRODUCTS_STORAGE_KEY,
  type ProductForm,
  type ProductItem,
  type ProductType,
} from "@/lib/products/catalog";

export function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProductForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const storedProducts = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (storedProducts) {
        try {
          setProducts(JSON.parse(storedProducts) as ProductItem[]);
        } catch {
          window.localStorage.removeItem(PRODUCTS_STORAGE_KEY);
        }
      }

      setProductsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!productsLoaded) return;
    window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  }, [products, productsLoaded]);

  function openCreateForm() {
    setEditingProduct(null);
    setForm(emptyProductForm);
    setError(null);
    setFormOpen(true);
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
    });
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingProduct(null);
    setForm(emptyProductForm);
    setError(null);
    setFormOpen(false);
  }

  function updateForm(patch: Partial<ProductForm>) {
    setForm((prev) => ({ ...prev, ...patch }));
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

      {formOpen && (
        <form
          onSubmit={handleSaveProduct}
          autoComplete="off"
          className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm"
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              options={productTypeOptions}
              onChange={(type) => updateForm({ type: type as ProductType })}
            />

            {form.type === "liquid" ? (
                <Input
                  label="Volume total (ml)"
                  type="number"
                  min="0"
                  step="1"
                  value={form.volumeMl}
                  onChange={(event) => updateForm({ volumeMl: event.target.value })}
                  placeholder="5000"
                />
            ) : (
                <Input
                  label="Quantidade"
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantity}
                  onChange={(event) => updateForm({ quantity: event.target.value })}
                  placeholder="3"
                />
            )}

            <Input
              label="Custo total do produto"
              value={form.totalCost}
              autoComplete="off"
              onChange={(event) => updateForm({ totalCost: event.target.value })}
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
      )}

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {products.map((product) => {
            const isLiquid = product.type === "liquid";

            return (
              <article
                key={product.id}
                className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                      {isLiquid ? (
                        <Droplets className="h-5 w-5" />
                      ) : (
                        <Wrench className="h-5 w-5" />
                      )}
                    </span>
                    <div>
                      <h2 className="font-semibold text-foreground">
                        {product.name}
                      </h2>
                      <p className="text-xs font-medium text-muted">
                        {getProductTypeLabel(product.type)}
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
                    <span className="font-medium text-muted">
                      Custo total
                    </span>
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
    </>
  );
}
