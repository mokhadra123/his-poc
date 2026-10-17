import { Button, Ltr, NameCell, PageHeader, Panel, Table, Td, Th, Tr } from "@his/ui";
import { Download, Ellipsis, Eye, Plus } from "lucide-react";
import { MarkChip, Page, PageTopbar } from "@/components/page-parts";
import { PatientFilters } from "@/components/patient-filters";
import { patients, pick } from "@/lib/data";
import { getDict, getLang } from "@/lib/i18n";

export default async function PatientsPage() {
  const lang = await getLang();
  const other = lang === "ar" ? "en" : "ar";
  const t = await getDict();
  const p = t.patients;

  return (
    <>
      <PageTopbar crumbs={[t.shell.outpatient]} current={p.title} t={t.shell} />
      <Page>
        <PageHeader
          title={p.title}
          subtitle={p.subtitle}
          actions={
            <>
              <Button>
                <Download aria-hidden />
                {p.export}
              </Button>
              <Button tone="primary">
                <Plus aria-hidden />
                {t.dashboard.register}
              </Button>
            </>
          }
        />

        <Panel>
          <PatientFilters t={p} />
          <Table label={p.title}>
            <thead>
              <tr>
                <Th>{p.cols.mrn}</Th>
                <Th>{p.cols.name}</Th>
                <Th>{p.cols.age}</Th>
                <Th>{p.cols.contact}</Th>
                <Th>{p.cols.payer}</Th>
                <Th>{p.cols.last}</Th>
                <Th>{p.cols.clinic}</Th>
                <Th>{p.cols.status}</Th>
                <Th className="print:hidden">
                  <span className="sr-only">{p.more}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {patients.map((row) => (
                <Tr key={row.mrn}>
                  <Td tone="id">{row.mrn}</Td>
                  <Td>
                    <NameCell primary={pick(row.name, lang)} secondary={pick(row.name, other)} secondaryLang={other} />
                  </Td>
                  <Td tone="dim">
                    {row.age} · {p.sex[row.sex]}
                  </Td>
                  <Td tone="dim" className="print:whitespace-nowrap">
                    <Ltr>{row.phone}</Ltr>
                  </Td>
                  <Td>{pick(row.payer, lang)}</Td>
                  <Td tone="dim">{pick(row.last, lang)}</Td>
                  <Td tone="dim">{pick(row.clinic, lang)}</Td>
                  <Td>
                    <MarkChip mark={row.mark} lang={lang} />
                  </Td>
                  <Td className="print:hidden">
                    <div className="flex justify-end gap-1">
                      <Button tone="ghost" size="sm" iconOnly aria-label={p.viewPatient.replace("{name}", pick(row.name, lang))}>
                        <Eye aria-hidden />
                      </Button>
                      <Button tone="ghost" size="sm" iconOnly aria-label={p.moreFor.replace("{name}", pick(row.name, lang))}>
                        <Ellipsis aria-hidden />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-pad py-pad-y text-sm text-ink-3">
            {p.showing}
            <div className="ms-auto flex gap-1">
              <Button size="sm">{p.previous}</Button>
              <Button size="sm">{p.next}</Button>
            </div>
          </div>
        </Panel>
      </Page>
    </>
  );
}
