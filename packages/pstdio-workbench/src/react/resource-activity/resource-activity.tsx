import { Box, Button, HStack, IconButton, Separator, Stack, Text } from "@chakra-ui/react";
import type { ResourceActivityEntry, ResourceRef } from "@pstdio/sdk/extensions";
import { Activity, AlertMessage, EmptyState, LazyRichMessage } from "@pstdio/ui";
import { X } from "lucide-react";
import { useState } from "react";
import type { WorkbenchCore } from "../../core";
import type { ResourceActivityBinding } from "../../core/registries/resources/resource-activity";
import { activityActor, activityChangeSummary, activityTime } from "./activity-presentation";
import { revealActivityPassage } from "./markdown-activity";
import { ResourceActivityComposer, ResourceActivityReplyComposer } from "./resource-activity-composer";
import { useActivityHistory } from "./use-activity-history";
import { useResourceActivity } from "./use-resource-activity";

const EntryBody = (props: {
  entry: ResourceActivityEntry;
  controller: ReturnType<typeof useResourceActivity>;
  workbench: WorkbenchCore;
  ownerInstanceId?: string;
}) => {
  const { entry, controller, workbench, ownerInstanceId } = props;
  const [passageMissing, setPassageMissing] = useState(false);
  const passage = entry.passage;
  return (
    <Stack gap="xs">
      {entry.quote &&
        (passage ? (
          <Stack gap="2xs">
            <Button
              variant="ghost"
              alignSelf="start"
              whiteSpace="normal"
              h="auto"
              textAlign="start"
              onClick={() => setPassageMissing(!revealActivityPassage(workbench, ownerInstanceId, passage))}
            >
              “{entry.quote}”
            </Button>
            {passageMissing ? (
              <Text role="status" color="fg.muted">
                Passage unavailable
              </Text>
            ) : null}
          </Stack>
        ) : (
          <Text color="fg.muted">“{entry.quote}”</Text>
        ))}
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
      {entry.body && <LazyRichMessage defaultState={entry.body} fullWidth />}
      {entry.revision && (
        <Text color="fg.muted">
          Revision {entry.revision.revision} · {entry.revision.headSha.slice(0, 8)}
        </Text>
      )}
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
          maxW="full"
          minW="0"
          title={file.name}
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
          <Text truncate>{file.name}</Text>
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
const ActivityEntries = (props: {
  binding: ResourceActivityBinding;
  controller: ReturnType<typeof useResourceActivity>;
  workbench: WorkbenchCore;
  ownerInstanceId?: string;
}) => {
  const { binding, controller, workbench, ownerInstanceId } = props;
  const replies = new Map<string, ResourceActivityEntry[]>();
  for (const entry of controller.items) {
    if (!entry.replyToId) continue;
    const group = replies.get(entry.replyToId) ?? [];
    group.push(entry);
    replies.set(entry.replyToId, group);
  }
  const roots = new Set(controller.items.map((entry) => entry.id));
  return (
    <Activity.Feed>
      {controller.items
        .filter((entry) => !entry.replyToId || !roots.has(entry.replyToId))
        .map((entry) =>
          entry.kind === "change" ? (
            <Activity.Timeline key={entry.id} data-activity-entry={entry.id}>
              <Activity.Event actor={activityActor(entry)} timestamp={activityTime(entry.createdAt)}>
                {activityChangeSummary(entry)}
              </Activity.Event>
            </Activity.Timeline>
          ) : (
            <Activity.Comment
              key={entry.id}
              data-activity-entry={entry.id}
              actor={activityActor(entry)}
              timestamp={activityTime(entry.createdAt)}
              tone={entry.author.type === "user" ? "sent" : "default"}
              replies={replies.get(entry.id)?.map((reply) => (
                <Activity.Reply
                  key={reply.id}
                  data-activity-entry={reply.id}
                  actor={activityActor(reply)}
                  timestamp={activityTime(reply.createdAt)}
                >
                  <EntryBody entry={reply} controller={controller} workbench={workbench} />
                </Activity.Reply>
              ))}
              composer={
                entry.kind === "comment" && !entry.replyToId && controller.capabilities.comments ? (
                  <ResourceActivityReplyComposer
                    workbench={workbench}
                    binding={binding}
                    resource={controller.resource}
                    replyToId={entry.id}
                    onPublished={() => controller.refresh()}
                  />
                ) : undefined
              }
            >
              <EntryBody
                entry={entry}
                controller={controller}
                workbench={workbench}
                ownerInstanceId={ownerInstanceId}
              />
            </Activity.Comment>
          ),
        )}
      {!controller.items.length && !controller.error && <EmptyState title="No activity yet" py="md" />}
    </Activity.Feed>
  );
};
export const WorkbenchResourceActivity = (props: {
  workbench: WorkbenchCore;
  binding: ResourceActivityBinding;
  resource: ResourceRef;
  visible: boolean;
  menu?: boolean;
  ownerInstanceId?: string;
}) => {
  const { workbench, binding, resource, visible } = props;
  const controller = useResourceActivity(workbench, binding, resource, visible);
  const history = useActivityHistory(controller.items, Boolean(controller.cursor), visible, () =>
    controller.refresh(true),
  );
  const error = controller.error ?? (history.failed ? "Cannot retrieve earlier activity." : undefined);
  return (
    <Box layerStyle={props.menu ? undefined : "markdownEditorInset"} p={props.menu ? "sm" : undefined} flexShrink="0">
      <Activity.Root
        aria-label="Resource activity"
        layerStyle={props.menu ? undefined : "documentContent"}
        overflowAnchor="none"
      >
        {!props.menu ? (
          <>
            <Separator />
            <Activity.Header />
          </>
        ) : null}
        {error && (
          <HStack role="status" layerStyle="resourceActivityNotice">
            <Text flex="1" minW="0" lineClamp={2} title={error}>
              {error}
            </Text>
            {!controller.actionError && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => void (history.failed ? history.retry() : controller.refresh())}
              >
                Retry
              </Button>
            )}
            <IconButton
              variant="ghost"
              size="xs"
              aria-label="Dismiss Activity error"
              onClick={() => {
                history.clearError();
                controller.clearError();
              }}
            >
              <X />
            </IconButton>
          </HStack>
        )}
        {controller.cursor && (
          <Box ref={history.boundary} role="status" aria-label="Loading earlier activity" minH="px" />
        )}
        <ActivityEntries
          binding={binding}
          controller={controller}
          workbench={workbench}
          ownerInstanceId={props.ownerInstanceId}
        />
        {controller.capabilities.comments && <ResourceActivityComposer controller={controller.composer} />}
      </Activity.Root>
    </Box>
  );
};
