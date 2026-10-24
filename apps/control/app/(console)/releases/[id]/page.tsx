import { PageHeader, Status } from "@his/ui";
import type { ReleaseDetail } from "@his/licence/api";
import { Code, Page } from "@/components/bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { can, ControlApiError, currentUser, get } from "@/lib/api";
import { RELEASE } from "@/lib/format";
import { notFound } from "next/navigation";
import { ReleaseLive } from "./release-live";

export const metadata = { title: "Release" };

export default async function ReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  let release: ReleaseDetail;
  try {
    release = await get<ReleaseDetail>(`/api/releases/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ControlApiError && error.status === 404) notFound();
    throw error;
  }
  const s = RELEASE[release.status];

  return (
    <>
      <ConsoleTopbar
        crumbs={[
          { href: "/releases", label: "Releases" },
          { href: `/customers/${release.customerId}/installations`, label: release.customerName.en },
        ]}
        current={release.installationLabel}
      />
      <Page>
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-3">
              Release for {release.customerName.en}
              <Status state={s.state}>{s.label}</Status>
            </span>
          }
          subtitle={
            <>
              {release.installationLabel} ({release.connectivity}) · {release.version ? <Code>{release.version}</Code> : release.status === "running" ? "the version is given when it finishes" : "no version: not built"}
            </>
          }
        />
        <ReleaseLive initial={release} issuer={can(user, "issuer")} />
      </Page>
    </>
  );
}
