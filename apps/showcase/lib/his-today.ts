// check-tokens: legacy-data — this file documents HIS-frontend's class names
// and colours as data; none of them is used as a class in the POC.
import type { L } from "./i18n";

/*
 * The design system of HIS-frontend as it is today, read from the code at
 * commit 8a3fdaeb9 (2026-10-14): src/styles/globals.css, src/lib/fonts.ts,
 * components/common/appSidebar, components/common/topNav, components/ui.
 * Usage counts are class names across src (regex, approximate).
 *
 * These are DATA (swatches drawn with inline styles), not classes — the
 * POC's own UI never uses them. The "original" theme in tokens.css maps
 * them onto @his/ui roles so the screens can be compared.
 */

export const HIS_COMMIT = "8a3fdaeb9";

export type Swatch = { name: string; hex: string; uses?: string; note: L };

export const palette: Swatch[] = [
  { name: "main-blue", hex: "#315090", uses: "1,678 + 173 hex", note: { en: "Identity: titles, active state, links", ar: "الهوية: العناوين والحالة النشطة والروابط" } },
  { name: "main-orange", hex: "#ec8038", uses: "313", note: { en: "The Save button AND “warning”", ar: "زر الحفظ و«التحذير» معًا" } },
  { name: "main-red", hex: "#de4949", uses: "457", note: { en: "Critical, delete, unpaid, badges", ar: "حرج وحذف وغير مدفوع والشارات" } },
  { name: "main-green", hex: "#25b877", uses: "314", note: { en: "Normal, done, paid, “yes”", ar: "طبيعي ومكتمل ومدفوع و«نعم»" } },
  { name: "main-purple", hex: "#952ee9", uses: "12", note: { en: "Barely used", ar: "نادر الاستخدام" } },
  { name: "light-blue", hex: "#7a92c4", uses: "54", note: { en: "Scrollbars, avatar icon", ar: "أشرطة التمرير وأيقونة الصورة" } },
  { name: "dark-text", hex: "#292929", uses: "161", note: { en: "Labels", ar: "التسميات" } },
  { name: "blue-translucent", hex: "#dbe5ff", uses: "32 + 57 hex", note: { en: "Secondary button fill", ar: "خلفية الزر الثانوي" } },
  { name: "pale-blue", hex: "#dee5f6", uses: "10 + 83 hex", note: { en: "Selected tint", ar: "لون التحديد" } },
  { name: "light-orange", hex: "#fff0e5", uses: "56", note: { en: "Unsaved-changes pill", ar: "شارة التغييرات غير المحفوظة" } },
  { name: "main-bg", hex: "#f8f7fa", uses: "14 + hard-coded", note: { en: "Page canvas", ar: "خلفية الصفحة" } },
  { name: "--border", hex: "#bdbdbd", uses: "~1,250 bare borders", note: { en: "Every border without a colour", ar: "كل حد بلا لون محدد" } },
  { name: "--primary", hex: "#171717", uses: "18", note: { en: "shadcn primary — never set to the brand", ar: "primary في shadcn — لم يُضبط على لون العلامة" } },
  { name: "--destructive", hex: "#e7000b", uses: "51", note: { en: "Form errors — a second red", ar: "أخطاء النماذج — أحمر ثانٍ" } },
];

export const grays: Swatch[] = [
  { name: "50", hex: "#f2f3fa", uses: "500", note: { en: "", ar: "" } },
  { name: "100", hex: "#e7e9f5", uses: "708", note: { en: "", ar: "" } },
  { name: "200", hex: "#cacad9", uses: "806", note: { en: "", ar: "" } },
  { name: "300", hex: "#9fa1b0", uses: "233", note: { en: "", ar: "" } },
  { name: "400", hex: "#868899", uses: "951", note: { en: "", ar: "" } },
  { name: "500", hex: "#797b88", uses: "795", note: { en: "", ar: "" } },
  { name: "600", hex: "#686a77", uses: "592", note: { en: "", ar: "" } },
  { name: "700", hex: "#565861", uses: "625", note: { en: "", ar: "" } },
  { name: "800", hex: "#43454d", uses: "165", note: { en: "", ar: "" } },
  { name: "900", hex: "#34343c", uses: "332", note: { en: "", ar: "" } },
];

export const pastels: { name: string; hex: string }[] = [
  { name: "misty-rose", hex: "#ffd9d9" },
  { name: "light-cyan", hex: "#d2f0ff" },
  { name: "bisque", hex: "#fee6c9" },
  { name: "light-green", hex: "#b5e7a7" },
  { name: "lavender", hex: "#bfb0f0" },
  { name: "light-lavender", hex: "#d8aee6" },
  { name: "powder-blue", hex: "#cde6f9" },
  { name: "peach", hex: "#ffe5b4" },
  { name: "light-pink", hex: "#ffcce5" },
  { name: "mint-cream", hex: "#d5ffe4" },
  { name: "baby-blue", hex: "#cce4ff" },
  { name: "honeydew", hex: "#e1fcd7" },
  { name: "pale-lemon", hex: "#fffacd" },
  { name: "soft-periwinkle", hex: "#d5d6ff" },
  { name: "thistle", hex: "#e7d3f5" },
  { name: "pale-orange", hex: "#ffd8a9" },
];

