"use server";

/*
 * Everything the browser can ask the panel to do. Inputs are untrusted —
 * checked here whatever the UI allowed — and only these operations exist:
 * create and save a customer, compose, compose & run, stop.
 */
import { revalidatePath } from "next/cache";
import { checkDraft } from "@/lib/server/compose";
import { buildDraft, createCustomer as create, getCustomer, parseEdit, writeCustomer } from "@/lib/server/customers";
import { readProducts } from "@/lib/server/products";
import { findRepoRoot, PanelError } from "@/lib/server/repo";
import { getRunner } from "@/lib/server/runner";
import type { ActionResult } from "@/lib/types";

async function attempt(work: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await work() };
  } catch (error) {
    if (error instanceof PanelError) return { ok: false, error: error.message, output: error.output };
    console.error(error);
    return { ok: false, error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** A customer that exists and can be edited — the browser only ever names one by id. */
function existingCustomer(root: string, id: unknown): string {
  if (typeof id !== "string") throw new PanelError("No customer selected");
  return getCustomer(root, id).id;
}

/** On success the message is the new customer's id. */
export async function createCustomer(input: unknown): Promise<ActionResult> {
  return attempt(async () => {
    const config = create(findRepoRoot(), input);
    revalidatePath("/");
    return config.id;
  });
}

export async function saveCustomer(id: unknown, input: unknown): Promise<ActionResult> {
  return attempt(async () => {
    const root = findRepoRoot();
    const customerId = existingCustomer(root, id);
    // parse the edit the browser sent, check it against the products there are, and build a draft customer.json
    const parsed = parseEdit(input, readProducts(root));
    if (!parsed.ok) throw new PanelError(parsed.errors.join("\n"));
    // build the draft
    const draft = buildDraft(root, customerId, parsed.value);
    // check the draft against the products there are, and if it would fail to compose, don't save it
    const check = await checkDraft(root, customerId, draft);
    // if the draft would fail to compose, don't save it
    if (!check.ok) throw new PanelError("Not saved — compose would fail with this configuration:", check.output);
    writeCustomer(root, customerId, draft);
    revalidatePath("/");
    return `Saved customers/${customerId}/customer.json`;
  });
}

export async function runAction(action: unknown, id: unknown): Promise<ActionResult> {
  return attempt(async () => {
    const runner = getRunner();
    if (action === "stop") {
      await runner.stop();
      return "Stopped the showcase";
    }
    if (action !== "compose" && action !== "start") throw new PanelError("Unknown action");
    const customerId = existingCustomer(findRepoRoot(), id);
    const result = action === "compose" ? await runner.compose(customerId) : await runner.start(customerId);
    if (!result.ok) throw new PanelError(`Compose failed for "${customerId}" (exit ${result.exitCode ?? "none"})`, result.output);
    revalidatePath("/");
    return action === "compose" ? `Composed "${customerId}"` : `Composed "${customerId}" — starting the showcase…`;
  });
}
