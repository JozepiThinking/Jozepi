import { Header } from "@/components/layout/header";
import { FinancePage } from "@/components/finance/finance-page";

export default function FinanceiroPage() {
  return (
    <>
      <Header
        title="Financeiro"
        description="Receitas, despesas e fluxo de caixa"
      />
      <FinancePage />
    </>
  );
}
