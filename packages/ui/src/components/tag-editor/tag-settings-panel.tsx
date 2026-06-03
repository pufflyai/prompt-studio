import { HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertMessage } from "../alert";
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

export interface TagSettingsPanelProps<TValue extends SortableValue, TSource> extends EditorLabels {
  errorTitle: string;
  loadingText?: string;
  queryKey: QueryKey;
  readValues: (source: TSource) => Promise<TValue[]>;
  saveValues: (source: TSource, input: SaveTagSettingsInput<TValue>) => Promise<void>;
  source: TSource;
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

export const TagSettingsPanel = <TValue extends SortableValue, TSource>(
  props: TagSettingsPanelProps<TValue, TSource>,
) => {
  const {
    errorTitle,
    loadingText = "Loading...",
    queryKey,
    readValues,
    saveValues,
    source,
    toEditorValue,
    valueNeedsUpdate,
    ...editorProps
  } = props;
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<TagEditorValue[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Edits never refetch in the background, so loaded values only change on initial
  // load and after a save invalidates the query — keeping local drafts in sync.
  const valuesQuery = useQuery({ queryKey, queryFn: () => readValues(source), staleTime: Infinity });
  const values = valuesQuery.data ?? [];

  useEffect(() => {
    if (valuesQuery.data) setDrafts(toEditorValues(valuesQuery.data, toEditorValue));
  }, [valuesQuery.data, toEditorValue]);

  const saveMutation = useMutation({
    mutationFn: () => saveValues(source, { deletedIds, drafts, values }),
    onSuccess: () => {
      setDeletedIds(new Set());
      return queryClient.invalidateQueries({ queryKey });
    },
  });

  const hasChanges = hasTagValueChanges(values, drafts, deletedIds, valueNeedsUpdate);
  const error = errorMessage(valuesQuery.error) ?? errorMessage(saveMutation.error);

  const handleDeleteValue = (value: TagEditorValue) => {
    if (!value.isNew) setDeletedIds(new Set([...deletedIds, value.id]));
    setDrafts(drafts.filter((draft) => draft.id !== value.id));
  };

  const handleCancel = () => {
    setDrafts(toEditorValues(values, toEditorValue));
    setDeletedIds(new Set());
    saveMutation.reset();
  };

  return (
    <Stack boxSizing="border-box" minH="100%" p="lg" gap="lg" bg="bg" color="fg">
      {error ? (
        <AlertMessage status="error" colorPalette="red" title={errorTitle} size="sm">
          {error}
        </AlertMessage>
      ) : null}
      {valuesQuery.isPending ? (
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
          isSaving={saveMutation.isPending}
          onSave={() => saveMutation.mutate()}
          onCancel={handleCancel}
        />
      )}
    </Stack>
  );
};
