import { Ltr, PageHeader, Panel, PanelHeader, Status, Table, Td, Th, Tr } from "@his/ui";
import { MonthPicker } from "./month-picker";

/*
 * Al-Amal's own pages (customer.json → "routes"). Only Al-Amal asked for this
 * report, in the layout their insurer wants, so it lives in their folder and
 * not in the core or in the Billing product.
 */

/** searched for by scripts/verify-build.mjs — proves Al-Amal's own code reached the build */
export const AL_AMAL_SERVER_MARK = "his-al-amal-server-module";

type Lang = "en" | "ar";
type L = Record<Lang, string>;

const T = {
  title: { en: "Insurer monthly report", ar: "تقرير التأمين الشهري" },
  subtitle: { en: "Tawuniya · claims submitted by Al-Amal", ar: "التعاونية · المطالبات المرفوعة من الأمل" },
  panel: { en: "Claims by clinic", ar: "المطالبات حسب العيادة" },
  cols: {
    clinic: { en: "Clinic", ar: "العيادة" },
    claims: { en: "Claims", ar: "المطالبات" },
    amount: { en: "Amount", ar: "المبلغ" },
    status: { en: "Status", ar: "الحالة" },
  },
} satisfies Record<string, L | Record<string, L>>;

const ROWS: { clinic: L; claims: number; amount: string; state: "done" | "pending" | "attention"; status: L }[] = [
  { clinic: { en: "Internal medicine", ar: "الباطنة" }, claims: 142, amount: "84,300.00", state: "done", status: { en: "Accepted", ar: "مقبولة" } },
  { clinic: { en: "Obstetrics", ar: "النساء والتوليد" }, claims: 61, amount: "52,120.00", state: "pending", status: { en: "Under review", ar: "قيد المراجعة" } },
  { clinic: { en: "Orthopaedics", ar: "العظام" }, claims: 38, amount: "40,760.00", state: "attention", status: { en: "4 rejected", ar: "4 مرفوضة" } },
];

export function InsurerReport({ lang }: { lang: Lang }) {
  const cur = lang === "ar" ? "ر.س" : "SAR";
  return (
    <div data-module={AL_AMAL_SERVER_MARK}>
      <PageHeader title={T.title[lang]} subtitle={T.subtitle[lang]} />
      <Panel>
        <PanelHeader title={T.panel[lang]} />
        <MonthPicker lang={lang} />
        <Table label={T.panel[lang]}>
          <thead>
            <tr>
              <Th>{T.cols.clinic[lang]}</Th>
              <Th>{T.cols.claims[lang]}</Th>
              <Th>{T.cols.amount[lang]}</Th>
              <Th>{T.cols.status[lang]}</Th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <Tr key={r.clinic.en}>
                <Td>{r.clinic[lang]}</Td>
                <Td>
                  <Ltr>{String(r.claims)}</Ltr>
                </Td>
                <Td>
                  <Ltr>{r.amount}</Ltr> {cur}
                </Td>
                <Td>
                  <Status state={r.state}>{r.status[lang]}</Status>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}
