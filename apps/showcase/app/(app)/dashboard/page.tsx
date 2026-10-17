import { Button, cn, ListRow, Meta, PageHeader, Panel, PanelBody, PanelHeader, Stat } from "@his/ui";
import { CalendarDays, Plus } from "lucide-react";
import { MarkChip, Page, PageTopbar } from "@/components/page-parts";
import { appointments, attention, pick, queue, revenue } from "@/lib/data";
import { getDict, getLang } from "@/lib/i18n";

export default async function DashboardPage() {
  const lang = await getLang();
  const t = await getDict();
  const d = t.dashboard;
  const peak = Math.max(...revenue);

  return (
    <>
      <PageTopbar crumbs={[t.shell.outpatient]} current={t.shell.nav.dashboard} t={t.shell} />
      <Page>
        <PageHeader
          title={d.greeting}
          subtitle={d.date}
          actions={
            <>
              <Button>
                <CalendarDays aria-hidden />
                {d.schedule}
              </Button>
              <Button tone="primary">
                <Plus aria-hidden />
                {d.register}
              </Button>
            </>
          }
        />

        <div className="mb-stack grid grid-cols-2 gap-stack md:grid-cols-3 xl:grid-cols-6 comfortable:xl:grid-cols-3 comfortable:2xl:grid-cols-6">
          <Stat label={d.stats.visits[0]} value="148" foot={d.stats.visits[1]} trend="up" />
          <Stat label={d.stats.waiting[0]} value="23" foot={d.stats.waiting[1]} />
          <Stat label={d.stats.admitted[0]} value="61" foot={d.stats.admitted[1]} />
          <Stat label={d.stats.collected[0]} value="84,320" unit={d.sar} foot={d.stats.collected[1]} />
          <Stat label={d.stats.claims[0]} value="37" foot={d.stats.claims[1]} />
          <Stat label={d.stats.stock[0]} value="6" foot={d.stats.stock[1]} trend="down" />
        </div>

        <div className="mb-stack grid items-start gap-stack lg:grid-cols-[3fr_2fr]">
          <Panel>
            <PanelHeader
              title={d.queue}
              meta={<Meta>{d.waitingCount}</Meta>}
              actions={<Button size="sm">{d.openQueue}</Button>}
            />
            <div>
              {queue.map((q) => (
                <ListRow
                  key={q.time}
                  lead={q.time}
                  title={pick(q.name, lang)}
                  meta={pick(q.meta, lang)}
                  end={q.marks.map((m) => (
                    <MarkChip key={m.label.en} mark={m} lang={lang} />
                  ))}
                />
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title={d.attention} />
            <div>
              {attention.map((a) => (
                <ListRow
                  key={a.title.en}
                  title={pick(a.title, lang)}
                  meta={pick(a.meta, lang)}
                  end={<MarkChip mark={a.mark} lang={lang} />}
                />
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid items-start gap-stack lg:grid-cols-2">
          <Panel>
            <PanelHeader title={d.appointments} actions={<Button size="sm">{d.viewAll}</Button>} />
            <div>
              {appointments.map((a) => (
                <ListRow
                  key={a.time}
                  lead={a.time}
                  title={pick(a.name, lang)}
                  meta={pick(a.meta, lang)}
                  end={<MarkChip mark={a.mark} lang={lang} />}
                />
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title={d.revenue} meta={<Meta>{d.revenueRange}</Meta>} />
            <PanelBody>
              {/* the bars are decoration; the list carries the numbers for assistive tech */}
              <ol className="sr-only" aria-label={`${d.revenue} — ${d.thousands}`}>
                {revenue.map((value, i) => (
                  <li key={d.days[i]}>
                    {d.days[i]}: {value.toFixed(1)}
                  </li>
                ))}
              </ol>
              <div aria-hidden className="flex h-52 items-stretch gap-3">
                {revenue.map((value, i) => {
                  const isToday = i === revenue.length - 1;
                  return (
                    <div key={d.days[i]} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                      <span className={cn("text-2xs", isToday ? "font-semibold text-ink" : "text-ink-3")}>
                        {value.toFixed(1)}
                      </span>
                      <div className="relative w-full flex-1">
                        {/* emphasis, not an action: ink, not the accent */}
                        <div
                          className={cn("absolute inset-x-0 bottom-0 rounded-t-ctl", isToday ? "bg-ink-2" : "bg-line")}
                          style={{ height: `${(value / peak) * 100}%` }}
                        />
                      </div>
                      <span className="max-w-full truncate text-2xs text-ink-3">{d.days[i]}</span>
                    </div>
                  );
                })}
              </div>
              <p aria-hidden className="mt-2 text-2xs text-ink-3">
                {d.thousands}
              </p>
            </PanelBody>
          </Panel>
        </div>
      </Page>
    </>
  );
}
