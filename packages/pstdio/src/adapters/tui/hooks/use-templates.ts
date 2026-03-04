import { useCallback, useEffect, useState } from "react";

import { API_URL } from "@/features/api-url";
import { getTemplate } from "@/features/templates/api/get-template";
import { listTemplates } from "@/features/templates/api/list-templates";
import { updateTemplate } from "@/features/templates/api/update-template";

export type TemplateItem = {
  id: string;
  name: string;
  template_type: string;
  is_default: boolean;
};

export type TemplateWithContent = TemplateItem & { content: string };

const sortTemplates = (items: TemplateItem[]) =>
  [...items].sort((a, b) => {
    // ticket type first
    if (a.template_type !== b.template_type) {
      return a.template_type === "ticket" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

export function useTemplates(projectId: string | null) {
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [error, setError] = useState("");
  const [viewingTemplate, setViewingTemplate] = useState<TemplateWithContent | null>(null);

  const loadTemplates = useCallback(async (pid: string) => {
    try {
      const result = await listTemplates(API_URL, pid);
      setItems(sortTemplates(result));
      setError("");
    } catch {
      setError("Failed to load templates");
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    loadTemplates(projectId);
  }, [projectId, loadTemplates]);

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
      await loadTemplates(projectId);
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
