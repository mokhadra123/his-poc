"use client";

import { Avatar, sidebar } from "@his/ui";
import { type NavState, setPref } from "@his/ui/theme";
import { usePref } from "@his/ui/theme/client";
import {
  Activity,
  Building,
  CalendarDays,
  FileText,
  LayoutGrid,
  type LucideIcon,
  Palette,
  PanelLeft,
  Pill,
  ReceiptText,
  Shield,
  SlidersHorizontal,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import { CUSTOMER, PRODUCTS } from "@/lib/products.generated";

type SectionKey = keyof Dict["shell"]["sections"];
type Item = { href: string; icon: LucideIcon; label: keyof Dict["shell"]["nav"] | { en: string; ar: string }; count?: number };

/* the core every customer has; products add their own items below */
const CORE: { key: SectionKey; items: Item[] }[] = [
  {
    key: "care",
    items: [
      { href: "/dashboard", icon: LayoutGrid, label: "dashboard" },
      { href: "/visit", icon: Activity, label: "visits", count: 23 },
      { href: "#", icon: CalendarDays, label: "appointments" },
      { href: "/patients", icon: User, label: "patients" },
    ],
  },
  {
    key: "revenue",
    items: [{ href: "#", icon: Shield, label: "insurance", count: 37 }],
  },
  {
    key: "setup",
    items: [
      { href: "#", icon: Building, label: "facility" },
      { href: "#", icon: SlidersHorizontal, label: "settings" },
    ],
  },
  { key: "system", items: [{ href: "/", icon: Palette, label: "designSystem" }] },
];

const ICONS: Record<string, LucideIcon> = { receipt: ReceiptText, pill: Pill, report: FileText };

/* products the customer bought, and the customer's own pages, merged into their sections (scripts/compose.mjs) */
const SECTIONS = CORE.map((section) => ({
  ...section,
  items: [
    ...section.items,
    ...PRODUCTS.flatMap((p) =>
      p.nav
        .filter((n) => n.section === section.key)
        .map((n): Item => ({ href: n.href, icon: ICONS[n.icon] ?? Palette, label: n.label })),
    ),
  ],
})).filter((section) => section.items.length > 0);

export function AppSidebar({ t, lang, initialNav }: { t: Dict["shell"]; lang: Lang; initialNav: NavState }) {
  const nav = usePref("nav", initialNav);
  const pathname = usePathname();
  const s = sidebar();
  const collapsed = nav === "collapsed";

  return (
    <aside className={s.root()} aria-label={t.navigation}>
      <div className={s.head()}>
        <span className={s.mark()} aria-hidden>
          M
        </span>
        <div className="min-w-0">
          {/* the composed customer (scripts/compose.mjs), so the build in use is never in doubt */}
          <div className={s.name()}>{CUSTOMER.name[lang]}</div>
          <div className={s.sub()}>{t.branch}</div>
        </div>
        <button
          type="button"
          onClick={() => setPref("nav", collapsed ? "expanded" : "collapsed")}
          aria-expanded={!collapsed}
          aria-controls="app-nav"
          aria-label={t.navigation}
          className={s.toggle()}
        >
          <PanelLeft aria-hidden />
        </button>
      </div>

      <nav id="app-nav" aria-label={t.mainNav} className={s.body()}>
        {SECTIONS.map((section) => (
          <div key={section.key} className={s.group()}>
            <div className={s.section()}>{t.sections[section.key]}</div>
            {section.items.map(({ href, icon: Icon, label, count }) => {
              const text = typeof label === "string" ? t.nav[label] : label[lang];
              return (
              <Link
                key={href + text}
                href={href}
                title={text}
                aria-current={href !== "#" && pathname === href ? "page" : undefined}
                className={s.item()}
              >
                <Icon aria-hidden />
                <span className={s.label()}>{text}</span>
                {count ? <span className={s.count()}>{count}</span> : null}
              </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={s.foot()}>
        <Avatar aria-hidden>{t.initials}</Avatar>
        <div className={s.footText()}>
          <div className={s.footName()}>{t.user}</div>
          <div className={s.footRole()}>{t.role}</div>
        </div>
      </div>
    </aside>
  );
}
