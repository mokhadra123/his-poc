import type { Overview } from "@his/licence/api";
import { readPrefs } from "@his/ui/theme";
import { ServerCrash } from "lucide-react";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { EmptyState, Page } from "@/components/bits";
import { ConsoleSidebar } from "@/components/console-sidebar";
import { API_URL, ApiUnreachable, currentUser, get } from "@/lib/api";

// every page reads live data from the licence server
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const prefs = readPrefs((name) => store.get(name)?.value);
  let data: [Awaited<ReturnType<typeof currentUser>>, Overview];
  try {
    data = await Promise.all([currentUser(), get<Overview>("/api/overview")]);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiUnreachable) return <Unreachable />;
    throw error;
  }
  const [user, overview] = data;
  const urgent = overview.attention.filter((a) => a.kind !== "unlicensed" && a.kind !== "silent").length;

  return (
    <div className="flex h-dvh overflow-hidden print:block print:h-auto print:overflow-visible">
      <ConsoleSidebar user={user} initialNav={prefs.nav} attention={urgent} />
      {/* only <main> scrolls; scroll padding keeps a focused control clear of the
          sticky top bar and the sticky action bar */}
      <main className="relative min-w-0 flex-1 scroll-pt-[calc(var(--topbar-h)+8px)] scroll-pb-24 overflow-y-auto print:overflow-visible">
        {children}
      </main>
    </div>
  );
}

function Unreachable() {
  return (
    <Page narrow>
      <EmptyState icon={ServerCrash} title="The licence server is not running">
        Nothing answers at <code className="font-mono">{API_URL}</code>. Start it in a terminal with{" "}
        <code className="font-mono">npm run dev -w @his/licence-server</code>, then reload this page.
      </EmptyState>
    </Page>
  );
}
