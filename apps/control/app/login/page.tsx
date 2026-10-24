import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const { next, expired } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-gutter py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-10 place-items-center rounded-ctl bg-mark text-lg font-bold text-mark-ink">
            M
          </span>
          <div>
            <h1 className="text-xl leading-tight font-semibold text-heading-ink">HIS Control</h1>
            <p className="text-sm text-ink-3">Customers, installations and licences</p>
          </div>
        </div>
        <LoginForm next={typeof next === "string" ? next : "/"} expired={expired === "1"} />
        <p className="text-xs text-ink-3">
          For the Medlight team only. Licences signed here run hospitals: every action is recorded with your name.
        </p>
      </div>
    </main>
  );
}
