"use client";

import { Panel, PanelBody } from "@his/ui";
import { LogIn } from "lucide-react";
import { useActionState } from "react";
import { signIn } from "@/app/actions";
import { Notice, SubmitButton, TextField } from "@/components/fields";

export function LoginForm({ next, expired }: { next: string; expired: boolean }) {
  const [result, action] = useActionState(signIn, null);
  const values = result && !result.ok ? result.values : {};
  return (
    <Panel>
      <PanelBody>
        <form action={action} className="flex flex-col gap-4">
          {expired && !result ? <Notice title="Your session ended. Sign in again to continue." /> : null}
          {result && !result.ok ? <Notice tone="problem" title={result.error} /> : null}
          <input type="hidden" name="next" value={next} />
          <TextField label="E-mail" name="email" type="email" autoComplete="username" required autoFocus={!values.email} defaultValue={values.email} />
          <TextField label="Password" name="password" type="password" autoComplete="current-password" required autoFocus={Boolean(values.email)} />
          <SubmitButton tone="primary" pendingText="Signing in…" className="w-full">
            <LogIn aria-hidden />
            Sign in
          </SubmitButton>
        </form>
      </PanelBody>
    </Panel>
  );
}
