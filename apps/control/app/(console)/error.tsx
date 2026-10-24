"use client";

import { Button } from "@his/ui";
import { RotateCcw, ServerCrash } from "lucide-react";
import { EmptyState, Page } from "@/components/bits";

/*
 * A page could not load. Production builds hide the error's message, so the
 * likeliest cause is named either way: the licence server is not running.
 */
export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page narrow>
      <EmptyState
        icon={ServerCrash}
        title="This page could not be loaded"
        action={
          <Button tone="primary" onClick={reset}>
            <RotateCcw aria-hidden />
            Try again
          </Button>
        }
      >
        Most often the licence server is not running: start it with <code className="font-mono">npm run dev -w @his/licence-server</code>,
        then try again. Otherwise the details are in the control app&apos;s log{error.digest ? ` (reference ${error.digest})` : ""}.
      </EmptyState>
    </Page>
  );
}
