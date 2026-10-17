#!/usr/bin/env node
/*
 * Token guard. Fails on class names that would bypass the design system:
 *
 *   hex       bg-[#123456]          → use a role: bg-surface, text-critical …
 *   palette   bg-blue-600           → the palette is removed, so this would
 *                                      compile to NOTHING and fail silently
 *   physical  ml-2, left-0, text-left → use ms-2, start-0, text-start so RTL works
 *   unknown   text-inkk, rounded-lg, shadow-md, text-base, h-rows, p-pads
 *                                    → not a role the design system defines; the
 *                                      default scales are removed, so it would
 *                                      also compile to nothing
 *
 * The allowed role names are read from packages/ui/src/styles/index.css, so
 * adding a token there is the only way to make a new name legal.
 *
 * It reads string literals in .ts/.tsx files under apps/, packages/ and customers/.
 * A file that DOCUMENTS another system's class names (not uses them) opts out
 * with the marker comment `check-tokens: legacy-data` — say why next to it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const SCAN = ["apps", "packages", "customers"];
const SKIP = new Set(["node_modules", ".next", "dist"]);

/* ---------- the names the design system defines ---------- */

const themeCss = readFileSync(join(root, "packages/ui/src/styles/index.css"), "utf8");
const defined = (ns) =>
  new Set([...themeCss.matchAll(new RegExp(String.raw`^\s*--${ns}-([a-z0-9-]+):`, "gm"))].map((m) => m[1]));
const COLORS = defined("color");
const RADII = defined("radius");
const SIZES = defined("text");
const SHADOWS = defined("shadow");
const FONTS = defined("font");
const SPACING = defined("spacing");

/* ---------- rules ---------- */

const VARIANTS = String.raw`(?:[\w-]+:|\[[^\]]*\]:|[\w-]+-\[[^\]]*\]:)*`;
const RULES = [
  {
    name: "hex",
    re: new RegExp(String.raw`^${VARIANTS}!?-?[a-z-]+-\[#[0-9a-fA-F]{3,8}\]`),
    hint: "use a semantic colour role",
  },
  {
    name: "palette",
    re: new RegExp(
      String.raw`^${VARIANTS}!?(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|placeholder|decoration|shadow|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d+)?$`,
    ),
    hint: "the raw palette is disabled; use a semantic colour role",
  },
  {
    name: "physical",
    re: new RegExp(
      String.raw`^${VARIANTS}!?-?(?:(?:ml|mr|pl|pr|left|right|scroll-ml|scroll-mr|scroll-pl|scroll-pr|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|border-l|border-r)-\S+|text-left|text-right|float-left|float-right|clear-left|clear-right|border-l|border-r|rounded-l|rounded-r)$`,
    ),
    hint: "use the logical form (ms-, me-, ps-, pe-, start-, end-, border-s, border-e, text-start …)",
  },
];

/* keywords that are not colours, per utility */
const NUM = /^\d+(\.\d+)?$/;
const NOT_COLOUR = {
  text: /^(start|end|center|justify|left|right|wrap|nowrap|balance|pretty|clip|ellipsis)$/,
  bg: /^(none|fixed|local|scroll|auto|cover|contain|center|top|bottom|left|right|(left|right)-(top|bottom)|repeat(-x|-y|-round|-space)?|no-repeat|clip-.+|origin-.+|linear-.+|radial.*|conic.*|blend-.+)$/,
  border: /^(\d+|solid|dashed|dotted|double|hidden|none|collapse|separate|spacing-.+)$/,
  ring: /^(\d+|inset|offset-\d+)$/,
  outline: /^(none|hidden|solid|dashed|dotted|double|\d+|offset-\d+)$/,
  fill: /^none$/,
  stroke: /^(\d+(\.\d+)?|none)$/,
  divide: /^(x|y|x-\d+|y-\d+|x-reverse|y-reverse|solid|dashed|dotted|double|none)$/,
  decoration: /^(solid|double|dotted|dashed|wavy|auto|from-font|clone|slice|\d+)$/,
  accent: /^auto$/,
  caret: /^auto$/,
  shadow: /^none$/,
};

const SIZE_WORDS = /^(px|auto|full|screen|min|max|fit|dvh|svh|lvh|dvw|svw|lvw|none|prose|\d+\/\d+|\d?xs|sm|md|lg|\d?xl)$/;

