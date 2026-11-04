import { Button, Stack } from "@chakra-ui/react";
import { TagEditor } from "@pstdio/ui";
import { ParamEditorRow } from "@pstdio/ui/param-editor";
import { useState } from "react";
import { type PlannerTagDraft, plannerStatuses, plannerTags } from "./planner-fixtures";
import { SettingsPage } from "./settings-page";

export const PlannerCollectionEditor = (props: { pageId: "ticket-status" | "ticket-tags" }) => {
  const { pageId } = props;
  const isStatus = pageId === "ticket-status";
  const [saved, setSaved] = useState<PlannerTagDraft[]>(() =>
    isStatus ? [{ id: "status", name: "Status", type: "single_select", options: plannerStatuses }] : plannerTags,
  );
  const [drafts, setDrafts] = useState(saved);
  const changeTag = (id: string, change: Partial<PlannerTagDraft>) =>
    setDrafts(drafts.map((tag) => (tag.id === id ? { ...tag, ...change } : tag)));
  return (
    <SettingsPage
      pageId={pageId}
      changes={{
        dirty: JSON.stringify(drafts) !== JSON.stringify(saved),
        onSave: () => setSaved(drafts),
        onReset: () => setDrafts(saved),
      }}
    >
      <Stack gap="lg" px="sm">
        {drafts.map((tag) => (
          <Stack key={tag.id} gap="sm">
            <TagEditor
              title={tag.name}
              onTitleChange={isStatus ? undefined : (name) => changeTag(tag.id, { name })}
              values={tag.options}
              onValuesChange={(options) => changeTag(tag.id, { options })}
              onDeleteValue={(value) =>
                changeTag(tag.id, { options: tag.options.filter((option) => option.id !== value.id) })
              }
              onSetDefault={(value) =>
                changeTag(tag.id, {
                  options: tag.options.map((option) => ({ ...option, isDefault: option.id === value.id })),
                })
              }
              framed
              showColumnHeaders
              valueColumnLabel="Name"
              showDefault={isStatus}
              actionOptions={
                isStatus
                  ? [
                      { value: "create", label: "Create" },
                      { value: "archive_all", label: "Archive all" },
                    ]
                  : undefined
              }
              actionsLabel="Commands"
              addLabel={isStatus ? "Add status" : "Add option"}
              addName={isStatus ? "New status" : "New option"}
              defaultAddIcon={isStatus ? "status-todo" : "tag"}
              headerActions={
                isStatus ? undefined : (
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => setDrafts(drafts.filter((entry) => entry.id !== tag.id))}
                  >
                    Delete tag
                  </Button>
                )
              }
            />
            {!isStatus ? (
              <ParamEditorRow
                param={{
                  id: tag.id,
                  name: "Selection",
                  type: "selection",
                  defaultValue: tag.type,
                  options: [
                    { id: "single_select", name: "Single" },
                    { id: "multi_select", name: "Multiple" },
                  ],
                }}
                onChange={(_id, type) => {
                  if (typeof type === "string") changeTag(tag.id, { type });
                }}
              />
            ) : null}
          </Stack>
        ))}
        {!isStatus ? (
          <Button
            size="sm"
            variant="outline"
            alignSelf="start"
            onClick={() =>
              setDrafts([
                ...drafts,
                {
                  id: crypto.randomUUID(),
                  name: "New tag",
                  type: "single_select",
                  options: [],
                },
              ])
            }
          >
            Add tag
          </Button>
        ) : null}
      </Stack>
    </SettingsPage>
  );
};
