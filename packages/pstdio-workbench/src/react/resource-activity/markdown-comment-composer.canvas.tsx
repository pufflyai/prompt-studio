import { HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { ScopedPopover as Popover, Portal, Tooltip } from "@pstdio/ui";
import { MessageSquare } from "lucide-react";
import { useRef, useState } from "react";
import { MarkdownCommentComposer, type PassageCommentDraft } from "./markdown-comment-composer";

const quote = "fuller pipeline (with listening and demand)";
const SelectionCommentExample = ({ failPost = false }: { failPost?: boolean }) => {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [posted, setPosted] = useState<string>();
  const [draft, setDraft] = useState<PassageCommentDraft>(() => ({
    selection: {
      text: quote,
      start: { line: 1, column: 1 },
      end: { line: 1, column: quote.length + 1 },
      rect: new DOMRect(),
      anchor: { start: "demo-start", end: "demo-end" },
    },
    body: "",
    key: crypto.randomUUID(),
  }));
  const content = useRef<HTMLDivElement>(null);
  return (
    <Stack p="lg" gap="md" maxW="document-content">
      <Text textStyle="heading/S">Running e2e benchmarks</Text>
      <Text>
        <Text as="mark" bg="bg.drop/20">
          {quote}
        </Text>
      </Text>
      <HStack layerStyle="floatingBar" w="fit-content">
        <Popover.Root
          open={open}
          onOpenChange={({ open }) => {
            if (!busy) setOpen(open);
          }}
          initialFocusEl={() => content.current?.querySelector<HTMLElement>('[role="textbox"]') ?? null}
          positioning={{ placement: "bottom-start" }}
        >
          <Tooltip content="Comment">
            <Popover.Trigger asChild>
              <IconButton size="xs" variant="ghost" aria-label="Comment">
                <MessageSquare />
              </IconButton>
            </Popover.Trigger>
          </Tooltip>
          <Portal>
            <Popover.Positioner>
              <Popover.Content ref={content} aria-label="Comment on selection" w="popover-panel">
                <MarkdownCommentComposer
                  draft={draft}
                  busy={busy}
                  onBusyChange={setBusy}
                  onChange={setDraft}
                  onClose={() => setOpen(false)}
                  publish={async ({ body }) => {
                    if (failPost) throw new Error("Your text is kept. Try again.");
                    setPosted(body);
                  }}
                />
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
      </HStack>
      {posted && <Text>{posted}</Text>}
    </Stack>
  );
};
export default {
  title: "Resource Activity/Markdown selection comment",
  component: SelectionCommentExample,
  controls: { failPost: { type: "boolean", label: "Fail posting" } },
};
export const Compose = { render: (args: { failPost?: boolean }) => <SelectionCommentExample {...args} /> };
