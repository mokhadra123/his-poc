import { Topbar } from "@his/ui";
import { readPrefs } from "@his/ui/theme";
import { LogOut } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions";
import { ModeToggle } from "./client-bits";

/** The top band of every console page: where you are, and your session. */
export async function ConsoleTopbar({ crumbs = [], current }: { crumbs?: { href: string; label: string }[]; current: ReactNode }) {
  const store = await cookies();
  const mode = readPrefs((name) => store.get(name)?.value).mode;
  return (
    <Topbar
      crumbs={crumbs.map((c) => (
        <Link key={c.href} href={c.href} className="hover:text-chrome-ink hover:underline">
          {c.label}
        </Link>
      ))}
      current={current}
      end={
        <>
          <ModeToggle initial={mode} />
          <form action={signOut}>
            <button
              type="submit"
              className="flex h-(--chrome-icon-size) cursor-pointer items-center gap-1.5 rounded-(--chrome-icon-radius) border border-chrome-icon-line bg-chrome-icon px-2.5 text-sm text-chrome-icon-ink hover:text-chrome-ink [&_svg]:size-4"
            >
              <LogOut aria-hidden className="rtl:-scale-x-100" />
              <span className="whitespace-nowrap max-sm:sr-only">Sign out</span>
            </button>
          </form>
        </>
      }
    />
  );
}
