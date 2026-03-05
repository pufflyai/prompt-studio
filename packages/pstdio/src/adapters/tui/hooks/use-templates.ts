import { useLiveQuery } from "@tanstack/react-db";
import { useState } from "react";

import { API_URL } from "@/features/api-url";
import { getCollection, type SyncedRow } from "@/features/sync/collections";
import { getTemplate } from "@/features/templates/api/get-template";
import { updateTemplate } from "@/features/templates/api/update-template";

export type TemplateItem = {
  id: string;
  name: string;
  template_type: string;
  is_default: boolean;
};

export type TemplateWithContent = TemplateItem & { content: string };

const toTemplateItem = (row: SyncedRow): TemplateItem => ({
  id: row.id,
  name: row.name as string,
  template_type: row.template_type as string,
  is_default: row.is_default as boolean,
});

const sortTemplates = (items: TemplateItem[]) =>
  [...items].sort((a, b) => {
    if (a.template_type !== b.template_type) {
      return a.template_type === "ticket" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

export function useTemplates(projectId: string | null) {
  const [error, setError] = useState("");
  const [viewingTemplate, setViewingTemplate] = useState<TemplateWithContent | null>(null);

  const { data: rawTemplates } = useLiveQuery(() => getCollection("templates"));

  const items = sortTemplates(
    (rawTemplates ?? []).filter((t) => t.project_id === projectId && !t.deleted_at).map(toTemplateItem),
  );

  const viewTemplate = async (name: string) => {
    if (!projectId) return;
    try {
      const result = await getTemplate(API_URL, projectId, name);
      if (result) setViewingTemplate(result);
    } catch {
      setError("Failed to load template");
    }
  };

  const closeTemplate = () => setViewingTemplate(null);

  const setDefault = async (name: string) => {
    if (!projectId) return;
    try {
      await updateTemplate(API_URL, projectId, name, { is_default: true });
    } catch {
      setError("Failed to set default template");
    }
  };

  return {
    items,
    error,
    viewingTemplate,
    viewTemplate,
    closeTemplate,
    setDefault,
  };
}
