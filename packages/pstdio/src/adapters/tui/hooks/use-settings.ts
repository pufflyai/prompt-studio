import { useLiveQuery } from "@tanstack/react-db";
import { useState } from "react";

import { API_URL } from "@/features/api-url";
import { createStatus } from "@/features/statuses/api/create-status";
import { deleteStatus } from "@/features/statuses/api/delete-status";
import { setDefaultStatus } from "@/features/statuses/api/set-default-status";
import { updateStatusColor } from "@/features/statuses/api/update-status-color";
import { getCollection, type SyncedRow } from "@/features/sync/collections";
import { createTag } from "@/features/tags/api/create-tag";
import { deleteTag } from "@/features/tags/api/delete-tag";
import { updateTagColor } from "@/features/tags/api/update-tag-color";

export type SettingsStatus = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
};

export type SettingsTag = {
  id: string;
  name: string;
  color: string;
};

export type SettingsSection = "statuses" | "tags";

const toStatus = (row: SyncedRow): SettingsStatus => ({
  id: row.id,
  name: row.name as string,
  color: row.color as string,
  sort_order: row.sort_order as number,
  is_default: row.is_default as boolean,
});

const toTag = (row: SyncedRow): SettingsTag => ({
  id: row.id,
  name: row.name as string,
  color: row.color as string,
});

export function useSettings(projectId: string | null) {
  const [error, setError] = useState("");
  const [section, setSection] = useState<SettingsSection>("statuses");

  const { data: rawStatuses } = useLiveQuery(() => getCollection("ticket_statuses"));
  const { data: rawTags } = useLiveQuery(() => getCollection("ticket_tags"));

  const statuses: SettingsStatus[] = (rawStatuses ?? [])
    .filter((s) => s.project_id === projectId && !s.deleted_at)
    .map(toStatus)
    .sort((a, b) => a.sort_order - b.sort_order);

  const tags: SettingsTag[] = (rawTags ?? [])
    .filter((t) => t.project_id === projectId && !t.deleted_at)
    .map(toTag)
    .sort((a, b) => a.name.localeCompare(b.name));

  const addStatus = async (name: string, color: string) => {
    if (!projectId) return;
    try {
      await createStatus(API_URL, projectId, { name, color });
      setError("");
    } catch {
      setError(`Status already exists: ${name}`);
    }
  };

  const removeStatus = async (statusId: string) => {
    if (!projectId) return;
    const status = statuses.find((s) => s.id === statusId);
    if (status?.is_default) {
      setError("Cannot delete the default status. Set a different default first.");
      return;
    }
    try {
      await deleteStatus(API_URL, projectId, statusId);
      setError("");
    } catch {
      setError("Failed to delete status");
    }
  };

  const makeDefault = async (statusId: string) => {
    if (!projectId) return;
    try {
      await setDefaultStatus(API_URL, projectId, statusId);
      setError("");
    } catch {
      setError("Failed to set default status");
    }
  };

  const addTag = async (name: string, color: string) => {
    if (!projectId) return;
    try {
      await createTag(API_URL, projectId, { name, color });
      setError("");
    } catch {
      setError(`Tag already exists: ${name}`);
    }
  };

  const changeStatusColor = async (statusId: string, color: string) => {
    if (!projectId) return;
    try {
      await updateStatusColor(API_URL, projectId, statusId, color);
      setError("");
    } catch {
      setError("Failed to update status color");
    }
  };

  const removeTag = async (tagId: string) => {
    if (!projectId) return;
    try {
      await deleteTag(API_URL, projectId, tagId);
      setError("");
    } catch {
      setError("Failed to delete tag");
    }
  };

  const changeTagColor = async (tagId: string, color: string) => {
    if (!projectId) return;
    try {
      await updateTagColor(API_URL, projectId, tagId, color);
      setError("");
    } catch {
      setError("Failed to update tag color");
    }
  };

  return {
    statuses,
    tags,
    section,
    setSection,
    error,
    setError,
    addStatus,
    removeStatus,
    makeDefault,
    changeStatusColor,
    addTag,
    removeTag,
    changeTagColor,
  };
}
