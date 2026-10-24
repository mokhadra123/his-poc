import { SearchX } from "lucide-react";
import { EmptyState, LinkButton, Page } from "@/components/bits";

export default function NotFound() {
  return (
    <Page narrow>
      <EmptyState
        icon={SearchX}
        title="Nothing here"
        action={
          <LinkButton href="/" tone="primary">
            Back to the overview
          </LinkButton>
        }
      >
        The record may have been archived, or the link is mistyped.
      </EmptyState>
    </Page>
  );
}
