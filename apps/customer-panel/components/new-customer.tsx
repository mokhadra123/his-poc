"use client";

import { Button } from "@his/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { createCustomer } from "@/app/actions";
import { Notice, TextField } from "./fields";

export function NewCustomer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [id, setId] = useState("");
  const [en, setEn] = useState("");
  const [ar, setAr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startCreating] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    startCreating(async () => {
      const result = await createCustomer({ id, name: { en, ar } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.push(`/?customer=${encodeURIComponent(result.message)}`);
    });
  }

  return (
    <form
      onSubmit={submit}
      aria-label="New customer"
      className="flex flex-col gap-3 rounded-card border border-card-line bg-surface p-pad shadow-card"
    >
      <TextField
        label="Customer id"
        value={id}
        onChange={(e) => setId(e.target.value.trim())}
        required
        autoComplete="off"
        spellCheck={false}
        hint="Its folder under customers/: lowercase letters, digits and hyphens, e.g. al-noor."
      />
      <TextField label="Name (English)" value={en} onChange={(e) => setEn(e.target.value)} required maxLength={120} />
      <TextField
        label="Name (Arabic)"
        value={ar}
        onChange={(e) => setAr(e.target.value)}
        required
        maxLength={120}
        dir="rtl"
        lang="ar"
      />
      <p className="text-xs text-ink-3">Starts with no products and the default palette.</p>
      {error ? <Notice tone="problem" title={error} /> : null}
      <div className="flex gap-2">
        <Button tone="primary" type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </Button>
        <Button tone="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
