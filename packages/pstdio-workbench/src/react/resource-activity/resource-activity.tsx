import { Box, Button, Dialog, HStack, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import type { ResourceActivityEntry, ResourceRef } from "@pstdio/sdk/extensions";
import { Activity, AlertMessage } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import type { WorkbenchCore } from "../../core";
import type { ActivityTarget, ResourceActivityBinding } from "../../core/registries/resources/resource-activity";
import { useResourceActivity } from "./use-resource-activity";

const EntryBody = (props: {
  entry: ResourceActivityEntry;
  controller: ReturnType<typeof useResourceActivity>;
  workbench: WorkbenchCore;
}) => {
  const { entry, controller, workbench } = props;
  return (
    <Stack gap="xs">
      {entry.quote && <Text color="fg.muted">“{entry.quote}”</Text>}
      {entry.kind !== "comment" && (
        <Text textStyle="label/S/medium">
          {
            {
              review: entry.verdict === "passed" ? "Review · Approved" : "Review · Changes requested",
              implementation: "Implementation",
              change: "Change",
              comment: "Comment",
            }[entry.kind]
          }
        </Text>
      )}
      <Text whiteSpace="pre-wrap" overflowWrap="anywhere">
        {entry.body}
      </Text>
      {entry.revision && (
        <Text color="fg.muted">
          Revision {entry.revision.revision} · {entry.revision.headSha.slice(0, 8)}
        </Text>
      )}
      {entry.changes?.map((change, index) => (
        <Text key={index}>
          {change.label ?? change.field}: {change.beforeLabel ?? JSON.stringify(change.before)} →{" "}
          {change.afterLabel ?? JSON.stringify(change.after)}
        </Text>
      ))}
      {entry.validation?.map((validation, index) => (
        <Text key={index}>
          {validation.command} — {validation.result}
        </Text>
      ))}
      {entry.findings?.map((finding, index) => (
        <Text key={index}>
          {finding.severity}
          {finding.path ? ` · ${finding.path}:${finding.startLine}` : ""}: {finding.body}
        </Text>
      ))}
      {[entry.unfinished, entry.shortcuts, entry.blockers].filter(Boolean).map((detail, index) => (
        <Text key={index}>{detail}</Text>
      ))}
      {entry.attachments.map((file) => (
        <Button
          key={file.id}
          variant="ghost"
          alignSelf="start"
          onClick={() =>
            void controller.action(async () => {
              const result = await controller.api.readAttachment(controller.resource, file.id);
              const url = URL.createObjectURL(new Blob([new Uint8Array(result.data)], { type: file.mimeType }));
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = file.name;
              anchor.click();
              setTimeout(() => URL.revokeObjectURL(url), 0);
            })
          }
        >
          {file.name}
        </Button>
      ))}
      {entry.sessionId && (
        <Button
          variant="ghost"
          alignSelf="start"
          onClick={() =>
            void workbench.navigation.openTarget({
              kind: "page",
              page: { kind: "page", extensionId: "pstdio", id: "session" },
              resource: {
                type: "session",
                id: entry.sessionId!,
                projectId: entry.resource.projectId,
                extensionId: "pstdio",
              },
            })
          }
        >
          Open session
        </Button>
      )}
      {entry.handoffError && (
        <AlertMessage
          status="error"
          title="Session could not start"
          endElement={
            <Button
              disabled={controller.busy}
              onClick={() =>
                void controller.action(async () => {
                  await controller.api.handoff(controller.resource, entry.id);
                  await controller.refresh();
                })
              }
            >
              Retry handoff
            </Button>
          }
        >
          {entry.handoffError}
        </AlertMessage>
      )}
    </Stack>
  );
};
export const WorkbenchResourceActivity = (props: {
  workbench: WorkbenchCore;
  binding: ResourceActivityBinding;
  resource: ResourceRef;
  visible: boolean;
}) => {
  const { workbench, binding, resource, visible } = props;
  const controller = useResourceActivity(workbench, binding, resource, visible);
  const [replyTo, setReplyTo] = useState<string>();
  const [targets, setTargets] = useState<ActivityTarget[]>([]);
  const [confirm, setConfirm] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!controller.cursor || !sentinel.current || !visible) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void controller.refresh(true);
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [controller.cursor, visible, controller.refresh]);
  const composer = (
    <Activity.Composer
      variant="compact"
      value={controller.draft.body}
      placeholder={replyTo ? "Write a reply…" : "Leave a comment…"}
      aria-busy={controller.busy}
      onChange={(body) => controller.changeDraft({ ...controller.draft, body, key: crypto.randomUUID() })}
      onSubmit={() => {
        if (controller.busy) return;
        if (controller.draft.target && !replyTo) setConfirm(true);
        else
          void controller.publish(replyTo).then((entry) => {
            if (entry) setReplyTo(undefined);
          });
      }}
      onAttach={() => upload.current?.click()}
      actions={
        !replyTo && binding.targets ? (
          <Menu.Root
            onOpenChange={({ open }) => {
              if (open)
                void binding.targets!()
                  .then(setTargets)
                  .catch((error) => void controller.action(() => Promise.reject(error)));
            }}
          >
            <Menu.Trigger asChild>
              <Button variant="ghost" size="xs">
                {controller.draft.target ? "Agent selected" : "Assign agent"}
              </Button>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item
                    value="none"
                    onClick={() =>
                      controller.changeDraft({ ...controller.draft, target: undefined, key: crypto.randomUUID() })
                    }
                  >
                    Comment only
                  </Menu.Item>
                  {targets.map((target) => (
                    <Menu.Item
                      key={`${target.harnessId}/${target.modelId}`}
                      value={`${target.harnessId}/${target.modelId}`}
                      onClick={() =>
                        controller.changeDraft({
                          ...controller.draft,
                          target: { harnessId: target.harnessId, modelId: target.modelId },
                          key: crypto.randomUUID(),
                        })
                      }
                    >
                      {target.label}
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        ) : undefined
      }
    />
  );
  return (
    <Box p="md" flexShrink="0">
      <Activity.Root aria-label="Resource activity">
        <Activity.Header title={`Activity${controller.unresolved ? ` · ${controller.unresolved} unresolved` : ""}`} />
        {controller.error && (
          <AlertMessage
            status="error"
            title="Activity unavailable"
            endElement={<Button onClick={() => void controller.refresh()}>Refresh</Button>}
          >
            {controller.error}
          </AlertMessage>
        )}
        <Activity.Feed>
          {controller.items
            .filter((entry) => !entry.replyToId)
            .map((entry) => (
              <Activity.Comment
                key={entry.id}
                actor={{ name: entry.author.name }}
                timestamp={new Date(entry.createdAt).toLocaleString()}
                actions={
                  entry.kind === "comment" && controller.capabilities.comments ? (
                    <HStack>
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={controller.busy}
                        onClick={() =>
                          void controller.action(async () => {
                            await controller.api.resolve(resource, entry.id, !entry.resolved);
                            await controller.refresh();
                          })
                        }
                      >
                        {entry.resolved ? "Reopen" : "Resolve"}
                      </Button>
                      <Button variant="ghost" size="xs" onClick={() => setReplyTo(entry.id)}>
                        Reply
                      </Button>
                    </HStack>
                  ) : undefined
                }
                replies={controller.items
                  .filter((reply) => reply.replyToId === entry.id)
                  .map((reply) => (
                    <Activity.Reply key={reply.id} actor={{ name: reply.author.name }}>
                      <EntryBody entry={reply} controller={controller} workbench={workbench} />
                    </Activity.Reply>
                  ))}
                composer={
                  replyTo === entry.id ? (
                    <Stack>
                      {composer}
                      <Button variant="ghost" onClick={() => setReplyTo(undefined)}>
                        Cancel reply
                      </Button>
                    </Stack>
                  ) : undefined
                }
              >
                <EntryBody entry={entry} controller={controller} workbench={workbench} />
              </Activity.Comment>
            ))}
          {!controller.items.length && <Text color="fg.muted">No activity yet</Text>}
        </Activity.Feed>
        {controller.cursor && <Box ref={sentinel} role="status" aria-label="Loading earlier activity" />}
        {controller.capabilities.comments && !replyTo && composer}
        {controller.draft.attachmentIds.length > 0 && (
          <Text color="fg.muted">{controller.draft.attachmentIds.length} attachments</Text>
        )}
        <input
          hidden
          type="file"
          ref={upload}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void controller.attach(file);
          }}
        />
        <Dialog.Root open={confirm} onOpenChange={({ open }) => setConfirm(open)}>
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content>
                <Dialog.Header>
                  <Dialog.Title>Start an agent session?</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body>
                  Save this comment and send the resource and relevant discussion to the selected agent.
                </Dialog.Body>
                <Dialog.Footer>
                  <Button variant="ghost" onClick={() => setConfirm(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={controller.busy}
                    onClick={() => {
                      setConfirm(false);
                      void controller.publish();
                    }}
                  >
                    Start session
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      </Activity.Root>
    </Box>
  );
};
