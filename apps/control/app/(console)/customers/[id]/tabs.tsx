"use client";

import { Tabs, tabs } from "@his/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* The customer's sub-pages: links with aria-current, as the design system's Tabs expect. */
export function CustomerTabs({ id, installations }: { id: string; installations: number }) {
  const pathname = usePathname();
  const base = `/customers/${id}`;
  const items = [
    { href: base, label: "Overview" },
    { href: `${base}/installations`, label: `Installations (${installations})` },
    { href: `${base}/licences`, label: "Licences" },
    { href: `${base}/appearance`, label: "Appearance" },
    { href: `${base}/activity`, label: "Activity" },
  ];
  return (
    <Tabs aria-label="Customer">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={tabs().tab()}>
          {item.label}
        </Link>
      ))}
    </Tabs>
  );
}
