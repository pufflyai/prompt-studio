import { Button, Stack, Text } from "@chakra-ui/react";
import { GitBranch } from "lucide-react";
import { useState } from "react";
import { PopoverHeader } from "../../components/overlays/popover-header";
import { ScopedPopover as Popover } from "../../utils/scoped-overlays";
import { Portal } from "../../utils/ui-scope";

interface RevisionProps {
  revision: "accepted" | "branch";
  onRevision: (revision: "accepted" | "branch") => void;
}
export function BookRevision(props: RevisionProps) {
  const { revision, onRevision } = props;
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
      <Popover.Trigger asChild>
        <Button size="xs" variant="ghost" aria-label="Book revision">
          <GitBranch />
          {revision === "accepted" ? "main" : "working branch"}
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <PopoverHeader icon={<GitBranch />} title={<Popover.Title>Book revision</Popover.Title>} />
            <Popover.Body>
              <Stack gap="sm">
                <Button
                  size="xs"
                  variant={revision === "accepted" ? "outline" : "ghost"}
                  onClick={() => {
                    onRevision("accepted");
                    setOpen(false);
                  }}
                >
                  main · accepted intent
                </Button>
                <Button
                  size="xs"
                  variant={revision === "branch" ? "outline" : "ghost"}
                  onClick={() => {
                    onRevision("branch");
                    setOpen(false);
                  }}
                >
                  working branch · proposed edits
                </Button>
                <Text textStyle="paragraph/S/regular">
                  Both views read revisions of the same repository book. Local suggestions do not change either revision
                  until applied.
                </Text>
                <Text color="fg.muted" textStyle="paragraph/XS/regular">
                  Prototype: synthetic records and in-memory branch changes. No repository files, Git branches, or pull
                  requests are changed.
                </Text>
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
