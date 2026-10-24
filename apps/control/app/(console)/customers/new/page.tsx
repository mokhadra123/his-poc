import { PageHeader } from "@his/ui";
import { redirect } from "next/navigation";
import { Page } from "@/components/bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { can, currentUser } from "@/lib/api";
import { CustomerForm } from "../customer-form";

export const metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const user = await currentUser();
  if (!can(user, "issuer")) redirect("/customers");
  return (
    <>
      <ConsoleTopbar crumbs={[{ href: "/customers", label: "Customers" }]} current="New customer" />
      <Page narrow>
        <PageHeader title="New customer" subtitle="The record we sell to. Installations and licences come next." />
        <CustomerForm />
      </Page>
    </>
  );
}
