import { readPrefs } from "@his/ui/theme";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { LicenceProvider } from "@/components/licence-client";
import { getDict, getLang } from "@/lib/i18n";
import { getLicence, isReadOnly, unlicensedProducts } from "@/lib/licence";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const prefs = readPrefs((name) => store.get(name)?.value);
  const t = await getDict();
  const lang = await getLang();
  // the installed licence: read-only disables record actions, unlicensed products leave the sidebar
  const licence = getLicence();

  return (
    <LicenceProvider readOnly={isReadOnly(licence)}>
      <AppSidebar t={t.shell} lang={lang} initialNav={prefs.nav} hiddenProducts={unlicensedProducts(licence)} />
      {/* relative: the containing block for sr-only content;
          scroll-pt-topbar / scroll-pb-24: a focused control never hides under
          the sticky topbar or the sticky ActionBar */}
      <main className="relative min-w-0 flex-1 scroll-pt-[calc(var(--topbar-h)+8px)] scroll-pb-24 overflow-y-auto print:overflow-visible">
        {children}
      </main>
    </LicenceProvider>
  );
}
