import { DEFAULT_PREFS, THEMES } from "@his/ui/theme";
import { PanelApp } from "@/components/panel-app";
import { listCustomers } from "@/lib/server/customers";
import { readProducts } from "@/lib/server/products";
import { findRepoRoot } from "@/lib/server/repo";
import { getRunner } from "@/lib/server/runner";

// reads customers/ and packages/ on every request
// Dynamic Renderingwith each request, so the panel always shows the latest state of the repo. The showcase app itself is static, so it can be cached and deployed to a CDN.
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ customer?: string | string[] }> }) {
  const root = findRepoRoot();

  // read the customers and products from the repo, and the current status of the showcase runner
  const customers = listCustomers(root);
  // read the products from the repo, and the current status of the showcase runner
  const status = await getRunner().status();
  const { customer } = await searchParams;

  // select the customer to show and compose for, in this order of preference:
  // 1. the customer in the URL query string (if it exists and is valid)
  // 2. the customer the showcase runner is currently serving (if any)
  // 3. the customer the showcase runner was last composed for (if any)
  // 4. the first customer in the list (if any)
  // 5. null (no customers exist)
  const selectedId =
    customers.find((c) => c.id === customer)?.id ??
    status.server?.customerId ??
    status.composed?.customerId ??
    customers[0]?.id ??
    null;

  return (
    <PanelApp
      customers={customers}
      catalog={readProducts(root)}
      initialStatus={status}
      selectedId={selectedId}
      palettes={{ themes: [...THEMES], fallback: DEFAULT_PREFS.theme }}
    />
  );
}
