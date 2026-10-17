import type { L, Lang } from "./i18n";

/* Realistic but invented — no real patient appears here. */

export const pick = (l: L, lang: Lang) => l[lang];

type Mark =
  | { kind: "signal"; tone: "critical" | "caution" | "stable" | "info"; label: L }
  | { kind: "status"; state: "quiet" | "pending" | "done" | "attention"; label: L };

const sig = (tone: "critical" | "caution" | "stable" | "info", en: string, ar: string): Mark => ({
  kind: "signal",
  tone,
  label: { en, ar },
});
const st = (state: "quiet" | "pending" | "done" | "attention", en: string, ar: string): Mark => ({
  kind: "status",
  state,
  label: { en, ar },
});

export type { Mark };

export const queue: { time: string; name: L; meta: L; marks: Mark[] }[] = [
  {
    time: "08:15",
    name: { en: "Layla Mansour", ar: "ليلى منصور" },
    meta: { en: "MRN 40921 · Follow-up · Bupa Gold", ar: "ملف 40921 · متابعة · بوبا ذهبي" },
    marks: [sig("critical", "Penicillin allergy", "حساسية البنسلين"), st("attention", "Waiting 42m", "ينتظر 42 د")],
  },
  {
    time: "08:30",
    name: { en: "Khalid Al-Harbi", ar: "خالد الحربي" },
    meta: { en: "MRN 38104 · New patient · Self pay", ar: "ملف 38104 · مريض جديد · دفع ذاتي" },
    marks: [st("pending", "Waiting 27m", "ينتظر 27 د")],
  },
  {
    time: "08:45",
    name: { en: "Noura Al-Qahtani", ar: "نورة القحطاني" },
    meta: { en: "MRN 41277 · Antenatal, 28 weeks · Tawuniya", ar: "ملف 41277 · متابعة حمل، 28 أسبوعًا · التعاونية" },
    marks: [sig("info", "Pregnant", "حامل"), st("done", "Vitals done", "العلامات الحيوية مكتملة")],
  },
  {
    time: "09:00",
    name: { en: "Ahmed Siddiqui", ar: "أحمد صديقي" },
    meta: { en: "MRN 39560 · Post-operative review · MedGulf", ar: "ملف 39560 · مراجعة بعد العملية · ميدغلف" },
    marks: [st("done", "Vitals done", "العلامات الحيوية مكتملة")],
  },
  {
    time: "09:15",
    name: { en: "Fatima Al-Zahrani", ar: "فاطمة الزهراني" },
    meta: { en: "MRN 42033 · Diabetes review · Bupa Silver", ar: "ملف 42033 · مراجعة السكري · بوبا فضي" },
    marks: [st("quiet", "Checked in", "تم تسجيل الوصول")],
  },
  {
    time: "09:30",
    name: { en: "Yusuf Rahman", ar: "يوسف رحمن" },
    meta: { en: "MRN 37812 · Follow-up · Self pay", ar: "ملف 37812 · متابعة · دفع ذاتي" },
    marks: [st("quiet", "Checked in", "تم تسجيل الوصول")],
  },
];

export const attention: { title: L; meta: L; mark: Mark }[] = [
  {
    title: { en: "Critical potassium — Layla Mansour", ar: "بوتاسيوم حرج — ليلى منصور" },
    meta: { en: "6.8 mmol/L · reported 07:52 · not yet acknowledged", ar: "6.8 ملمول/لتر · أُبلغ 07:52 · لم يُستلم بعد" },
    mark: sig("critical", "Critical", "حرج"),
  },
  {
    title: { en: "Nine results waiting for review", ar: "تسع نتائج بانتظار المراجعة" },
    meta: { en: "Oldest is 3 hours old", ar: "أقدمها منذ 3 ساعات" },
    mark: st("attention", "Overdue", "متأخر"),
  },
  {
    title: { en: "Four discharge summaries unsigned", ar: "أربعة ملخصات خروج غير موقّعة" },
    meta: { en: "Ward B · discharged yesterday", ar: "جناح B · خرجوا أمس" },
    mark: st("pending", "Due", "مستحق"),
  },
  {
    title: { en: "Pre-authorisation rejected", ar: "رُفض التفويض المسبق" },
    meta: { en: "MRI lumbar spine · Tawuniya · resubmit by Friday", ar: "رنين مغناطيسي للفقرات القطنية · التعاونية · أعد الإرسال قبل الجمعة" },
    mark: st("attention", "Rejected", "مرفوض"),
  },
  {
    title: { en: "Amoxicillin 500 mg below reorder level", ar: "أموكسيسيلين 500 ملغ تحت حد إعادة الطلب" },
    meta: { en: "Main pharmacy · 40 units left", ar: "الصيدلية الرئيسية · متبقٍ 40 وحدة" },
    mark: st("attention", "Low stock", "مخزون منخفض"),
  },
];

