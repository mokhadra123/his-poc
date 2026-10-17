import { SearchField, Signal, Status, Topbar, TopbarIconButton } from "@his/ui";
import { Bell, Search } from "lucide-react";
import type { ReactNode } from "react";
import { type Mark, pick } from "@/lib/data";
import { type Dict, dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

export function PageTopbar({
  crumbs,
  current,
  t,
}: {
  crumbs: string[];
  current: string;
  t: Dict["shell"];
}) {
  return (
    <Topbar
      crumbs={crumbs}
      current={current}
      end={
        <>
          <SearchField
            tone="chrome"
            label={t.search}
            placeholder={t.search}
            className="w-72 shrink max-lg:w-52 max-sm:hidden"
          />
          {/* below sm the field becomes a button; in HIS it would open search in a sheet */}
          <TopbarIconButton aria-label={t.search} className="sm:hidden">
            <Search aria-hidden />
          </TopbarIconButton>
          <TopbarIconButton aria-label={t.notifications} dotLabel={t.unread}>
            <Bell aria-hidden />
          </TopbarIconButton>
        </>
      }
    />
  );
}

/** clinical marks become <Signal>, operational ones <Status> — never the other way */
export function MarkChip({ mark, lang }: { mark: Mark; lang: Lang }) {
  return mark.kind === "signal" ? (
    <Signal tone={mark.tone} toneLabel={dict[lang].tones[mark.tone]}>
      {pick(mark.label, lang)}
    </Signal>
  ) : (
    <Status state={mark.state}>{pick(mark.label, lang)}</Status>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="max-w-[1560px] px-gutter pt-page-y pb-14">{children}</div>;
}
