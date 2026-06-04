import { Header } from "@/components/layout/header";
import { ServicesPage } from "@/components/services/services-page";

export default function ServicosPage() {
  return (
    <>
      <Header
        title="Serviços"
        description="Catálogo de serviços de estética automotiva"
      />
      <ServicesPage />
    </>
  );
}
