"use server";

import { revalidatePath } from "next/cache";
import { getDict, getLang } from "@/lib/i18n";
import { installLicence } from "@/lib/licence";
import { fill, formatDay, ltr } from "@/lib/licence-text";

export type InstallState = { ok: boolean; title: string; detail?: string } | null;

/** a licence file is a few kilobytes */
const MAX_BYTES = 64 * 1024;

/**
 * The licence page's upload. In this POC anyone who can open the page may
 * install; in HIS this is an administrator's permission, checked here first.
 */
export async function installLicenceAction(_previous: InstallState, form: FormData): Promise<InstallState> {
  const lang = await getLang();
  const t = (await getDict()).licence.install;
  const file = form.get("licence");
  if (!(file instanceof File) || file.size === 0) return { ok: false, title: t.noFile };
  if (file.size > MAX_BYTES) return { ok: false, title: t.tooLarge };

  const result = installLicence(await file.text());
  if (result.ok) revalidatePath("/", "layout");
  return {
    ok: result.ok,
    title: fill(t.results[result.code], {
      id: ltr(result.detail ?? ""),
      date: result.payload ? formatDay(result.payload.expiresOn, lang) : "",
    }),
    // what exactly is wrong with the file's shape, for whoever sends it back
    detail: result.code === "malformed" ? result.detail : undefined,
  };
}
