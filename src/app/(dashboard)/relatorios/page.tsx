import { Header } from "@/components/layout/header";
import { ReportsPage } from "@/components/reports/reports-page";

export default function RelatoriosPage() {
  return (
    <>
      <Header
        title="Relatórios"
        description="Receitas, despesas, serviços prestados e desempenho por cliente"
      />
      <ReportsPage />
    </>
  );
}