export const sidebarGradient = ["#243b6d", "#30487b"] as const;

export const fonts: { family: string; role: L; used: boolean }[] = [
  { family: "Rubik", role: { en: "English body, 300–700", ar: "نص الإنجليزية، 300–700" }, used: true },
  {
    family: "Almarai",
    role: {
      en: "Arabic body, 300/400/700/800 — no 500 or 600, so medium and semibold collapse",
      ar: "نص العربية، 300/400/700/800 — بلا 500 أو 600 فيختفي الفرق بين المتوسط وشبه العريض",
    },
    used: true,
  },
  { family: "Poppins", role: { en: "3 places", ar: "3 مواضع" }, used: true },
  { family: "Inter", role: { en: "Loaded, never used", ar: "يُحمَّل ولا يُستخدم" }, used: false },
  { family: "Public Sans", role: { en: "Loaded, never used", ar: "يُحمَّل ولا يُستخدم" }, used: false },
];

export const shape: { name: string; value: string; uses: L }[] = [
  { name: "rounded-md", value: "8px", uses: { en: "Every control", ar: "كل عناصر التحكم" } },
  { name: "rounded-[10px]", value: "10px", uses: { en: "Tags, secondary buttons (86)", ar: "الوسوم والأزرار الثانوية (86)" } },
  { name: "rounded-[15px]", value: "15px", uses: { en: "Page cards (167)", ar: "بطاقات الصفحات (167)" } },
  { name: "rounded-2xl", value: "16px", uses: { en: "Top-nav icon tiles", ar: "مربعات أيقونات الشريط العلوي" } },
  { name: "h-10", value: "40px", uses: { en: "Inputs, selects, buttons", ar: "الحقول والقوائم والأزرار" } },
  {
    name: "rounded-[15px] cards",
    value: "no border, no shadow",
    uses: { en: "shadow-sm is on only 8 of 167", ar: "shadow-sm على 8 فقط من 167" },
  },
];

