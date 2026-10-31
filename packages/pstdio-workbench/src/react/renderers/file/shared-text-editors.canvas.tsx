import { Box, Button, Flex, Spinner, Stack, Text, Textarea } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { DocumentParticipants } from "@pstdio/ui";
import { LazyMarkdownEditor } from "@pstdio/ui/rich-text";
import { useEffect, useState } from "react";
import * as Y from "yjs";

const initial = "# Build together\n\nStart with the next step.";
const modes = [
  "Editing",
  "Saving",
  "Reconnecting",
  "Restoring editing",
  "Draft recovery",
  "Draft waiting",
  "Read only",
  "Close blocked",
  "Retired source",
  "Projection failed",
] as const;
type Mode = (typeof modes)[number];
const messages: Partial<Record<Mode, string>> = {
  Saving: "Saving changes…",
  Reconnecting: "Changes are waiting to be saved.",
  "Restoring editing": "Finishing your text…",
  "Draft recovery": "Your draft is kept here.",
  "Draft waiting": "Your draft is waiting to be saved.",
  "Read only": "This document is read only.",
  "Close blocked": "Finish or cancel your text draft before closing.",
  "Retired source": "This source was removed. Your unsaved text is still available here.",
  "Projection failed": "Your text is saved. Its file could not be updated.",
};
/** A local design fixture. No project data, host connection or persistence is used. */
export const SharedTextEditors = () => {
  const [mode, setMode] = useState<Mode>("Editing");
  const [document] = useState(() => {
    const document = new Y.Doc();
    document.getText("content").insert(0, initial);
    return document;
  });
  const [content, setContent] = useState(initial);
  const [draft] = useState(() => new Y.Doc());
  useEffect(() => {
    const changed = () => setContent(document.getText("content").toString());
    document.on("update", changed);
    return () => {
      document.off("update", changed);
      document.destroy();
      draft.destroy();
    };
  }, [document, draft]);
  const [closed, setClosed] = useState(false);
  const recovering = mode === "Draft recovery" || mode === "Draft waiting";
  const preview = recovering ? draft : document;
  const editable = mode !== "Read only" && mode !== "Retired source" && mode !== "Restoring editing" && !recovering;
  const message = messages[mode];
  const select = (next: Mode) => {
    if (next === "Draft recovery" || next === "Draft waiting") {
      const text = draft.getText("content");
      draft.transact(() => {
        text.delete(0, text.length);
        text.insert(0, `${document.getText("content").toString()}\n\nUnsent draft…`);
      });
    }
    setMode(next);
    setClosed(false);
  };
  const retry = () => {
    if (recovering) {
      const text = document.getText("content");
      document.transact(() => {
        text.delete(0, text.length);
        text.insert(0, draft.getText("content").toString());
      });
    }
    setMode("Editing");
  };
  return (
    <Stack gap="md" p="md">
      <Flex gap="xs" wrap="wrap">
        {modes.map((value) => (
          <Button key={value} size="xs" variant={mode === value ? "subtle" : "ghost"} onClick={() => select(value)}>
            {value}
          </Button>
        ))}
      </Flex>
      <Flex justify="space-between" align="center" gap="md">
        <Text textStyle="label/M/medium">Notes / Build together</Text>
        <DocumentParticipants
          label="Other editors"
          participants={
            closed
              ? []
              : [
                  { id: "alex", label: "Alex", color: "blue" },
                  { id: "sam", label: "Sam", color: "purple" },
                ]
          }
        />
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            if (
              !(
                [
                  "Close blocked",
                  "Reconnecting",
                  "Saving",
                  "Restoring editing",
                  "Draft recovery",
                  "Draft waiting",
                ] as Mode[]
              ).includes(mode)
            )
              setClosed(true);
          }}
        >
          {closed ? "Closed" : "Close tab"}
        </Button>
      </Flex>
      {closed ? (
        <Button size="xs" alignSelf="start" onClick={() => setClosed(false)}>
          Reopen document
        </Button>
      ) : (
        <Flex gap="md" align="stretch">
          <Stack flex="1" minW="0" gap="xs">
            <Text textStyle="label/S/regular" color="fg.muted">
              Markdown
            </Text>
            {message && (
              <EditorNotice
                key={mode}
                mode={mode}
                message={message}
                retry={retry}
                discard={() => setMode("Read only")}
              />
            )}
            <Box h="lg" bg="bg">
              <LazyMarkdownEditor defaultState="" collaboration={{ document: preview }} isEditable={editable} />
            </Box>
          </Stack>
          <Stack flex="1" minW="0" gap="xs">
            <Text textStyle="label/S/regular" color="fg.muted">
              Installed text editor
            </Text>
            {message && (
              <EditorNotice
                key={mode}
                mode={mode}
                message={message}
                retry={retry}
                discard={() => setMode("Read only")}
              />
            )}
            <Textarea
              aria-label="Installed editor source"
              value={recovering ? draft.getText("content").toString() : content}
              readOnly={!editable}
              onChange={(event) =>
                document.transact(() => {
                  const text = document.getText("content");
                  text.delete(0, text.length);
                  text.insert(0, event.target.value);
                })
              }
              textStyle="mono/M"
              h="lg"
            />
          </Stack>
        </Flex>
      )}
    </Stack>
  );
};
const EditorNotice = (props: { mode: Mode; message: string; retry: () => void; discard: () => void }) => {
  const { mode, message, retry, discard } = props;
  const [discardError, setDiscardError] = useState(false);
  const recovering = mode === "Draft recovery" || mode === "Draft waiting";
  return (
    <Stack gap="xs" bg="bg.muted" px="sm" py="xs">
      <Flex gap="sm" align="center" justify="space-between">
        <Flex align="center" gap="xs">
          {(mode === "Saving" ||
            mode === "Reconnecting" ||
            mode === "Restoring editing" ||
            mode === "Draft waiting") && <Spinner size="xs" color="fg.muted" aria-label={mode} />}
          <Text color="fg.muted" textStyle="label/S/regular">
            {message}
          </Text>
        </Flex>
        {(mode === "Reconnecting" || mode === "Projection failed" || recovering) && (
          <Flex gap="xs">
            {recovering && (
              <Button
                size="2xs"
                variant="ghost"
                onClick={() => {
                  if (mode === "Draft waiting") setDiscardError(true);
                  else discard();
                }}
              >
                Discard draft
              </Button>
            )}
            <Button size="2xs" variant="subtle" onClick={retry}>
              Retry
            </Button>
          </Flex>
        )}
        {mode === "Close blocked" && (
          <Button size="2xs" variant="subtle" onClick={retry}>
            Keep editing
          </Button>
        )}
      </Flex>
      {discardError && (
        <Text textStyle="label/S/regular" color="fg.error">
          Wait for this save before discarding the draft.
        </Text>
      )}
    </Stack>
  );
};

const meta = {
  title: "pstdio-workbench/File editor/Public text sessions",
  component: SharedTextEditors,
  fullscreen: true,
  description:
    "Native and installed text presentations share admission, close guards, local save status and friendly presence. Synthetic design state only; no host or project data is changed.",
} satisfies CanvasMeta<typeof SharedTextEditors>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const LifecycleAndRecovery: Story = {
  id: "pstdio-workbench-file-editor-public-text-sessions--lifecycle-and-recovery",
};
