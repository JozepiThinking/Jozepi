"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  Pencil,
  Plus,
  Power,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/format";
import {
  calculateProductUsageCost,
  createProductId,
  createProductTypeId,
  createUsageId,
  emptyProductForm,
  getProductAmountLabel,
  getProductTypeLabel,
  parsePositiveNumber,
  PRODUCT_TYPES_STORAGE_KEY,
  productTypeOptions,
  PRODUCTS_STORAGE_KEY,
  SERVICE_PRODUCT_USAGE_STORAGE_KEY,
  type ProductForm,
  type ProductItem,
  type ProductType,
  type ProductTypeOption,
  type ServiceProductUsage,
} from "@/lib/products/catalog";

interface ServiceItem {
  id: string;
  workshop_id: string;
  name: string;
  description: string | null;
  price: number | string;
  duration_minutes: number | null;
  active: boolean;
}

interface ServiceForm {
  name: string;
  category: string;
  description: string;
  price: string;
  durationMinutes: string;
  productUsages: ServiceProductUsage[];
}

const emptyForm: ServiceForm = {
  name: "",
  category: "Outros",
  description: "",
  price: "",
  durationMinutes: "60",
  productUsages: [],
};

const durationOptions = Array.from({ length: 16 }, (_, index) => {
  const minutes = 30 + index * 30;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return {
    value: String(minutes),
    label:
      hours === 0
        ? "30 min"
        : remainingMinutes === 0
          ? `${hours}h`
          : `${hours}h30`,
  };
});

const SERVICE_FORM_EXIT_MS = 180;
const SERVICE_CATEGORIES_STORAGE_KEY = "auto-estetica-service-categories";
const SERVICE_CATEGORY_OPTIONS_STORAGE_KEY =
  "auto-estetica-service-category-options";

type ServiceStatusFilter = "all" | "active" | "inactive";

interface ServiceCategoryOption {
  value: string;
  label: string;
  custom?: boolean;
}

const defaultServiceCategoryOptions: ServiceCategoryOption[] = [
  { value: "Lavagem", label: "Lavagem" },
  { value: "Polimento", label: "Polimento" },
  { value: "Higienização", label: "Higienização" },
  { value: "Detalhamento", label: "Detalhamento" },
  { value: "Outros", label: "Outros" },
];

const statusFilterOptions = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
];

function parsePrice(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const price = Number(normalized);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Informe um preço válido.");
  }

  return price;
}

