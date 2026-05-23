type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const toStorage = (storage?: DraftStorage) => storage ?? localStorage;

export const buildTemplateDraftKey = (projectId: string, templateName: string) =>
  `template-draft:${projectId}:${templateName}`;

export const loadTemplateDraft = (
  storage: DraftStorage | undefined,
  projectId: string | undefined,
  templateName: string | undefined,
) => {
  if (!projectId || !templateName) return null;
  return toStorage(storage).getItem(buildTemplateDraftKey(projectId, templateName));
};

export const saveTemplateDraft = (
  storage: DraftStorage | undefined,
  projectId: string | undefined,
  templateName: string | undefined,
  content: string,
) => {
  if (!projectId || !templateName) return;
  toStorage(storage).setItem(buildTemplateDraftKey(projectId, templateName), content);
};

export const clearTemplateDraft = (
  storage: DraftStorage | undefined,
  projectId: string | undefined,
  templateName: string | undefined,
) => {
  if (!projectId || !templateName) return;
  toStorage(storage).removeItem(buildTemplateDraftKey(projectId, templateName));
};

export const isTemplateEditorEmpty = (content: string) => content.trim().length === 0;
