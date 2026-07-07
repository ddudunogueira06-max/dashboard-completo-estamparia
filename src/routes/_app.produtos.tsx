import { createFileRoute } from "@tanstack/react-router";
import { ProductsDashboard } from "@/components/ProductsDashboard";

export const Route = createFileRoute("/_app/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Desempenho e Categorização" },
      { name: "description", content: "Categorize produtos por dificuldade, mescle nomes duplicados e analise produtividade." },
    ],
  }),
  component: ProductsDashboard,
});
