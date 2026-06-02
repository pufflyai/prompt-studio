import { HStack, Spinner, Stack, Text } from "@chakra-ui/react";
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
  readValues: (source: TSource) => Promise<TValue[]>;
  saveValues: (source: TSource, input: SaveTagSettingsInput<TValue>) => Promise<void>;
  source: TSource;
  toEditorValue: (value: TValue) => TagEditorValue;
  valueNeedsUpdate: (original: TValue, draft: TagEditorValue) => boolean;
}

interface LoadTagSettingsInput<TValue extends SortableValue, TSource> {
  isCancelled?: () => boolean;
  readValues: (source: TSource) => Promise<TValue[]>;
  setDrafts: (values: TagEditorValue[]) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setValues: (values: TValue[]) => void;
  source: TSource;
  toEditorValue: (value: TValue) => TagEditorValue;
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

const loadTagSettings = async <TValue extends SortableValue, TSource>(input: LoadTagSettingsInput<TValue, TSource>) => {
  const { isCancelled, readValues, setDrafts, setError, setLoading, setValues, source, toEditorValue } = input;
  setLoading(true);
  setError(null);
  try {
    const nextValues = await readValues(source);
    if (!isCancelled?.()) {
      setValues(nextValues);
      setDrafts(toEditorValues(nextValues, toEditorValue));
    }
  } catch (caught) {
    if (!isCancelled?.()) setError(caught instanceof Error ? caught.message : String(caught));
  } finally {
    if (!isCancelled?.()) setLoading(false);
  }
};

export const TagSettingsPanel = <TValue extends SortableValue, TSource>(
  props: TagSettingsPanelProps<TValue, TSource>,
) => {
  const {
    errorTitle,
    loadingText = "Loading...",
    readValues,
    saveValues,
    source,
    toEditorValue,
    valueNeedsUpdate,
    ...editorProps
  } = props;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<TValue[]>([]);
  const [drafts, setDrafts] = useState<TagEditorValue[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const hasChanges = hasTagValueChanges(values, drafts, deletedIds, valueNeedsUpdate);

  useEffect(() => {
    let cancelled = false;
    void loadTagSettings({
      isCancelled: () => cancelled,
      readValues,
      setDrafts,
      setError,
      setLoading,
      setValues,
      source,
      toEditorValue,
    });
    return () => {
      cancelled = true;
    };
  }, [source, readValues, toEditorValue]);

  const handleDeleteValue = (value: TagEditorValue) => {
    if (!value.isNew) setDeletedIds(new Set([...deletedIds, value.id]));
    setDrafts(drafts.filter((draft) => draft.id !== value.id));
  };

  const handleCancel = () => {
    setDrafts(toEditorValues(values, toEditorValue));
    setDeletedIds(new Set());
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveValues(source, { deletedIds, drafts, values });
      setDeletedIds(new Set());
      await loadTagSettings({ readValues, setDrafts, setError, setLoading, setValues, source, toEditorValue });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack boxSizing="border-box" minH="100%" p="lg" gap="lg" bg="bg" color="fg">
      {error ? (
        <AlertMessage status="error" colorPalette="red" title={errorTitle} size="sm">
          {error}
        </AlertMessage>
      ) : null}
      {loading ? (
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
          isSaving={saving}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </Stack>
  );
};