function parseDuration(value: string) {
  const duration = Number(value);

  if (!Number.isInteger(duration) || duration <= 0) {
    throw new Error("Informe uma duração válida.");
  }

  return duration;
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "0h";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h${String(remainingMinutes).padStart(2, "0")}`;
}

export function ServicesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [typeOptions, setTypeOptions] =
    useState<ProductTypeOption[]>(productTypeOptions);
  const [typeOptionsLoaded, setTypeOptionsLoaded] = useState(false);
  const [serviceProductUsages, setServiceProductUsages] = useState<
    Record<string, ServiceProductUsage[]>
  >({});
  const [serviceProductUsagesLoaded, setServiceProductUsagesLoaded] =
    useState(false);
  const [serviceCategories, setServiceCategories] = useState<Record<string, string>>(
    {}
  );
  const [serviceCategoriesLoaded, setServiceCategoriesLoaded] = useState(false);
  const [serviceCategoryOptions, setServiceCategoryOptions] = useState<
    ServiceCategoryOption[]
  >(defaultServiceCategoryOptions);
  const [serviceCategoryOptionsLoaded, setServiceCategoryOptionsLoaded] =
    useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("all");
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formClosing, setFormClosing] = useState(false);
  const [formAnimationKey, setFormAnimationKey] = useState(0);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productForm, setProductForm] =
    useState<ProductForm>(emptyProductForm);
  const [addingProduct, setAddingProduct] = useState(false);
  const [productTypeError, setProductTypeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const closeFormTimeoutRef = useRef<number | null>(null);

  function clearCloseFormTimeout() {
    if (closeFormTimeoutRef.current) {
      window.clearTimeout(closeFormTimeoutRef.current);
      closeFormTimeoutRef.current = null;
    }
  }

  async function loadServices() {
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("workshop_id")
      .single();

    if (!profile?.workshop_id) {
      setLoading(false);
      return;
    }

    setWorkshopId(profile.workshop_id);

    const { data, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .eq("workshop_id", profile.workshop_id)
      .order("active", { ascending: false })
      .order("name", { ascending: true });

    if (servicesError) {
      setError(servicesError.message);
    } else {
      setServices((data as ServiceItem[]) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    void Promise.resolve().then(loadServices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const storedProducts = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
      const storedTypes = window.localStorage.getItem(PRODUCT_TYPES_STORAGE_KEY);
      const storedUsages = window.localStorage.getItem(
        SERVICE_PRODUCT_USAGE_STORAGE_KEY
      );
      const storedServiceCategories = window.localStorage.getItem(
        SERVICE_CATEGORIES_STORAGE_KEY
      );
      const storedServiceCategoryOptions = window.localStorage.getItem(
        SERVICE_CATEGORY_OPTIONS_STORAGE_KEY
      );

      if (storedProducts) {
        try {
          setProducts(JSON.parse(storedProducts) as ProductItem[]);
        } catch {
          window.localStorage.removeItem(PRODUCTS_STORAGE_KEY);
        }
      }
      setProductsLoaded(true);

      if (storedTypes) {
        try {
          const customTypes = JSON.parse(storedTypes) as ProductTypeOption[];
          setTypeOptions([...productTypeOptions, ...customTypes]);
        } catch {
          window.localStorage.removeItem(PRODUCT_TYPES_STORAGE_KEY);
        }
      }
      setTypeOptionsLoaded(true);

      if (storedUsages) {
        try {
          setServiceProductUsages(
            JSON.parse(storedUsages) as Record<string, ServiceProductUsage[]>
          );
        } catch {
          window.localStorage.removeItem(SERVICE_PRODUCT_USAGE_STORAGE_KEY);
        }
      }
      setServiceProductUsagesLoaded(true);

      if (storedServiceCategories) {
        try {
          setServiceCategories(
            JSON.parse(storedServiceCategories) as Record<string, string>
          );
        } catch {
          window.localStorage.removeItem(SERVICE_CATEGORIES_STORAGE_KEY);
        }
      }
      setServiceCategoriesLoaded(true);

      if (storedServiceCategoryOptions) {
        try {
          const customCategories = JSON.parse(
            storedServiceCategoryOptions
          ) as ServiceCategoryOption[];
          setServiceCategoryOptions([
            ...defaultServiceCategoryOptions,
            ...customCategories,
          ]);
        } catch {
          window.localStorage.removeItem(SERVICE_CATEGORY_OPTIONS_STORAGE_KEY);
        }
      }
      setServiceCategoryOptionsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!productsLoaded) return;
    window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  }, [products, productsLoaded]);

  useEffect(() => {
    if (!serviceProductUsagesLoaded) return;
    window.localStorage.setItem(
      SERVICE_PRODUCT_USAGE_STORAGE_KEY,
      JSON.stringify(serviceProductUsages)
    );
  }, [serviceProductUsages, serviceProductUsagesLoaded]);

  useEffect(() => {
    if (!typeOptionsLoaded) return;

    const customTypes = typeOptions.filter((option) => option.custom);
    window.localStorage.setItem(
      PRODUCT_TYPES_STORAGE_KEY,
      JSON.stringify(customTypes)
    );
  }, [typeOptions, typeOptionsLoaded]);

  useEffect(() => {
    if (!serviceCategoriesLoaded) return;

    window.localStorage.setItem(
      SERVICE_CATEGORIES_STORAGE_KEY,
      JSON.stringify(serviceCategories)
    );
  }, [serviceCategories, serviceCategoriesLoaded]);

  useEffect(() => {
    if (!serviceCategoryOptionsLoaded) return;

    const customCategories = serviceCategoryOptions.filter(
      (option) => option.custom
    );
    window.localStorage.setItem(
      SERVICE_CATEGORY_OPTIONS_STORAGE_KEY,
      JSON.stringify(customCategories)
    );
  }, [serviceCategoryOptions, serviceCategoryOptionsLoaded]);

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
    setEditingService(null);
    setForm(emptyForm);
    setError(null);
    setCategoryError(null);
    setAddingProduct(false);
    setProductFormOpen(false);
    showForm();
  }

  function openEditForm(service: ServiceItem) {
    setEditingService(service);
    setForm({
      name: service.name,
      category: serviceCategories[service.id] ?? "Outros",
      description: service.description ?? "",
      price: String(service.price ?? ""),
      durationMinutes: String(service.duration_minutes ?? 60),
      productUsages: serviceProductUsages[service.id] ?? [],
    });
    setError(null);
    setCategoryError(null);
    setAddingProduct(false);
    setProductFormOpen(false);
    showForm();
  }

  function closeForm() {
    if (!formOpen) return;

    clearCloseFormTimeout();
    setFormClosing(true);

    closeFormTimeoutRef.current = window.setTimeout(() => {
      setEditingService(null);
      setForm(emptyForm);
      setError(null);
      setCategoryError(null);
      setAddingProduct(false);
      setProductFormOpen(false);
      setFormOpen(false);
      setFormClosing(false);
      closeFormTimeoutRef.current = null;
    }, SERVICE_FORM_EXIT_MS);
  }

  async function handleSaveService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workshopId) {
      setError("Oficina não encontrada.");
      return;
    }

    if (!form.name.trim()) {
      setError("Informe o nome do serviço.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const productUsages = form.productUsages.filter((usage) => {
        const product = products.find((item) => item.id === usage.productId);
        return product && calculateProductUsageCost(product, usage.amount) > 0;
      });
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parsePrice(form.price || "0"),
        duration_minutes: parseDuration(form.durationMinutes),
      };
      let savedServiceId = editingService?.id;

      if (editingService) {
        const { error: updateError } = await supabase
          .from("services")
          .update(payload)
          .eq("id", editingService.id);

        if (updateError) throw updateError;
      } else {
        const { data: insertedService, error: insertError } = await supabase
          .from("services")
          .insert({
            ...payload,
            workshop_id: workshopId,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        savedServiceId = insertedService.id;
      }

      if (savedServiceId) {
        setServiceProductUsages((prev) => ({
          ...prev,
          [savedServiceId]: productUsages,
        }));
        setServiceCategories((prev) => ({
          ...prev,
          [savedServiceId]: form.category,
        }));
      }

      await loadServices();
      closeForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar o serviço."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(service: ServiceItem) {
    const { error: updateError } = await supabase
      .from("services")
      .update({ active: !service.active })
      .eq("id", service.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await loadServices();
  }

  async function handleDeleteService(service: ServiceItem) {
    const confirmed = window.confirm(
      `Deseja excluir o serviço ${service.name}?`
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("services")
      .delete()
      .eq("id", service.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setServiceProductUsages((prev) => {
      const next = { ...prev };
      delete next[service.id];
      return next;
    });
    setServiceCategories((prev) => {
      const next = { ...prev };
      delete next[service.id];
      return next;
    });
    await loadServices();
  }

  function closeProductForm() {
    setProductForm(emptyProductForm);
    setProductError(null);
    setProductTypeError(null);
    setProductFormOpen(false);
  }

  function updateProductForm(patch: Partial<ProductForm>) {
    setProductForm((prev) => ({ ...prev, ...patch }));
  }

  function getTypeLabel(type: ProductType) {
    return (
      typeOptions.find((option) => option.value === type)?.label ??
      getProductTypeLabel(type)
    );
  }

  function handleAddServiceCategory(label: string) {
    const alreadyExists = serviceCategoryOptions.some(
      (option) => option.label.toLowerCase() === label.toLowerCase()
    );

    if (alreadyExists) {
      return "Essa categoria já existe.";
    }

    const nextCategory: ServiceCategoryOption = {
      value: label,
      label,
      custom: true,
    };

    setServiceCategoryOptions((prev) => [...prev, nextCategory]);
    setForm((prev) => ({ ...prev, category: nextCategory.value }));
    setCategoryError(null);
  }

  function handleDeleteServiceCategory(category: string) {
    const option = serviceCategoryOptions.find((item) => item.value === category);
    if (!option?.custom) return;

    const categoryInUse =
      Object.values(serviceCategories).includes(category) ||
      form.category === category;

    if (categoryInUse) {
      setCategoryError("Não é possível apagar uma categoria em uso.");
      return;
    }

    setServiceCategoryOptions((prev) =>
      prev.filter((item) => item.value !== category)
    );
    setCategoryError(null);
  }

  function handleAddProductType(label: string) {
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
    updateProductForm({ type: nextType.value });
    setProductTypeError(null);
  }

  function handleDeleteProductType(type: string) {
    const option = typeOptions.find((item) => item.value === type);
    if (!option?.custom) return;

    const typeInUse = products.some((product) => product.type === type);
    if (typeInUse) {
      setProductTypeError(
        "Não é possível apagar um tipo usado em produtos cadastrados."
      );
      return;
    }

    setTypeOptions((prev) => prev.filter((item) => item.value !== type));
    if (productForm.type === type) {
      updateProductForm({ type: "liquid" });
    }
    setProductTypeError(null);
  }

  function handleSaveProduct() {
    setProductError(null);

    if (!productForm.name.trim()) {
      setProductError("Informe o nome do produto.");
      return;
    }

    try {
      parsePrice(productForm.totalCost || "0");

      if (productForm.type === "liquid") {
        parsePositiveNumber(productForm.volumeMl);
      } else {
        parsePositiveNumber(productForm.quantity);
      }
    } catch (err) {
      setProductError(
        err instanceof Error ? err.message : "Informe os dados do produto."
      );
      return;
    }

    const nextProduct: ProductItem = {
      id: createProductId(),
      name: productForm.name.trim(),
      type: productForm.type,
      volumeMl: productForm.type === "liquid" ? productForm.volumeMl : "",
      usagePerWashMl: "",
      quantity: productForm.type === "utensil" ? productForm.quantity : "",
      durabilityWashes: "",
      totalCost: productForm.totalCost,
    };

    setProducts((prev) => [nextProduct, ...prev]);
    setForm((prev) => ({
      ...prev,
      productUsages: [
        ...prev.productUsages,
        {
          id: createUsageId(),
          productId: nextProduct.id,
          amount: nextProduct.type === "liquid" ? "" : "1",
        },
      ],
    }));
    setAddingProduct(false);

    closeProductForm();
  }

  function addProductToService(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    setForm((prev) => {
      if (prev.productUsages.some((usage) => usage.productId === productId)) {
        return prev;
      }

      return {
        ...prev,
        productUsages: [
          ...prev.productUsages,
          {
            id: createUsageId(),
            productId,
            amount: product.type === "liquid" ? "" : "1",
          },
        ],
      };
    });
    setAddingProduct(false);
  }

  function updateProductUsageAmount(usageId: string, amount: string) {
    setForm((prev) => ({
      ...prev,
      productUsages: prev.productUsages.map((usage) =>
        usage.id === usageId ? { ...usage, amount } : usage
      ),
    }));
  }

  function removeProductUsage(usageId: string) {
    setForm((prev) => ({
      ...prev,
      productUsages: prev.productUsages.filter((usage) => usage.id !== usageId),
    }));
  }

  const availableProducts = products.filter(
    (product) =>
      !form.productUsages.some((usage) => usage.productId === product.id)
  );
  const productOptions = availableProducts.map((product) => ({
    value: product.id,
    label: product.name,
  }));
  const serviceProductsTotal = form.productUsages.reduce((total, usage) => {
    const product = products.find((item) => item.id === usage.productId);
    return product ? total + calculateProductUsageCost(product, usage.amount) : total;
  }, 0);
  const categoryFilterOptions = [
    { value: "all", label: "Todas" },
    ...serviceCategoryOptions,
  ];

  function getServiceCategory(serviceId: string) {
    return serviceCategories[serviceId] ?? "Outros";
  }

  function getServiceFinancials(serviceId: string, price: number | string) {
    const usages = serviceProductUsages[serviceId] ?? [];
    const cost = usages.reduce((total, usage) => {
      const product = products.find((item) => item.id === usage.productId);
      return product ? total + calculateProductUsageCost(product, usage.amount) : total;
    }, 0);
    const hasCost = usages.some((usage) => {
      const product = products.find((item) => item.id === usage.productId);
      return product ? calculateProductUsageCost(product, usage.amount) > 0 : false;
    });

    return {
      cost,
      hasCost,
      profit: Number(price) - cost,
    };
  }

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredServices = services.filter((service) => {
    const category = getServiceCategory(service.id);
    const matchesSearch =
      !normalizedSearchTerm ||
      service.name.toLowerCase().includes(normalizedSearchTerm);
    const matchesCategory =
      categoryFilter === "all" || category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && service.active) ||
      (statusFilter === "inactive" && !service.active);

    return matchesSearch && matchesCategory && matchesStatus;
  });
  const servicesByCategory = filteredServices.reduce<Record<string, ServiceItem[]>>(
    (acc, service) => {
      const category = getServiceCategory(service.id);
      acc[category] = [...(acc[category] ?? []), service];
      return acc;
    },
    {}
  );
  const orderedCategories = Array.from(
    new Set([
      ...serviceCategoryOptions.map((option) => option.value),
      ...Object.keys(servicesByCategory),
    ])
  ).filter((category) => servicesByCategory[category]?.length > 0);

  return (
    <>
      <div className="mb-5 flex justify-stretch sm:mb-6 sm:justify-end">
        <Button variant="success" onClick={openCreateForm} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Novo serviço
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          key={formAnimationKey}
          onSubmit={handleSaveService}
          autoComplete="off"
          className={`mb-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6 ${
            formClosing ? "service-form-exit" : "service-form-enter"
          }`}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {editingService ? "Editar serviço" : "Novo serviço"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Cadastre os serviços que poderão ser usados na agenda.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground sm:min-h-0 sm:min-w-0 sm:p-2"
              aria-label="Fechar formulário"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Nome do serviço"
              value={form.name}
              autoComplete="off"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Lavagem completa"
            />
            <Dropdown
              label="Categoria"
              value={form.category}
              options={serviceCategoryOptions}
              onChange={(category) => {
                setForm((prev) => ({ ...prev, category }));
                setCategoryError(null);
              }}
              actionLabel="Adicionar"
              createPlaceholder="Ex: Martelinho, Proteção, Inspeção"
              onCreateOption={handleAddServiceCategory}
              onDeleteOption={handleDeleteServiceCategory}
            />
            {categoryError && (
              <p className="text-xs font-medium text-danger">{categoryError}</p>
            )}
            <Input
              label="Preço base"
              prefix="R$"
              value={form.price}
              autoComplete="off"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, price: event.target.value }))
              }
              placeholder="150,00"
            />
            <Dropdown
              id="service-duration"
              label="Duração em horas"
              value={form.durationMinutes}
              options={durationOptions}
              onChange={(durationMinutes) =>
                setForm((prev) => ({
                  ...prev,
                  durationMinutes,
                }))
              }
            />
            <Input
              label="Descrição"
              value={form.description}
              autoComplete="off"
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Detalhes do serviço"
            />
          </div>

          <div className="mt-5 rounded-xl border border-border bg-background p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Produtos utilizados neste serviço
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Escolha produtos do catálogo e informe quanto será usado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddingProduct(true)}
                disabled={availableProducts.length === 0}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-success/10 px-3 py-2 text-sm font-semibold text-success transition-all hover:bg-success hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:justify-start sm:py-1.5 sm:text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar produto
              </button>
            </div>

            {addingProduct && (
              <div className="mt-4">
                <Dropdown
                  label="Selecionar produto"
                  value=""
                  placeholder={
                    availableProducts.length === 0
                      ? "Todos os produtos já foram adicionados"
                      : "Selecione um produto"
                  }
                  options={productOptions}
                  onChange={addProductToService}
                  disabled={availableProducts.length === 0}
                />
              </div>
            )}

            {products.length === 0 && (
              <p className="mt-4 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-center text-xs text-muted">
                Nenhum produto cadastrado no catálogo.
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setProductForm(emptyProductForm);
                setProductError(null);
                setProductTypeError(null);
                setProductFormOpen(true);
              }}
              className="mt-3 min-h-11 text-sm font-semibold text-success transition-colors hover:text-success/80 sm:min-h-0 sm:text-xs"
            >
              Cadastrar novo produto
            </button>

            {productError && (
              <div className="mt-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                {productError}
              </div>
            )}

            {productFormOpen && (
              <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    Produto rápido
                  </h4>
                  <button
                    type="button"
                    onClick={closeProductForm}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-background hover:text-foreground"
                    aria-label="Fechar produto rápido"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input
                    label="Nome do produto"
                    value={productForm.name}
                    autoComplete="off"
                    onChange={(event) =>
                      updateProductForm({ name: event.target.value })
                    }
                    placeholder="Shampoo automotivo"
                  />
                  <Dropdown
                    label="Tipo"
                    value={productForm.type}
                    options={typeOptions}
                    onChange={(type) => {
                      updateProductForm({ type: type as ProductType });
                      setProductTypeError(null);
                    }}
                    actionLabel="Adicionar"
                    createPlaceholder="Ex: Cera, Equipamento, Químico"
                    onCreateOption={handleAddProductType}
                    onDeleteOption={handleDeleteProductType}
                  />

                  {productTypeError && (
                    <p className="text-xs font-medium text-danger">
                      {productTypeError}
                    </p>
                  )}

                  {productForm.type === "liquid" ? (
                    <Input
                      label="Volume total (ml)"
                      type="number"
                      min="0"
                      step="1"
                      value={productForm.volumeMl}
                      onChange={(event) =>
                        updateProductForm({ volumeMl: event.target.value })
                      }
                      placeholder="5000"
                    />
                  ) : (
                    <Input
                      label="Quantidade"
                      type="number"
                      min="0"
                      step="1"
                      value={productForm.quantity}
                      onChange={(event) =>
                        updateProductForm({ quantity: event.target.value })
                      }
                      placeholder="3"
                    />
                  )}

                  <Input
                    label="Custo total do produto"
                    value={productForm.totalCost}
                    autoComplete="off"
                    onChange={(event) =>
                      updateProductForm({ totalCost: event.target.value })
                    }
                    placeholder="80,00"
                  />
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={closeProductForm}
                    className="w-full sm:w-auto"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="success"
                    onClick={handleSaveProduct}
                    className="w-full sm:w-auto"
                  >
                    Salvar e adicionar
                  </Button>
                </div>
              </div>
            )}

            {form.productUsages.length > 0 && (
              <div className="mt-4 space-y-3">
                {form.productUsages.map((usage) => {
                  const product = products.find(
                    (item) => item.id === usage.productId
                  );
                  if (!product) return null;

                  const usageCost = calculateProductUsageCost(
                    product,
                    usage.amount
                  );

                  return (
                    <div
                      key={usage.id}
                      className="rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                  <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {product.name}
                          </p>
                          <p className="text-xs text-muted">
                            {getTypeLabel(product.type)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeProductUsage(usage.id)}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-danger/10 p-2 text-danger transition-colors hover:bg-danger hover:text-white sm:min-h-0 sm:min-w-0"
                          aria-label={`Remover ${product.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                        <Input
                          label={getProductAmountLabel(product.type)}
                          type="number"
                          min="0"
                          step={product.type === "liquid" ? "1" : "0.01"}
                          value={usage.amount}
                          onChange={(event) =>
                            updateProductUsageAmount(
                              usage.id,
                              event.target.value
                            )
                          }
                          placeholder={product.type === "liquid" ? "50" : "1"}
                        />
                        <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-success">
                            Custo
                          </p>
                          <p className="text-base font-bold text-success">
                            {formatCurrency(usageCost)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-medium text-muted">
                    Custo total de produtos
                  </span>
                  <span className="text-base font-bold text-foreground">
                    {formatCurrency(serviceProductsTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={closeForm}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="success"
              loading={saving}
              className="w-full sm:w-auto"
            >
              Salvar serviço
            </Button>
          </div>
        </form>
      )}

      <div className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,1fr)_190px_150px_160px] md:items-end">
          <Input
            label="Buscar serviço"
            value={searchTerm}
            autoComplete="off"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Digite o nome do serviço"
          />
          <Dropdown
            label="Categoria"
            value={categoryFilter}
            options={categoryFilterOptions}
            onChange={setCategoryFilter}
          />
          <Dropdown
            label="Status"
            value={statusFilter}
            options={statusFilterOptions}
            onChange={(status) => setStatusFilter(status as ServiceStatusFilter)}
          />
          <div className="rounded-xl bg-background px-4 py-3 text-base font-semibold text-foreground sm:text-sm">
            {filteredServices.length} serviço
            {filteredServices.length !== 1 ? "s" : ""} encontrado
            {filteredServices.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted shadow-sm">
          Carregando serviços...
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <Wrench className="h-7 w-7 text-success" />
          </div>
          <p className="font-medium text-foreground">
            Nenhum serviço cadastrado
          </p>
          <p className="mt-1 text-sm text-muted">
            Crie sua lista para usar os serviços na agenda.
          </p>
          <Button
            variant="success"
            className="mt-4 w-full sm:w-auto"
            onClick={openCreateForm}
          >
            <Plus className="h-4 w-4" />
            Novo serviço
          </Button>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-14 text-center shadow-sm">
          <p className="font-medium text-foreground">
            Nenhum serviço encontrado
          </p>
          <p className="mt-1 text-sm text-muted">
            Ajuste a busca ou os filtros para ver outros resultados.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {orderedCategories.map((category) => (
            <section
              key={category}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:px-5">
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
                  {category}
                </h2>
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                  {servicesByCategory[category].length} serviço
                  {servicesByCategory[category].length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="hidden grid-cols-[minmax(180px,1fr)_88px_96px_96px_96px_120px] gap-3 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted md:grid">
                <span>Serviço</span>
                <span>Duração</span>
                <span>Preço</span>
                <span>Custo</span>
                <span>Lucro</span>
                <span className="text-right">Ações</span>
              </div>

              <div className="space-y-3 p-3 md:space-y-0 md:divide-y md:divide-border md:p-0">
                {servicesByCategory[category].map((service) => {
                  const financials = getServiceFinancials(
                    service.id,
                    service.price
                  );
                  const profitPositive = financials.profit >= 0;

                  return (
                    <article
                      key={service.id}
                      className={`grid grid-cols-1 gap-4 rounded-2xl border border-border bg-background/50 px-4 py-4 shadow-sm transition-colors hover:bg-background/70 md:rounded-none md:border-0 md:bg-transparent md:px-5 md:shadow-none md:grid-cols-[minmax(180px,1fr)_88px_96px_96px_96px_120px] md:items-center md:gap-3 ${
                        service.active ? "" : "opacity-70"
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-foreground md:text-sm">
                            {service.name}
                          </h3>
                          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                            {getServiceCategory(service.id)}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              service.active
                                ? "bg-success/10 text-success"
                                : "bg-muted/10 text-muted"
                            }`}
                          >
                            {service.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        {service.description && (
                          <p className="mt-1 text-sm text-muted">
                            {service.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 text-sm font-semibold md:block md:bg-transparent md:p-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-muted md:hidden">
                          Duração
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-muted">
                          <Clock className="h-4 w-4" />
                          {formatDuration(service.duration_minutes)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 text-sm font-semibold text-foreground md:block md:bg-transparent md:p-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-muted md:hidden">
                          Preço
                        </span>
                        <span>{formatCurrency(Number(service.price))}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 text-sm font-semibold text-foreground md:block md:bg-transparent md:p-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-muted md:hidden">
                          Custo
                        </span>
                        <span>
                          {financials.hasCost
                            ? formatCurrency(financials.cost)
                            : "—"}
                        </span>
                      </div>
                      <div
                        className={`flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 text-sm font-bold md:block md:bg-transparent md:p-0 ${
                          profitPositive ? "text-success" : "text-danger"
                        }`}
                      >
                        <span className="text-xs font-bold uppercase tracking-wide text-muted md:hidden">
                          Lucro
                        </span>
                        <span>{formatCurrency(financials.profit)}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 md:flex md:items-center md:justify-end">
                        <button
                          type="button"
                          onClick={() => openEditForm(service)}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-success/10 p-2 text-success transition-colors hover:bg-success hover:text-white md:min-h-0 md:min-w-0"
                          title="Editar serviço"
                          aria-label="Editar serviço"
                        >
                          <Pencil className="h-5 w-5 md:h-4 md:w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(service)}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-card p-2 text-muted transition-colors hover:text-foreground md:min-h-0 md:min-w-0 md:bg-background"
                          title={service.active ? "Desativar" : "Ativar"}
                          aria-label={service.active ? "Desativar serviço" : "Ativar serviço"}
                        >
                          <Power className="h-5 w-5 md:h-4 md:w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteService(service)}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-danger/10 p-2 text-danger transition-colors hover:bg-danger hover:text-white md:min-h-0 md:min-w-0"
                          title="Excluir serviço"
                          aria-label="Excluir serviço"
                        >
                          <Trash2 className="h-5 w-5 md:h-4 md:w-4" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .service-form-enter {
            animation: service-form-enter 220ms ease-out both;
            transform-origin: top center;
          }

          .service-form-exit {
            animation: service-form-exit ${SERVICE_FORM_EXIT_MS}ms ease-in both;
            pointer-events: none;
            transform-origin: top center;
          }
        }

        @keyframes service-form-enter {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes service-form-exit {
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
