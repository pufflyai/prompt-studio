import { Button, Editable, HStack, Icon, Skeleton, Stack, Text } from "@chakra-ui/react";
import { createWebviewClient, type GuestHost, type WebviewEditingSession } from "@pstdio/sdk/extensions";
import {
  DeleteConfirmationModal,
  ScrollArea,
  SegmentedControl,
  SimpleCard,
  TagEditor,
  TagEditorHeading,
} from "@pstdio/ui";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { readTicketTagsCommand } from "../commands/ticket-tags";
import { plannerSchemaChanged } from "../events";
import type { readStatusSettings } from "../ticket-status-settings";
import {
  editPlannerSettings,
  type PlannerSettingsGroup,
  type PlannerSettingsKind,
  type PlannerSettingsState,
  plannerSettingsGroups,
  statusSettingsState,
  tagSettingsState,
} from "./planner-settings-model";

type Commands = {
  "ticket-status.read-settings": typeof readStatusSettings;
  "ticket-tag.read": typeof readTicketTagsCommand;
};
export const PlannerCollectionEditor = (props: { host: GuestHost; kind: PlannerSettingsKind }) => {
  const { host, kind } = props;
  const [session, setSession] = useState<WebviewEditingSession<PlannerSettingsState>>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry restarts the initial read for the same document.
  useEffect(() => {
    let current: WebviewEditingSession<PlannerSettingsState> | undefined;
    let alive = true;
    const client = createWebviewClient<Commands>(host);
    const read = async () =>
      kind === "status"
        ? statusSettingsState((await client.commands["ticket-status.read-settings"]()).statuses)
        : tagSettingsState((await client.commands["ticket-tag.read"]()).tags);
    const open = async () => {
      const initial = await read();
      current = await client.editing.open({
        key: `settings.${kind}`,
        initial,
        save: { commandId: `${host.extensionId}.command.settings.save-collections`, params: { kind } },
      });
      if (alive) setSession(current);
      else await current.close();
    };
    void open().catch((error) => {
      if (alive) setError(String(error));
    });
    const unsubscribe = client.events.subscribe(plannerSchemaChanged, () => {
      if (current)
        void current.refresh(read).catch((error) => {
          if (alive) setError(String(error));
        });
    });
    return () => {
      unsubscribe();
      alive = false;
      void current?.close();
    };
  }, [host, kind, attempt]);
  if (error && !session)
    return (
      <Stack gap="sm">
        <Text role="alert" color="fg.error">
          {error}
        </Text>
        <Button
          size="sm"
          variant="outline"
          alignSelf="start"
          onClick={() => {
            setError(undefined);
            setAttempt((attempt) => attempt + 1);
          }}
        >
          Retry
        </Button>
      </Stack>
    );
  if (!session)
    return (
      <Stack role="status" aria-label="Loading settings" gap="md" maxW="3xl" w="full" mx="auto" px="lg">
        {[0, 1, 2, 3].map((id) => (
          <Skeleton key={id} variant="none" bg="bg.emphasized" h="8" borderRadius="xs" />
        ))}
      </Stack>
    );
  return (
    <Stack h="full" minH="0" gap="sm">
      {error ? (
        <Text role="alert" color="fg.error">
          {error}
        </Text>
      ) : null}
      <Stack flex="1" minH="0">
        <CollectionFields session={session} kind={kind} />
      </Stack>
    </Stack>
  );
};
const CollectionFields = (props: {
  session: WebviewEditingSession<PlannerSettingsState>;
  kind: PlannerSettingsKind;
}) => {
  const { session, kind } = props;
  const { value } = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const groups = plannerSettingsGroups(value);
  const [deleting, setDeleting] = useState<string>();
  const [error, setError] = useState<string>();
  const update = (next: PlannerSettingsGroup[]) => {
    setError(undefined);
    void session
      .preview(editPlannerSettings(session.getSnapshot().value, next))
      .catch((error) => setError(String(error)));
  };
  return (
    <ScrollArea h="full" minH="0">
      <Stack gap="lg" maxW="3xl" w="full" mx="auto" px="lg" pb="lg">
        {error ? (
          <Text role="alert" color="fg.error">
            {error}
          </Text>
        ) : null}
        {groups.map((group) => (
          <Stack key={group.id} gap="2xs">
            <HStack minH="tag-editor-row" justify="space-between" gap="xs">
              {kind === "tags" ? (
                <Editable.Root
                  key={group.name}
                  defaultValue={group.name}
                  selectOnFocus
                  onValueCommit={({ value }) => {
                    if (value.trim())
                      update(groups.map((entry) => (entry.id === group.id ? { ...entry, name: value.trim() } : entry)));
                  }}
                >
                  <Editable.Preview textStyle="label/L/medium" />
                  <Editable.Input textStyle="label/L/medium" />
                </Editable.Root>
              ) : (
                <TagEditorHeading>{group.name}</TagEditorHeading>
              )}
              {kind === "tags" ? (
                <HStack gap="xs">
                  <SegmentedControl
                    options={[
                      { value: "single_select", label: "Single" },
                      { value: "multi_select", label: "Multiple" },
                    ]}
                    value={group.type ?? "single_select"}
                    aria-label="Selection mode"
                    onValueChange={(type) =>
                      update(
                        groups.map((entry) =>
                          entry.id === group.id ? { ...entry, type: type as "single_select" | "multi_select" } : entry,
                        ),
                      )
                    }
                  />
                  <Button
                    size="xs"
                    variant="ghost"
                    aria-label={`Delete ${group.name}`}
                    onClick={() => setDeleting(group.id)}
                  >
                    <Icon as={Trash2} boxSize="icon-xs" />
                  </Button>
                </HStack>
              ) : null}
            </HStack>
            <SimpleCard overflow="hidden">
              <TagEditor
                values={group.values}
                showColumnHeaders
                valueColumnLabel="Name"
                onValuesChange={(values) =>
                  update(groups.map((entry) => (entry.id === group.id ? { ...entry, values } : entry)))
                }
                onDeleteValue={(value) =>
                  update(
                    groups.map((entry) =>
                      entry.id === group.id
                        ? { ...entry, values: entry.values.filter((item) => item.id !== value.id) }
                        : entry,
                    ),
                  )
                }
                showDefault={kind === "status"}
                onSetDefault={(value) =>
                  update(
                    groups.map((entry) => ({
                      ...entry,
                      values: entry.values.map((item) => ({ ...item, isDefault: item.id === value.id })),
                    })),
                  )
                }
                actionsLabel="Commands"
                actionOptions={
                  kind === "status"
                    ? [
                        { value: "create", label: "Create" },
                        { value: "archive_all", label: "Archive all" },
                      ]
                    : undefined
                }
                addLabel={kind === "status" ? "Add state" : "Add option"}
                addName={kind === "status" ? "New status" : "New option"}
                deleteHeadline={kind === "status" ? "Delete status?" : "Delete tag option?"}
                deleteButtonText="Delete"
                deleteNotificationText={(value) => `Remove “${value.name}”?`}
              />
            </SimpleCard>
          </Stack>
        ))}
        {kind === "tags" ? (
          <Button
            size="sm"
            variant="outline"
            alignSelf="start"
            onClick={() =>
              update([...groups, { id: crypto.randomUUID(), name: "New tag", type: "single_select", values: [] }])
            }
          >
            <Icon as={Plus} boxSize="icon-sm" />
            Add tag
          </Button>
        ) : null}
        <DeleteConfirmationModal
          open={deleting !== undefined}
          onClose={() => setDeleting(undefined)}
          onDelete={async () => {
            update(groups.filter((group) => group.id !== deleting));
            setDeleting(undefined);
          }}
          headline="Delete tag?"
          notificationText="This removes the tag and its values from tickets when you save."
          buttonText="Delete tag"
        />
      </Stack>
    </ScrollArea>
  );
};