function unknownRole(utility) {
  // utility has its variants and any !/- prefix already removed
  const bare = utility.replace(/\/\d+$/, ""); // opacity modifier
  let m;
  if (
    (m = bare.match(
      /^(?:h|w|size|min-h|min-w|max-h|max-w|p[xytbse]?|m[xytbse]?|gap(?:-[xy])?|inset(?:-[xyse])?|start|end|top|bottom|space-[xy]|scroll-[mp][xytbse]?)-(.+)$/,
    ))
  ) {
    const v = m[1];
    return NUM.test(v) || SIZE_WORDS.test(v) || SPACING.has(v) ? null : `size "${v}"`;
  }
  if ((m = bare.match(/^rounded(?:-[se][se]?|-[tb]|-[se])?(?:-(.+))?$/))) {
    const v = m[1];
    return v === undefined || v === "full" || v === "none" || RADII.has(v) ? null : `radius "${v}"`;
  }
  if ((m = bare.match(/^font-(.+)$/))) {
    const v = m[1];
    const weights = /^(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;
    return weights.test(v) || FONTS.has(v) ? null : `font "${v}"`;
  }
  if ((m = bare.match(/^shadow-(.+)$/))) {
    const v = m[1];
    return SHADOWS.has(v) || COLORS.has(v) || NOT_COLOUR.shadow.test(v) ? null : `shadow "${v}"`;
  }
  if ((m = bare.match(/^text-(.+)$/))) {
    const v = m[1];
    return SIZES.has(v) || COLORS.has(v) || NOT_COLOUR.text.test(v) ? null : `text "${v}"`;
  }
  if ((m = bare.match(/^border(?:-[xysetb])?(?:-(.+))?$/))) {
    const v = m[1];
    return v === undefined || COLORS.has(v) || NOT_COLOUR.border.test(v) ? null : `border "${v}"`;
  }
  if ((m = bare.match(/^(bg|ring|outline|fill|stroke|divide|decoration|accent|caret)-(.+)$/))) {
    const [, util, v] = m;
    if (util === "ring" && v.startsWith("offset-")) {
      const c = v.slice(7);
      return NUM.test(c) || COLORS.has(c) ? null : `ring-offset "${c}"`;
    }
    return COLORS.has(v) || NUM.test(v) || NOT_COLOUR[util]?.test(v) ? null : `${util} "${v}"`;
  }
  return null;
}

/* ---------- scan ---------- */

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(ts|tsx)$/.test(entry)) yield path;
  }
}

const STRING = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
// a plain (non-arbitrary) class token: lowercase utility with optional variants
const CLASS_LIKE = /^[a-z0-9:!\-/.&>_*@~+]+$/;
const problems = [];

for (const top of SCAN) {
  for (const file of files(join(root, top))) {
    const source = readFileSync(file, "utf8");
    if (source.includes("check-tokens: legacy-data")) continue;
    for (const match of source.matchAll(STRING)) {
      const text = match[1] ?? match[2] ?? match[3] ?? "";
      const line = () => source.slice(0, match.index).split("\n").length;
      for (const token of text.split(/\s+/)) {
        if (!token) continue;
        for (const rule of RULES) {
          if (rule.re.test(token)) {
            problems.push(`${relative(root, file)}:${line()}  ${token}  [${rule.name}] ${rule.hint}`);
          }
        }
        if (!CLASS_LIKE.test(token) || token.includes("[")) continue;
        // not classes: CSS custom properties, role names used as labels, merger group ids
        if (token.startsWith("--") || COLORS.has(token) || /^(border-w|inset)-[xyse]$/.test(token)) continue;
        const utility = token.replace(/^(?:[\w-]+:)*/, "").replace(/^[!-]+/, "");
        const reason = unknownRole(utility);
        if (reason) {
          problems.push(
            `${relative(root, file)}:${line()}  ${token}  [unknown] ${reason} is not defined in @his/ui — it would compile to nothing`,
          );
        }
      }
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} class name(s) bypass the design system.`);
  process.exit(1);
}
console.log(
  `tokens: ok — no hex colours, raw palette, physical direction or unknown role classes ` +
    `(${COLORS.size} colours, ${RADII.size} radii, ${SIZES.size} text sizes known).`,
);
