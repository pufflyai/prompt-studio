import { HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { AlertMessage } from "@/components/primitives/alert";
import { TagEditor } from "./tag-editor";
import type { TagEditorProps, TagEditorValue } from "./tag-editor.types";

export interface SaveTagSettingsInput<TValue> {
  deletedIds: Set<string>;
  drafts: TagEditorValue[];
  values: TValue[];
}

type EditorLabels = Pick<
  TagEditorProps,
  | "actionOptions"
  | "actionsColumnLabel"
  | "addLabel"
  | "addPlaceholder"
  | "colorOptions"
  | "deleteButtonText"
  | "deleteHeadline"
  | "deleteNotificationText"
  | "description"
  | "iconOptions"
  | "showIcons"
  | "title"
  | "valueColumnLabel"
>;

type SortableValue = { id: string; sortOrder: number };

export interface TagSettingsPanelProps<TValue extends SortableValue> extends EditorLabels {
  errorTitle: string;
  loadingText?: string;
  /** Loaded values; pass undefined while the initial load is pending. */
  values: TValue[] | undefined;
  /** Load/save error surfaced by the host's data layer. */
  loadError?: unknown;
  /**
   * Persists the pending edits. The host owns fetching and cache invalidation;
   * the panel resets its delete tracking once the returned promise resolves.
   */
  onSave: (input: SaveTagSettingsInput<TValue>) => Promise<void>;
  toEditorValue: (value: TValue) => TagEditorValue;
  valueNeedsUpdate: (original: TValue, draft: TagEditorValue) => boolean;
}

const bySortOrder = (left: TagEditorValue, right: TagEditorValue) =>
  left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);

const toEditorValues = <TValue extends SortableValue>(
  values: TValue[],
  toEditorValue: (value: TValue) => TagEditorValue,
) => values.map(toEditorValue).sort(bySortOrder);

const findOriginalValue = <TValue extends SortableValue>(values: TValue[], draft: TagEditorValue) =>
  values.find((value) => value.id === draft.id);

const hasTagValueChanges = <TValue extends SortableValue>(
  values: TValue[],
  drafts: TagEditorValue[],
  deletedIds: Set<string>,
  valueNeedsUpdate: (original: TValue, draft: TagEditorValue) => boolean,
) => {
  if (deletedIds.size > 0) return true;

  return drafts.some((draft) => {
    if (draft.isNew) return true;
    const original = findOriginalValue(values, draft);
    if (!original) return true;
    return valueNeedsUpdate(original, draft) || draft.sortOrder !== original.sortOrder;
  });
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : error ? String(error) : null);

export const TagSettingsPanel = <TValue extends SortableValue>(props: TagSettingsPanelProps<TValue>) => {
  const {
    errorTitle,
    loadingText = "Loading...",
    values: loadedValues,
    loadError,
    onSave,
    toEditorValue,
    valueNeedsUpdate,
    ...editorProps
  } = props;
  const [drafts, setDrafts] = useState<TagEditorValue[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  const values = loadedValues ?? [];

  // Edits never refetch in the background, so loaded values only change on
  // initial load and after a save invalidates the host's cache — keeping local
  // drafts in sync.
  useEffect(() => {
    if (loadedValues) setDrafts(toEditorValues(loadedValues, toEditorValue));
  }, [loadedValues, toEditorValue]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({ deletedIds, drafts, values });
      setDeletedIds(new Set());
    } catch (error) {
      setSaveError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = hasTagValueChanges(values, drafts, deletedIds, valueNeedsUpdate);
  const error = errorMessage(loadError) ?? errorMessage(saveError);

  const handleDeleteValue = (value: TagEditorValue) => {
    if (!value.isNew) setDeletedIds(new Set([...deletedIds, value.id]));
    setDrafts(drafts.filter((draft) => draft.id !== value.id));
  };

  const handleCancel = () => {
    setDrafts(toEditorValues(values, toEditorValue));
    setDeletedIds(new Set());
    setSaveError(null);
  };

  return (
    <Stack boxSizing="border-box" minH="100%" p="lg" gap="lg" bg="bg" color="fg">
      {error ? (
        <AlertMessage status="error" colorPalette="red" title={errorTitle} size="sm">
          {error}
        </AlertMessage>
      ) : null}
      {loadedValues === undefined ? (
        <HStack gap="sm" color="fg.muted">
          <Spinner size="sm" />
          <Text textStyle="paragraph/S/regular">{loadingText}</Text>
        </HStack>
      ) : (
        <TagEditor
          {...editorProps}
          values={drafts}
          onValuesChange={setDrafts}
          onDeleteValue={handleDeleteValue}
          hasChanges={hasChanges}
          isSaving={isSaving}
          onSave={() => void handleSave()}
          onCancel={handleCancel}
        />
      )}
    </Stack>
  );
};