/** Each HIS token and where it lands in @his/ui. */
export const mapping: { his: string; swatch?: string; role: string; what: L }[] = [
  {
    his: "main-blue #315090",
    swatch: "#315090",
    role: "--brand",
    what: {
      en: "Kept as the hospital colour. Every other shade, and the text colour on it, is now computed from it.",
      ar: "يبقى لون المستشفى، وكل الدرجات الأخرى ولون النص فوقه تُحسب منه.",
    },
  },
  {
    his: "main-orange — Save",
    swatch: "#ec8038",
    role: "--accent",
    what: {
      en: "Merged: actions use the one accent. Orange stops meaning both “save” and “warning”; white on it was 2.7:1.",
      ar: "يُدمج: الإجراءات تستخدم لونًا واحدًا. البرتقالي لم يعد يعني «حفظ» و«تحذير» معًا، والأبيض عليه كان 2.7:1.",
    },
  },
  {
    his: "main-orange — warning",
    swatch: "#ec8038",
    role: "--caution",
    what: { en: "Kept as a meaning, darkened from 2.7:1 to 5.6:1.", ar: "يبقى كمعنى، ويُغمَّق من 2.7:1 إلى 5.6:1." },
  },
  {
    his: "main-red",
    swatch: "#de4949",
    role: "--critical · <Status>",
    what: {
      en: "Split: clinical red stays (4.1 → 5.9:1); delete, unpaid and badges move to neutral <Status> and buttons.",
      ar: "يُقسَّم: الأحمر الإكلينيكي يبقى (4.1 → 5.9:1)، والحذف وغير المدفوع والشارات تنتقل إلى <Status> محايد.",
    },
  },
  {
    his: "main-green",
    swatch: "#25b877",
    role: "--stable · <Status>",
    what: {
      en: "Split: “normal” stays, darkened 2.6 → 6.0:1; “paid”, “yes” and “active” become neutral.",
      ar: "يُقسَّم: «طبيعي» يبقى ويُغمَّق 2.6 → 6.0:1، و«مدفوع» و«نعم» و«نشط» تصبح محايدة.",
    },
  },
  {
    his: "gray-50 … 900",
    swatch: "#797b88",
    role: "--surface-2 · --line · --ink-3 · --ink-2 · --ink",
    what: { en: "Ten shades become five roles; tertiary text goes from 4.2:1 to 5.4:1.", ar: "عشر درجات تصبح خمسة أدوار، والنص الثالثي من 4.2:1 إلى 5.4:1." },
  },
  {
    his: "dark-text · gray-900",
    swatch: "#292929",
    role: "--ink",
    what: { en: "Merged: one text colour.", ar: "يُدمجان: لون نص واحد." },
  },
  {
    his: "--border #bdbdbd · input #cacad9",
    swatch: "#bdbdbd",
    role: "--line · --control-line",
    what: {
      en: "Split by purpose: quiet dividers, and input borders that clear 3:1 (they were 1.6:1).",
      ar: "يُقسَّمان حسب الغرض: فواصل هادئة، وحدود حقول تحقق 3:1 (كانت 1.6:1).",
    },
  },
  {
    his: "blue-translucent · pale-blue",
    swatch: "#dbe5ff",
    role: "--accent-soft",
    what: { en: "Merged into one tint derived from the brand.", ar: "يُدمجان في درجة واحدة مشتقة من لون العلامة." },
  },
  {
    his: "16 appointment pastels",
    swatch: "#d5d6ff",
    role: "—",
    what: {
      en: "Dropped: a random colour per doctor column carries no meaning.",
      ar: "تُحذف: لون عشوائي لكل عمود طبيب لا يحمل أي معنى.",
    },
  },
  {
    his: "StatCard colour schemes (6)",
    swatch: "#535096",
    role: "<Stat>",
    what: { en: "Dropped: summary cards are neutral.", ar: "تُحذف: بطاقات الملخص محايدة." },
  },
  {
    his: "Status palettes (brand tints + Tailwind pairs)",
    swatch: "#ffedcd",
    role: "<Signal> · <Status>",
    what: {
      en: "Three palettes become two components: clinical (coloured, shaped) and operational (neutral).",
      ar: "ثلاث لوحات تصبح مكوّنين: إكلينيكي (ملوّن بشكل) وتشغيلي (محايد).",
    },
  },
  {
    his: "shadcn --primary #171717 · --ring #a1a1a1",
    swatch: "#a1a1a1",
    role: "--accent · --focus",
    what: {
      en: "Replaced: the brand finally is the primary, and the focus ring clears 3:1 in every theme.",
      ar: "يُستبدلان: لون العلامة أصبح الأساسي أخيرًا، وحلقة التركيز تحقق 3:1 في كل ثيم.",
    },
  },
  {
    his: "Sidebar gradient",
    swatch: "#243b6d",
    role: "--nav-bg · --nav-image",
    what: { en: "Kept as an option (this theme); the new themes use a flat rail.", ar: "يبقى كخيار (هذا الثيم)، والثيمات الجديدة تستخدم شريطًا مسطحًا." },
  },
  {
    his: "Rubik · Almarai (+ Poppins, Inter, Public Sans)",
    role: "IBM Plex Sans + Arabic",
    what: { en: "One family for both scripts; five fonts become two faces.", ar: "عائلة واحدة للكتابتين؛ خمسة خطوط تصبح وجهين." },
  },
  {
    his: "radius 6 / 8 / 10 / 14 / 15 / 16px",
    role: "--r-ctl · --r-card · --r-chip",
    what: { en: "Three radii, chosen once.", ar: "ثلاثة أنصاف أقطار تُختار مرة واحدة." },
  },
];

export const findings: L[] = [
  {
    en: "The brand is not the primary: shadcn --primary is still near-black, and the blue is applied class by class (1,678 times).",
    ar: "لون العلامة ليس الأساسي: primary في shadcn ما زال شبه أسود، والأزرق يُطبَّق كلاسًا كلاسًا (1,678 مرة).",
  },
  {
    en: "One colour, two meanings: orange is both “save” and “warning”; red is both “critical” and “delete”.",
    ar: "لون واحد بمعنيين: البرتقالي «حفظ» و«تحذير»، والأحمر «حرج» و«حذف».",
  },
  {
    en: "Status colours fail as text on white: green 2.6:1, orange 2.7:1, red 4.1:1 (4.5 needed).",
    ar: "ألوان الحالة لا تحقق التباين كنص على الأبيض: الأخضر 2.6:1 والبرتقالي 2.7:1 والأحمر 4.1:1 (المطلوب 4.5).",
  },
  {
    en: "894 hard-coded hex classes (119 values) and 1,071 hex literals bypass the tokens.",
    ar: "894 كلاس hex مكتوب يدويًا (119 قيمة) و1,071 قيمة hex تتجاوز الـ tokens.",
  },
  {
    en: "Five fonts load and two do the work; in Arabic, medium and semibold collapse into regular and bold.",
    ar: "خمسة خطوط تُحمَّل واثنان فقط يعملان، وفي العربية يختفي الفرق بين المتوسط وشبه العريض.",
  },
  {
    en: "The focus ring is a 50% gray (#a1a1a1), and inputs suppress it with an inline shadow.",
    ar: "حلقة التركيز رمادية بنسبة 50% (#a1a1a1)، والحقول تخفيها بظل مكتوب داخليًا.",
  },
  {
    en: "Dark mode is defined but nothing ever switches it on.",
    ar: "الوضع الداكن معرَّف لكن لا شيء يفعّله.",
  },
  {
    en: "RTL: the sidebar border and several badges stay on the physical side.",
    ar: "الاتجاه من اليمين: حد القائمة الجانبية وعدة شارات تبقى على الجانب الفعلي.",
  },
];
