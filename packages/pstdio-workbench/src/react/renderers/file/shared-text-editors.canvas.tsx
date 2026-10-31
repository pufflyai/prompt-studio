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
  "Read only",
  "Close blocked",
  "Retired source",
  "Projection failed",
] as const;
type Mode = (typeof modes)[number];
const messages: Partial<Record<Mode, string>> = {
  Saving: "Saving changes…",
  Reconnecting: "Changes are waiting to be saved.",
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
  useEffect(() => {
    const changed = () => setContent(document.getText("content").toString());
    document.on("update", changed);
    return () => {
      document.off("update", changed);
      document.destroy();
    };
  }, [document]);
  const [closed, setClosed] = useState(false);
  const editable = mode !== "Read only" && mode !== "Retired source";
  const message = messages[mode];
  const select = (next: Mode) => {
    setMode(next);
    setClosed(false);
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
            if (mode !== "Close blocked" && mode !== "Reconnecting" && mode !== "Saving") setClosed(true);
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
            {message && <EditorNotice mode={mode} message={message} retry={() => setMode("Editing")} />}
            <Box h="lg" bg="bg">
              <LazyMarkdownEditor defaultState="" collaboration={{ document }} isEditable={editable} />
            </Box>
          </Stack>
          <Stack flex="1" minW="0" gap="xs">
            <Text textStyle="label/S/regular" color="fg.muted">
              Installed text editor
            </Text>
            {message && <EditorNotice mode={mode} message={message} retry={() => setMode("Editing")} />}
            <Textarea
              aria-label="Installed editor source"
              value={content}
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
const EditorNotice = (props: { mode: Mode; message: string; retry: () => void }) => {
  const { mode, message, retry } = props;
  return (
    <Flex gap="sm" align="center" justify="space-between" bg="bg.muted" px="sm" py="xs">
      <Flex align="center" gap="xs">
        {(mode === "Saving" || mode === "Reconnecting") && <Spinner size="xs" color="fg.muted" aria-label={mode} />}
        <Text color="fg.muted" textStyle="label/S/regular">
          {message}
        </Text>
      </Flex>
      {(mode === "Reconnecting" || mode === "Projection failed") && (
        <Button size="2xs" variant="subtle" onClick={retry}>
          Retry
        </Button>
      )}
      {mode === "Close blocked" && (
        <Button size="2xs" variant="subtle" onClick={retry}>
          Keep editing
        </Button>
      )}
    </Flex>
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
