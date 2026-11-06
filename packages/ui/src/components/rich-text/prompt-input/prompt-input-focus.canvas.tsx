import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Info } from "lucide-react";
import { useState } from "react";
import { createSerializedPromptState } from "@/components/chat-ui/utils/editor-state";
import { ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { Tooltip } from "@/components/primitives/tooltip";
import { PromptEditor } from "./prompt-input";

const reason = "Stop active or queued work before deleting.";
const Preview = (props: { completion: "row" | "menu" | "selection" }) => {
  const [ready, setReady] = useState(false);
  const [completed, setCompleted] = useState(false);
  return (
    <Stack w="32rem" gap="sm">
      <Text textStyle="label/S/regular">A new composer is loading. Keep using the session list.</Text>
      <Box role="listbox" aria-label="Sessions">
        <ResourceContextMenu
          actions={[
            {
              key: "rename",
              label: "Rename session",
              onSelect: props.completion === "selection" ? () => setReady(true) : undefined,
            },
            {
              key: "delete",
              label: "Delete session",
              isDisabled: true,
              endContent: (
                <Tooltip content={reason}>
                  <Box
                    as="span"
                    tabIndex={0}
                    aria-label={reason}
                    onFocus={() => {
                      if (props.completion === "menu") setReady(true);
                    }}
                  >
                    <Info size={14} />
                  </Box>
                </Tooltip>
              ),
            },
          ]}
        >
          <Button
            role="option"
            aria-selected={false}
            variant="subtle"
            onFocus={() => {
              if (props.completion === "row") setReady(true);
            }}
          >
            Waiting for input
          </Button>
        </ResourceContextMenu>
      </Box>
      {(props.completion !== "selection" || ready) && (
        <PromptEditor
          defaultState={createSerializedPromptState("")}
          isEditable={ready}
          focusRequested={!completed}
          onFocusRequestComplete={() => setCompleted(true)}
        />
      )}
      <Text role="status">{completed ? "Loading finished" : "Composer loading"}</Text>
    </Stack>
  );
};
export default {
  title: "Design system/Patterns/Editors/Prompt editor/Focus while loading",
  component: Preview,
  description:
    "Synthetic loading completes when the session row or its Info explanation gets focus, or when Rename is selected. Keep chosen focus in an open menu; after selecting an action, the ready composer accepts input. Open the row menu with ContextMenu. The product adds no control or appearance.",
} satisfies CanvasMeta;
export const ChosenRow: CanvasFrame = { args: { completion: "row" } };
export const ChosenMenuHelp: CanvasFrame = { args: { completion: "menu" } };
export const SelectedMenuAction: CanvasFrame = { args: { completion: "selection" } };