export const appointments: { time: string; name: L; meta: L; mark: Mark }[] = [
  {
    time: "10:00",
    name: { en: "Sara Al-Otaibi", ar: "سارة العتيبي" },
    meta: { en: "Consultation · 20 min", ar: "استشارة · 20 دقيقة" },
    mark: st("done", "Confirmed", "مؤكد"),
  },
  {
    time: "10:20",
    name: { en: "Mohammed Baz", ar: "محمد باز" },
    meta: { en: "Follow-up · 20 min", ar: "متابعة · 20 دقيقة" },
    mark: st("done", "Confirmed", "مؤكد"),
  },
  {
    time: "10:40",
    name: { en: "Hind Al-Dosari", ar: "هند الدوسري" },
    meta: { en: "New patient · 30 min", ar: "مريض جديد · 30 دقيقة" },
    mark: st("pending", "Unconfirmed", "غير مؤكد"),
  },
  {
    time: "11:10",
    name: { en: "Abdullah Nasser", ar: "عبدالله ناصر" },
    meta: { en: "Follow-up · 20 min", ar: "متابعة · 20 دقيقة" },
    mark: st("done", "Confirmed", "مؤكد"),
  },
];

/** thousands of SAR, oldest first; the last bar is today */
export const revenue = [9.8, 12.4, 11.2, 13.6, 10.1, 6.7, 12.9];

const yesterday: L = { en: "Yesterday", ar: "أمس" };
const im: L = { en: "Internal medicine", ar: "الباطنة" };
const bupaGold: L = { en: "Bupa Gold", ar: "بوبا ذهبي" };
const tawuniya: L = { en: "Tawuniya", ar: "التعاونية" };
const selfPay: L = { en: "Self pay", ar: "دفع ذاتي" };
const medGulf: L = { en: "MedGulf", ar: "ميدغلف" };
const active = st("quiet", "Active", "نشط");

