import {
  cnMerge,
  createTV,
  type CnOptions,
  type TWMergeConfig,
} from "tailwind-variants";

export type { VariantProps } from "tailwind-variants";

/**
 * Teach the class merger our token names. Without this, tailwind-merge does
 * not know that `h-row` and `h-control` are both heights, so a `className`
 * override would keep both and the stylesheet order would pick the winner.
 */
const twMergeConfig: TWMergeConfig = {
  extend: {
    theme: {
      spacing: [
        "row",
        "control",
        "control-sm",
        "chip",
        "toggle",
        "nav-item",
        "topbar",
        "nav",
        "rail",
        "stack",
        "pad",
        "pad-y",
        "gutter",
        "page-y",
        "cell",
        "row-y",
      ],
      radius: ["ctl", "card", "chip"],
      shadow: ["float", "card"],
    },
    // tailwind-variants bundles its own merger, which does not know that an
    // axis class (mx-3) overrides the logical sides we use (ms-auto, me-2)
    conflictingClassGroups: {
      mx: ["ms", "me"],
      px: ["ps", "pe"],
      "inset-x": ["start", "end"],
      "border-w-x": ["border-w-s", "border-w-e"],
    },
  },
};

export const tv = createTV({ twMergeConfig });

export function cn(...classes: CnOptions): string {
  return cnMerge(...classes)({ twMergeConfig }) ?? "";
}
