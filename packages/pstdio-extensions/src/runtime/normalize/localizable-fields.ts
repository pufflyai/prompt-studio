// Only contract-declared Localizable fields belong here. Callback results and
// ordinary strings (including select option labels) are not static metadata.
export interface LocalizableFields {
  text?: true;
  fields?: Record<string, LocalizableFields>;
  record?: LocalizableFields;
  keyed?: LocalizableFields;
  unkeyed?: LocalizableFields;
  variants?: Record<string, LocalizableFields>;
}

const text = { text: true } as const;
const fields = (...names: string[]): LocalizableFields => ({
  fields: Object.fromEntries(names.map((name) => [name, text])),
});
const label = fields("label");
const title = fields("title");
const describedTitle = fields("title", "description");
const params: LocalizableFields = { record: fields("label", "description", "placeholder") };
const empty = fields("emptyTitle", "emptyDescription").fields;
const actions: LocalizableFields = { keyed: label };
const viewBody: LocalizableFields = {
  variants: {
    webview: title,
    tree: { fields: { ...empty, searchPlaceholder: text } },
    file: { fields: empty },
    controls: { fields: empty },
    dataTable: {
      fields: {
        ...empty,
        columns: { keyed: fields("label", "description") },
        rowActions: actions,
        selectionActions: actions,
      },
    },
    kanban: {
      fields: {
        ...empty,
        attributes: { keyed: { fields: { label: text, type: { fields: { options: { unkeyed: label } } } } } },
        rowActions: actions,
        defaultViews: { keyed: title },
        createRow: {
          fields: {
            title: text,
            submitLabel: text,
            params,
            labels: fields("cancel", "properties", "submitError", "removeFile"),
          },
        },
      },
    },
  },
};

export const localizableContributionFields = {
  commands: {
    fields: {
      title: text,
      description: text,
      params,
      cli: fields("description"),
      menus: { unkeyed: label },
      palette: { unkeyed: label },
    },
  },
  pages: title,
  views: { fields: { title: text, body: viewBody } },
  navigationItems: label,
  activityItems: title,
  settingsSections: title,
  statuses: { fields: { title: text, actions } },
  resourceKinds: { fields: { label: text, menuSlots: { keyed: label } } },
  settings: { fields: { properties: { record: describedTitle } } },
  modes: label,
  connections: label,
  harnesses: { fields: { label: text, params } },
  workspaceTypes: { fields: { label: text, params } },
  commandPaletteResources: title,
  artifactMounts: label,
  schedules: title,
  templateTypes: fields("label", "description"),
  templates: describedTitle,
  skills: describedTitle,
  themes: describedTitle,
  fileIconThemes: describedTitle,
} satisfies Record<string, LocalizableFields>;
