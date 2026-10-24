import { PageHeader, Panel, PanelBody, PanelHeader, Status, Table, Td, Th, Tr } from "@his/ui";
import type { SigningKey } from "@his/licence/api";
import { Code, Page } from "@/components/bits";
import { CopyButton } from "@/components/client-bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { can, currentUser, get } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { RunButton } from "../run-button";

export const metadata = { title: "Signing keys" };

export default async function KeysPage() {
  const [user, keys] = await Promise.all([currentUser(), get<SigningKey[]>("/api/keys")]);
  return (
    <>
      <ConsoleTopbar current="Signing keys" />
      <Page>
        <PageHeader
          title="Signing keys"
          subtitle="Licences are signed with the active key. Every build trusts the public keys below, embedded when it is composed."
          actions={
            can(user, "owner") ? (
              <RunButton
                action="rotate"
                label="Rotate key"
                confirm="Make a new signing key active? Licences already issued keep working, but builds composed before now will not trust licences signed with the new key until they are rebuilt."
              />
            ) : null
          }
        />
        <Panel className="mb-stack">
          <Table label="Signing keys">
            <thead>
              <tr>
                <Th>Key</Th>
                <Th>Fingerprint</Th>
                <Th>Created</Th>
                <Th>Licences signed</Th>
                <Th>Public key</Th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <Tr key={k.kid}>
                  <Td>
                    <span className="flex items-center gap-2">
                      <Code className="text-ink">{k.kid}</Code>
                      {k.active ? <Status state="done">active</Status> : <Status state="quiet">trusted</Status>}
                    </span>
                  </Td>
                  <Td>
                    <Code className="text-xs">{k.fingerprint}</Code>
                  </Td>
                  <Td tone="dim">{formatTime(k.createdAt)}</Td>
                  <Td>{k.licences}</Td>
                  <Td>
                    <CopyButton value={k.publicKey} label="Copy PEM" tone="ghost" />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <Panel>
          <PanelHeader level="h2" title="How the keys are kept" />
          <PanelBody className="flex flex-col gap-2 text-sm text-ink-2">
            <p>
              The private half of each key is a file only the licence server reads (<Code className="text-xs">apps/licence-server/.data/keys</Code>{" "}
              in this POC; a secret store in production). It is never in the database and never in a customer build.
            </p>
            <p>
              The public halves are published to <Code className="text-xs">packages/licence/trusted-keys.json</Code>; compose embeds them in
              every build, so a hospital cannot swap in a key of its own.
            </p>
            <p className="text-ink-3">Only an owner can rotate. Rotating never invalidates a licence already issued.</p>
          </PanelBody>
        </Panel>
      </Page>
    </>
  );
}
