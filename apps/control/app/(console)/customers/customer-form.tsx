"use client";

import { ActionBar, Panel, PanelBody, PanelHeader } from "@his/ui";
import type { Customer } from "@his/licence/api";
import { Save } from "lucide-react";
import { useActionState, useState } from "react";
import { type ActionResult, createCustomer, updateCustomer } from "@/app/actions";
import { Notice, SubmitButton, TextArea, TextField } from "@/components/fields";

/** Suggests an id from the English name: "Al-Noor Clinic" → "al-noor-clinic" */
const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");

/** Create (no `customer`) or edit a customer. */
export function CustomerForm({ customer, readOnly }: { customer?: Customer; readOnly?: boolean }) {
  const [result, action] = useActionState<ActionResult, FormData>(
    customer ? updateCustomer.bind(null, customer.id) : createCustomer,
    null,
  );
  const [nameEn, setNameEn] = useState(customer?.name.en ?? "");
  const [id, setId] = useState(customer?.id ?? "");
  const [idTouched, setIdTouched] = useState(false);
  const fields = result && !result.ok ? result.fields : {};
  const values: Record<string, string | undefined> = result && !result.ok ? result.values : {};

  return (
    <form action={action} className="flex flex-col gap-stack">
      <Panel>
        <PanelHeader level="h2" title="Identity" />
        <PanelBody className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Name (English)"
            name="name.en"
            required
            maxLength={120}
            value={nameEn}
            readOnly={readOnly}
            error={fields["name.en"]}
            onChange={(e) => {
              setNameEn(e.target.value);
              if (!customer && !idTouched) setId(slug(e.target.value));
            }}
          />
          <TextField
            label="Name (Arabic)"
            name="name.ar"
            required
            maxLength={120}
            dir="rtl"
            lang="ar"
            defaultValue={values["name.ar"] ?? customer?.name.ar}
            readOnly={readOnly}
            error={fields["name.ar"]}
          />
          {customer ? null : (
            <TextField
              label="Customer id"
              name="id"
              required
              value={id}
              onChange={(e) => {
                setIdTouched(true);
                setId(e.target.value);
              }}
              pattern="[a-z0-9](?:[a-z0-9\-]{0,38}[a-z0-9])?"
              hint="Permanent. Lowercase letters, digits and hyphens — it names the customer's build folder (customers/<id>)."
              error={fields.id}
              className="md:col-span-2"
              spellCheck={false}
              autoCapitalize="off"
            />
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader level="h2" title="Contact" />
        <PanelBody className="grid gap-4 md:grid-cols-3">
          <TextField label="Contact person" name="contactName" maxLength={120} defaultValue={values.contactName ?? customer?.contactName ?? ""} readOnly={readOnly} error={fields.contactName} />
          <TextField
            label="Contact e-mail"
            name="contactEmail"
            type="email"
            defaultValue={values.contactEmail ?? customer?.contactEmail ?? ""}
            readOnly={readOnly}
            error={fields.contactEmail}
          />
          <TextField label="Country" name="country" maxLength={60} defaultValue={values.country ?? customer?.country ?? ""} readOnly={readOnly} error={fields.country} />
          <TextArea
            label="Notes"
            name="notes"
            maxLength={2000}
            defaultValue={values.notes ?? customer?.notes ?? ""}
            readOnly={readOnly}
            error={fields.notes}
            hint="Contract reference, support arrangements — anything the next person needs."
            className="md:col-span-3"
          />
        </PanelBody>
      </Panel>

      {result && !result.ok && !Object.keys(fields).length ? <Notice tone="problem" title={result.error} /> : null}
      {result && !result.ok && Object.keys(fields).length ? (
        <Notice tone="problem" title="Some fields need a look" />
      ) : null}

      {readOnly ? null : (
        <ActionBar>
          <span role="status" className="truncate text-sm text-ink-3">
            {result?.ok ? result.message : customer ? "Changes are recorded in the activity log" : "Creates the customer and its build folder"}
          </span>
          <SubmitButton tone="primary" data-primary pendingText={customer ? "Saving…" : "Creating…"}>
            <Save aria-hidden />
            {customer ? "Save changes" : "Create customer"}
          </SubmitButton>
        </ActionBar>
      )}
    </form>
  );
}
