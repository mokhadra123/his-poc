import { Ltr, PageHeader, Panel, PanelHeader, Status, Table, Td, Th, Tr } from "@his/ui";
import { StockSearch } from "./stock-search";

/*
 * The Pharmacy product. Same contract as Billing: mounted by a generated
 * route shell, given the language, unaware of the app. A customer without
 * Pharmacy gets none of this file in their build.
 */

/** searched for by scripts/verify-build.mjs — proves server code reached the build */
export const PHARMACY_SERVER_MARK = "his-pharmacy-server-module";

type Lang = "en" | "ar";
type L = Record<Lang, string>;

const T = {
  title: { en: "Pharmacy stock", ar: "مخزون الصيدلية" },
  subtitle: { en: "Main pharmacy · 2 items below reorder level", ar: "الصيدلية الرئيسية · صنفان تحت حد إعادة الطلب" },
  panel: { en: "Items", ar: "الأصناف" },
  cols: {
    item: { en: "Item", ar: "الصنف" },
    onHand: { en: "On hand", ar: "المتوفر" },
    reorder: { en: "Reorder at", ar: "حد إعادة الطلب" },
    status: { en: "Status", ar: "الحالة" },
  },
} satisfies Record<string, L | Record<string, L>>;

const STOCK: { item: L; onHand: number; reorder: number }[] = [
  { item: { en: "Amoxicillin 500 mg", ar: "أموكسيسيلين 500 ملغ" }, onHand: 40, reorder: 100 },
  { item: { en: "Metformin 850 mg", ar: "ميتفورمين 850 ملغ" }, onHand: 1200, reorder: 300 },
  { item: { en: "Ramipril 5 mg", ar: "راميبريل 5 ملغ" }, onHand: 320, reorder: 150 },
  { item: { en: "Insulin glargine 100 U/mL", ar: "إنسولين جلارجين 100 وحدة/مل" }, onHand: 18, reorder: 30 },
];

export function StockPage({ lang }: { lang: Lang }) {
  return (
    <div data-module={PHARMACY_SERVER_MARK}>
      <PageHeader title={T.title[lang]} subtitle={T.subtitle[lang]} />
      <Panel>
        <PanelHeader title={T.panel[lang]} />
        <StockSearch lang={lang} />
        <Table label={T.title[lang]}>
          <thead>
            <tr>
              <Th>{T.cols.item[lang]}</Th>
              <Th>{T.cols.onHand[lang]}</Th>
              <Th>{T.cols.reorder[lang]}</Th>
              <Th>{T.cols.status[lang]}</Th>
            </tr>
          </thead>
          <tbody>
            {STOCK.map((s) => {
              const low = s.onHand < s.reorder;
              return (
                <Tr key={s.item.en}>
                  <Td>{s.item[lang]}</Td>
                  <Td>
                    <Ltr>{s.onHand.toLocaleString("en-US")}</Ltr>
                  </Td>
                  <Td tone="dim">
                    <Ltr>{s.reorder.toLocaleString("en-US")}</Ltr>
                  </Td>
                  <Td>
                    {/* stock is operational state: <Status>, never a clinical colour */}
                    <Status state={low ? "attention" : "quiet"}>
                      {low ? (lang === "ar" ? "مخزون منخفض" : "Low stock") : lang === "ar" ? "متوفر" : "In stock"}
                    </Status>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}
