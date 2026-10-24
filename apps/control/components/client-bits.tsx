"use client";

import { Button, type ButtonProps, cn } from "@his/ui";
import { setPref } from "@his/ui/theme";
import { usePref } from "@his/ui/theme/client";
import { Check, Copy, Moon, Sun } from "lucide-react";
import { useState } from "react";

/* Small interactive pieces. */

/** Copies a value; says so for a moment (and to screen readers) */
export function CopyButton({ value, label, ...props }: Omit<ButtonProps, "onClick" | "value"> & { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      {...props}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}

/** Light/dark for this person, remembered in a cookie the server reads */
export function ModeToggle({ initial }: { initial: "light" | "dark" }) {
  const mode = usePref("mode", initial);
  const next = mode === "dark" ? "light" : "dark";
  const Icon = mode === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={() => setPref("mode", next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={cn(
        "relative grid size-(--chrome-icon-size) shrink-0 cursor-pointer place-items-center rounded-(--chrome-icon-radius)",
        "border border-chrome-icon-line bg-chrome-icon text-chrome-icon-ink hover:text-chrome-ink [&_svg]:size-4 [&_svg]:stroke-[1.7]",
      )}
    >
      <Icon aria-hidden />
    </button>
  );
}
