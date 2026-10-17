import type { ComponentType } from "react";
import type outlets from "../outlets.json";

/*
 * The outlets core pages offer to customer packages — the contract between
 * the core and every customer's own code.
 *
 * A core page renders <Slot name="…" props={…} /> at a fixed place. A customer
 * plugs a component into it from customers/<id>/customer.json; compose wires
 * it in for that customer's build only. Other customers get an empty outlet.
 *
 * Changing an outlet's props is a breaking change: every customer component
 * plugged into it stops type-checking, in the same pull request. Removing an
 * outlet makes compose refuse every customer that still uses it.
 */

export type Lang = "en" | "ar";

export type SlotProps = {
  /** Visit page, side panel, after medications. */
  "visit.side-panel": { patientId: string; visitId: string; lang: Lang };
};

export type SlotName = keyof SlotProps;

/** What compose generates for one build: each outlet's plugged components. */
export type SlotRegistry = {
  [K in SlotName]?: { from: string; Component: ComponentType<SlotProps[K]> }[];
};

// outlets.json (read by compose and verify-build) must name exactly these outlets
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type OutletsInSync = Assert<Same<SlotName, keyof typeof outlets>>;
