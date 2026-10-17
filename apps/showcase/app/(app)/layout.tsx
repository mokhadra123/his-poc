import { readPrefs } from "@his/ui/theme";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getDict, getLang } from "@/lib/i18n";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const prefs = readPrefs((name) => store.get(name)?.value);
  const t = await getDict();
  const lang = await getLang();

  return (
    <>
      <AppSidebar t={t.shell} lang={lang} initialNav={prefs.nav} />
      {/* relative: the containing block for sr-only content;
          scroll-pt-topbar / scroll-pb-24: a focused control never hides under
          the sticky topbar or the sticky ActionBar */}
      <main className="relative min-w-0 flex-1 scroll-pt-[calc(var(--topbar-h)+8px)] scroll-pb-24 overflow-y-auto print:overflow-visible">
        {children}
      </main>
    </>
  );
}
