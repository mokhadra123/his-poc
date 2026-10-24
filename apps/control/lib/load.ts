/* Loads one record for a page; a 404 from the licence server becomes the app's not-found page. */
import type { Customer, Installation, LicenceDetail } from "@his/licence/api";
import { notFound } from "next/navigation";
import { ControlApiError, get } from "./api";

async function one<T>(path: string): Promise<T> {
  try {
    return await get<T>(path);
  } catch (error) {
    if (error instanceof ControlApiError && error.status === 404) notFound();
    throw error;
  }
}

export const loadCustomer = (id: string) => one<Customer>(`/api/customers/${encodeURIComponent(id)}`);
export const loadInstallation = (id: string) => one<Installation>(`/api/installations/${encodeURIComponent(id)}`);
export const loadLicence = (id: string) => one<LicenceDetail>(`/api/licences/${encodeURIComponent(id)}`);