export const patients: {
  mrn: string;
  name: L;
  age: number;
  sex: "F" | "M";
  phone: string;
  payer: L;
  last: L;
  clinic: L;
  mark: Mark;
}[] = [
  { mrn: "40921", name: { en: "Layla Mansour", ar: "ليلى منصور" }, age: 34, sex: "F", phone: "055 412 8890", payer: bupaGold, last: { en: "Today, 08:15", ar: "اليوم 08:15" }, clinic: im, mark: sig("critical", "Penicillin allergy", "حساسية البنسلين") },
  { mrn: "41277", name: { en: "Noura Al-Qahtani", ar: "نورة القحطاني" }, age: 29, sex: "F", phone: "050 778 2314", payer: tawuniya, last: { en: "Today, 08:45", ar: "اليوم 08:45" }, clinic: { en: "Obstetrics", ar: "النساء والتوليد" }, mark: sig("info", "Pregnant, 28 weeks", "حامل، 28 أسبوعًا") },
  { mrn: "38104", name: { en: "Khalid Al-Harbi", ar: "خالد الحربي" }, age: 51, sex: "M", phone: "053 990 4471", payer: selfPay, last: { en: "Today, 08:30", ar: "اليوم 08:30" }, clinic: im, mark: st("attention", "ID copy missing", "نسخة الهوية ناقصة") },
  { mrn: "39560", name: { en: "Ahmed Siddiqui", ar: "أحمد صديقي" }, age: 46, sex: "M", phone: "056 221 7705", payer: medGulf, last: { en: "Today, 09:00", ar: "اليوم 09:00" }, clinic: { en: "Orthopaedics", ar: "العظام" }, mark: active },
  { mrn: "42033", name: { en: "Fatima Al-Zahrani", ar: "فاطمة الزهراني" }, age: 62, sex: "F", phone: "054 118 3362", payer: { en: "Bupa Silver", ar: "بوبا فضي" }, last: { en: "Today, 09:15", ar: "اليوم 09:15" }, clinic: { en: "Endocrinology", ar: "الغدد الصماء" }, mark: active },
  { mrn: "37812", name: { en: "Yusuf Rahman", ar: "يوسف رحمن" }, age: 38, sex: "M", phone: "059 664 2210", payer: selfPay, last: yesterday, clinic: { en: "Dental", ar: "الأسنان" }, mark: active },
  { mrn: "40118", name: { en: "Sara Al-Otaibi", ar: "سارة العتيبي" }, age: 41, sex: "F", phone: "050 337 9918", payer: tawuniya, last: { en: "18 Sep", ar: "18 سبتمبر" }, clinic: { en: "Ophthalmology", ar: "العيون" }, mark: st("quiet", "Discharged", "خرج") },
  { mrn: "36447", name: { en: "Mohammed Baz", ar: "محمد باز" }, age: 57, sex: "M", phone: "055 802 6640", payer: medGulf, last: { en: "17 Sep", ar: "17 سبتمبر" }, clinic: { en: "Cardiology", ar: "القلب" }, mark: st("quiet", "Admitted · ward B", "منوَّم · جناح B") },
  { mrn: "42910", name: { en: "Hind Al-Dosari", ar: "هند الدوسري" }, age: 26, sex: "F", phone: "058 445 1173", payer: bupaGold, last: { en: "15 Sep", ar: "15 سبتمبر" }, clinic: { en: "Dermatology", ar: "الجلدية" }, mark: active },
  { mrn: "31204", name: { en: "Abdullah Nasser", ar: "عبدالله ناصر" }, age: 73, sex: "M", phone: "051 220 8834", payer: selfPay, last: { en: "12 Sep", ar: "12 سبتمبر" }, clinic: im, mark: st("attention", "Outstanding balance", "رصيد مستحق") },
];

export const visit = {
  mrn: "40921",
  visitNo: "V-118204",
  initials: { en: "LM", ar: "ل م" },
  name: { en: "Layla Mansour", ar: "ليلى منصور" },
  altName: { en: "ليلى منصور", ar: "Layla Mansour" },
  alerts: [
    sig("critical", "Penicillin — anaphylaxis", "البنسلين — صدمة تحسسية"),
    sig("critical", "Potassium 6.8", "البوتاسيوم 6.8"),
    sig("caution", "eGFR 48", "eGFR 48"),
  ],
  payer: bupaGold,
  arrived: "08:15",
  seenBy: { en: "Dr. Omar Aziz", ar: "د. عمر عزيز" },
  allergies: [
    sig("critical", "Penicillin — anaphylaxis", "البنسلين — صدمة تحسسية"),
    sig("caution", "Shellfish — rash", "المحار — طفح جلدي"),
  ],
  medications: [
    { name: { en: "Metformin 850 mg", ar: "ميتفورمين 850 ملغ" }, dose: { en: "Twice daily with food · since 12 Mar", ar: "مرتين يوميًا مع الطعام · منذ 12 مارس" } },
    { name: { en: "Ramipril 5 mg", ar: "راميبريل 5 ملغ" }, dose: { en: "Once daily · since 02 Jun", ar: "مرة يوميًا · منذ 2 يونيو" } },
    { name: { en: "Atorvastatin 20 mg", ar: "أتورفاستاتين 20 ملغ" }, dose: { en: "At night · since 02 Jun", ar: "ليلًا · منذ 2 يونيو" } },
  ],
};
