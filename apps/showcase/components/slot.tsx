import type { SlotName, SlotProps } from "@his/slots";
import { SLOTS } from "@/lib/slots.generated";

/*
 * An outlet in a core page. Whatever the composed customer plugged into it
 * (customers/<id>/customer.json → scripts/compose.mjs → lib/slots.generated.ts)
 * renders here, handed the outlet's props; with nothing plugged in it renders
 * nothing. The page never knows which customer that is.
 */
export function Slot<N extends SlotName>({ name, props }: { name: N; props: SlotProps[N] }) {
  const plugged = SLOTS[name];
  if (!plugged?.length) return null;
  return plugged.map(({ from, Component }) => (
    // display: contents marks where the content came from without adding a box
    <div key={from} className="contents" data-slot={name} data-slot-from={from}>
      <Component {...props} />
    </div>
  ));
}
