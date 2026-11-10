import { Box, Button, HStack, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { Cat, GitBranch, Paperclip } from "lucide-react";
import { type ReactNode, useState } from "react";
import { AttachmentList } from "../../components/chat-ui/components/attachment-list";
import { ChatInput } from "../../components/chat-ui/components/chat-input";
import { ChatWorkspaceHub } from "../../components/chat-ui/components/workspace-hub";
import { createSerializedPromptState } from "../../components/chat-ui/utils/editor-state";
import { chatComposerRecipe } from "../../theme/recipes/chat-composer";

interface ContributionProps {
  showBounds: boolean;
  narrow: boolean;
  pet: boolean;
  workspaces: boolean;
  harness: boolean;
  footer: boolean;
  reducedMotion: boolean;
  context: string;
  status: string;
  time: number;
}

const Point = (props: { name: string; shape: string; visible: boolean; children: ReactNode }) => (
  <Stack gap="2xs" minW="0" border={props.visible ? "accent" : undefined} p={props.visible ? "2xs" : "0"}>
    {props.visible && (
      <Text textStyle="label/XS/regular" color="fg.muted">
        {props.name} · {props.shape}
      </Text>
    )}
    {props.children}
  </Stack>
);

const petProgress = (time: number, reducedMotion: boolean) => {
  const phase = reducedMotion ? 0 : (((time % 8) + 8) % 8) / 8;
  return phase < 0.5 ? phase * 2 : (1 - phase) * 2;
};

export const SessionContributions = (props: ContributionProps) => {
  const { showBounds, narrow, pet, workspaces, harness, footer, reducedMotion, context, time } = props;
  const [text, setText] = useState("Help me review these changes.");
  const [files, setFiles] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState("feature/contributions");
  const [planning, setPlanning] = useState(false);
  const [harnessName, setHarnessName] = useState("Codex");
  const [receipt, setReceipt] = useState("");
  const [recoveredStatus, setRecoveredStatus] = useState<string | null>(null);
  const status = recoveredStatus === props.status ? "ready" : props.status;
  const styles = useSlotRecipe({ recipe: chatComposerRecipe })({ workspace: workspaces || footer });
  const progress = petProgress(time, reducedMotion);
  const saved = context === "saved";

  return (
    <Stack p="md" gap="md" width="full" maxW={narrow ? "sm" : "3xl"}>
      <Stack gap="xs">
        <Text textStyle="label/L/medium">Session contribution points</Text>
        <Text textStyle="label/S/regular" color="fg.muted">
          Prototype only. Toggle contributions in Frame editor while typing; use Play to move the pet.
        </Text>
        <HStack flexWrap="wrap" gap="xs">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setHarnessName(harnessName === "Codex" ? "Claude Code" : "Codex")}
          >
            Harness: {harnessName}
          </Button>
          <Text textStyle="label/XS/regular" color="fg.muted">
            {saved ? "Saved session · workspace fixed" : "New session · workspace selectable"}
          </Text>
        </HStack>
      </Stack>

      <Stack css={styles.root}>
        {pet && (
          <Point name="chat.input.top" shape="transparent surface" visible={showBounds}>
            <Box height="10" pointerEvents="none" aria-hidden="true" overflow="hidden">
              <svg viewBox="0 0 640 36" width="100%" height="100%" preserveAspectRatio="none">
                <title>Decorative pet moving along the input top</title>
                <g transform={`translate(${16 + progress * 584} 6)`}>
                  <Cat width={24} height={24} />
                </g>
              </svg>
            </Box>
          </Point>
        )}

        <Box className="ps-chat-composer__workspace" css={styles.workspace}>
          <Box display={workspaces ? undefined : "none"}>
            <Point name="chat.workspace.content" shape="full-width block" visible={showBounds}>
              <ChatWorkspaceHub
                workspaceControl={
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={saved}
                    onClick={() =>
                      setWorkspace(workspace === "feature/contributions" ? "Project folder" : "feature/contributions")
                    }
                  >
                    <GitBranch size={14} />
                    <Text truncate>{saved ? "feature/saved-session" : workspace}</Text>
                  </Button>
                }
                additions={27}
                deletions={8}
                status={status === "error" || status === "loading" ? status : "ready"}
                statusLabel={status === "loading" ? "Loading workspace…" : "Workspace unavailable"}
                action={
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      status === "error"
                        ? setRecoveredStatus(props.status)
                        : setReceipt("Open workspace (local preview)")
                    }
                  >
                    {status === "error" ? "Retry" : "Open"}
                  </Button>
                }
              />
            </Point>
          </Box>

          <ChatInput
            defaultState={createSerializedPromptState(text)}
            onChange={setText}
            onSubmit={(message) => {
              setReceipt(`Preview sent with ${files.length} attachment(s): ${message}`);
              setText("");
            }}
            attachedResources={files}
            onClearAttachments={() => setFiles([])}
            autoFocus={false}
            placeholder="Ask anything…"
            attachmentList={
              files.length ? (
                <AttachmentList
                  attachments={files}
                  onRemove={(file) => setFiles(files.filter((item) => item !== file))}
                />
              ) : undefined
            }
            attachmentActions={
              <Button size="xs" variant="ghost" onClick={() => setFiles(["review-notes.md"])}>
                <Paperclip size={14} /> Files
              </Button>
            }
            actions={
              harness ? (
                <HStack gap="2xs" border={showBounds ? "accent" : undefined}>
                  {showBounds && (
                    <Text textStyle="label/XS/regular" color="fg.muted">
                      chat.input.harness · inline row
                    </Text>
                  )}
                  <Button size="xs" variant="ghost" aria-pressed={planning} onClick={() => setPlanning(!planning)}>
                    {planning ? "Plan" : "Build"}
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setReceipt(`${harnessName} permissions (local preview)`)}
                  >
                    Permissions
                  </Button>
                </HStack>
              ) : undefined
            }
          />

          <Box display={footer ? undefined : "none"}>
            <Point name="chat.workspace.bottom" shape="full-width footer block" visible={showBounds}>
              <HStack p="xs" justify="space-between" flexWrap="wrap">
                <Text textStyle="label/S/regular">PS-58 · In progress</Text>
                <Button size="xs" variant="ghost" onClick={() => setReceipt("Open linked ticket (local preview)")}>
                  Open ticket
                </Button>
              </HStack>
              <HStack p="xs" justify="space-between" flexWrap="wrap">
                <Text textStyle="label/XS/regular" color="fg.muted">
                  Another extension · review checklist
                </Text>
                <Button size="xs" variant="ghost" onClick={() => setReceipt("Checklist updated (local preview)")}>
                  Mark reviewed
                </Button>
              </HStack>
            </Point>
          </Box>
        </Box>
      </Stack>

      <Text textStyle="label/XS/regular" color="fg.muted" aria-live="polite">
        {receipt || "All actions use local sample state. Files and Send remain core controls."}
      </Text>
    </Stack>
  );
};
