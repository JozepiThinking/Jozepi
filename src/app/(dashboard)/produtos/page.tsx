import { Header } from "@/components/layout/header";
import { ProductsPage } from "@/components/products/products-page";

export default function ProdutosPage() {
  return (
    <>
      <Header
        title="Produtos"
        description="Catálogo de produtos e utensílios usados nos serviços"
      />
      <ProductsPage />
    </>
  );
}
