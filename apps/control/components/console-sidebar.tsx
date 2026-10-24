"use client";

import { Avatar, sidebar } from "@his/ui";
import { type NavState, setPref } from "@his/ui/theme";
import { usePref } from "@his/ui/theme/client";
import {
  Building2,
  FileKey2,
  Hammer,
  History,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  Package,
  PanelLeft,
  Server,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ControlUser } from "@his/licence/api";
import { initials, ROLE_LABEL } from "@/lib/format";

type Item = { href: string; label: string; icon: LucideIcon; count?: number };

export function ConsoleSidebar({ user, initialNav, attention }: { user: ControlUser; initialNav: NavState; attention: number }) {
  const nav = usePref("nav", initialNav);
  const collapsed = nav === "collapsed";
  const pathname = usePathname();
  const s = sidebar();

  const groups: { label: string; items: Item[] }[] = [
    {
      label: "Licensing",
      items: [
        { href: "/", label: "Overview", icon: LayoutDashboard, count: attention || undefined },
        { href: "/customers", label: "Customers", icon: Building2 },
        { href: "/licences", label: "Licences", icon: FileKey2 },
        { href: "/installations", label: "Installations", icon: Server },
        { href: "/releases", label: "Releases", icon: Hammer },
      ],
    },
    { label: "Catalog", items: [{ href: "/catalog", label: "Products", icon: Package }] },
    {
      label: "Security",
      items: [
        { href: "/keys", label: "Signing keys", icon: KeyRound },
        { href: "/activity", label: "Activity log", icon: History },
      ],
    },
  ];
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <aside className={s.root()} aria-label="Control plane">
      <div className={s.head()}>
        <span className={s.mark()} aria-hidden>
          M
        </span>
        <div className="min-w-0">
          <div className={s.name()}>HIS Control</div>
          <div className={s.sub()}>Customers and licences</div>
        </div>
        <button
          type="button"
          onClick={() => setPref("nav", collapsed ? "expanded" : "collapsed")}
          aria-expanded={!collapsed}
          aria-controls="control-nav"
          aria-label="Navigation"
          className={s.toggle()}
        >
          <PanelLeft aria-hidden />
        </button>
      </div>

      <nav id="control-nav" aria-label="Main" className={s.body()}>
        {groups.map((group) => (
          <div key={group.label} className={s.group()}>
            <div className={s.section()}>{group.label}</div>
            {group.items.map(({ href, label, icon: Icon, count }) => (
              <Link key={href} href={href} title={label} aria-current={isCurrent(href) ? "page" : undefined} className={s.item()}>
                <Icon aria-hidden />
                <span className={s.label()}>{label}</span>
                {count ? (
                  <span className={s.count()}>
                    {count}
                    <span className="sr-only"> need attention</span>
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className={s.foot()}>
        <Avatar aria-hidden>{initials(user.name)}</Avatar>
        <div className={s.footText()}>
          <div className={s.footName()}>{user.name}</div>
          <div className={s.footRole()}>
            {ROLE_LABEL[user.role]} · {user.email}
          </div>
        </div>
      </div>
    </aside>
  );
}
