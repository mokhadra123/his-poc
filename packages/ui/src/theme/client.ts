"use client";

import { useSyncExternalStore } from "react";
import { type Prefs, readHtmlPref } from "./index";

type HtmlPref = "theme" | "mode" | "density" | "nav" | "rail";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "data-density", "data-nav", "data-rail"],
  });
  return () => observer.disconnect();
}

/**
 * <html> is the single source of truth for a preference. Reading it through
 * this hook keeps every toggle honest after back/forward navigation, a
 * language refresh, or a change made by another component.
 */
export function usePref<K extends HtmlPref>(key: K, serverValue: Prefs[K]): Prefs[K] {
  return useSyncExternalStore(
    subscribe,
    () => readHtmlPref(key) ?? serverValue,
    () => serverValue,
  );
}
