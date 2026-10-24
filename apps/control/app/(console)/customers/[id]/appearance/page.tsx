import { can, currentUser } from "@/lib/api";
import { loadCustomer } from "@/lib/load";
import { ThemeEditor } from "./theme-editor";

export default async function CustomerAppearance({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, customer] = await Promise.all([currentUser(), loadCustomer(id)]);
  return <ThemeEditor customerId={customer.id} theme={customer.theme} readOnly={!can(user, "issuer") || Boolean(customer.archivedAt)} />;
}
