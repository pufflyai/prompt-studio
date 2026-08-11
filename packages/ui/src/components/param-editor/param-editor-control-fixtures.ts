import type { Param, ParamValueMap } from "./param-editor.types";

export interface ParamEditorInputFixture {
  param: Param;
  defaultValues: ParamValueMap;
}

const uploadingFiles = [
  {
    id: "release-notes",
    file: new File(["# Release notes\n"], "release-notes.md", { type: "text/markdown", lastModified: 1 }),
    status: "uploading" as const,
    progress: 62,
  },
  {
    id: "diagram",
    file: new File([new Uint8Array(24 * 1024)], "diagram.png", { type: "image/png", lastModified: 2 }),
    status: "uploading" as const,
    progress: 38,
  },
];

const fixture = (param: Param, value?: ParamValueMap[string]): ParamEditorInputFixture => ({
  param,
  defaultValues: value === undefined ? {} : { [param.id]: value },
});

export const paramEditorInputFixtures = {
  boolean: fixture(
    {
      id: "notifications",
      name: "Enable notifications",
      type: "boolean",
      description: "Send a notification when processing completes.",
      defaultValue: true,
    },
    true,
  ),
  number: fixture(
    {
      id: "opacity",
      name: "Opacity",
      type: "number",
      description: "Controls the output opacity.",
      defaultValue: 72,
      min: 0,
      max: 100,
      step: 1,
    },
    72,
  ),
  text: fixture(
    {
      id: "transform",
      name: "Transform",
      type: "text",
      description: "Runs against each selected item.",
      singleLine: false,
      defaultValue: "return item.title.trim();",
    },
    "return item.title.trim();",
  ),
  markdown: fixture(
    {
      id: "release-notes",
      name: "Release notes",
      type: "markdown",
      description: "Rich Markdown editing.",
      placeholder: "Describe this release...",
      defaultValue: "# Release notes\n\nThis release improves parameter editor parity.\n\n- [x] Shared controls",
    },
    "# Release notes\n\nThis release improves parameter editor parity.\n\n- [x] Shared controls",
  ),
  selection: fixture(
    {
      id: "role",
      name: "Role",
      type: "selection",
      description: "Select a role.",
      defaultValue: "assistant",
      options: [
        { id: "user", name: "User", icon: "user" },
        { id: "assistant", name: "Assistant", icon: "code" },
        { id: "system", name: "System", icon: "component" },
      ],
    },
    "assistant",
  ),
  date: fixture(
    {
      id: "publish-date",
      name: "Publish date",
      type: "date",
      description: "Target publication date.",
      defaultValue: "2026-07-30",
      min: "2026-01-01",
      max: "2026-12-31",
    },
    "2026-07-30",
  ),
  color: fixture(
    {
      id: "tint",
      name: "Tint",
      type: "color",
      description: "Primary output color.",
      defaultValue: "#0c8ce9",
    },
    "#0c8ce9",
  ),
  property: fixture({
    id: "version",
    name: "Version",
    type: "property",
    description: "Current package version.",
    value: "1.4.0",
  }),
  readOnly: fixture({
    id: "verified",
    name: "Verified",
    type: "readOnly",
    description: "Serializable display-only value.",
    value: true,
  }),
  resource: fixture(
    {
      id: "labels",
      name: "Labels",
      type: "resource",
      description: "Resources rendered using the tag primitive.",
      editable: true,
      multiSelect: true,
      placeholder: "Add label",
      defaultValue: ["bug", "docs"],
      options: [
        { id: "bug", name: "Bug", icon: "bug", color: "red" },
        { id: "feature", name: "Feature", icon: "sparkles", color: "purple" },
        { id: "docs", name: "Docs", icon: "book-open", color: "blue" },
      ],
    },
    ["bug", "docs"],
  ),
  reference: fixture(
    {
      id: "references",
      name: "References",
      type: "resource",
      description: "Resources that open in their owning surface.",
      multiSelect: true,
      defaultValue: ["ticket", "pull-request"],
      options: [
        { id: "ticket", name: "PS-42", icon: "ticket", ref: { type: "ticket", id: "PS-42" } },
        { id: "pull-request", name: "PR #7", icon: "git-pull-request", href: "https://example.com/pull/7" },
      ],
    },
    ["ticket", "pull-request"],
  ),
  range: fixture(
    {
      id: "trim",
      name: "Trim",
      type: "range",
      description: "Select the visible interval.",
      defaultValue: [12, 84],
      min: 0,
      max: 100,
      step: 1,
      unit: "%",
    },
    [12, 84],
  ),
  segmented: fixture(
    {
      id: "quality",
      name: "Quality",
      type: "segmented",
      description: "Select one output mode.",
      defaultValue: "balanced",
      options: [
        { id: "draft", name: "Draft" },
        { id: "balanced", name: "Balanced" },
        { id: "detailed", name: "Detailed" },
      ],
    },
    "balanced",
  ),
  actions: fixture({
    id: "align",
    name: "Align",
    type: "actions",
    description: "Apply an alignment command.",
    options: [
      { id: "left", name: "Left" },
      { id: "center", name: "Center" },
      { id: "right", name: "Right" },
      { id: "justify", name: "Justify", disabled: true },
    ],
  }),
  anchorGrid: fixture(
    {
      id: "anchor",
      name: "Anchor",
      type: "anchorGrid",
      description: "Select an anchor position.",
      defaultValue: "center",
    },
    "center",
  ),
  vector: fixture(
    {
      id: "offset",
      name: "Offset",
      type: "vector",
      description: "Cartesian x/y offset.",
      defaultValue: { x: 0, y: 0 },
      xLabel: "X",
      yLabel: "Y",
      min: -100,
      max: 100,
      step: 1,
    },
    { x: 0, y: 0 },
  ),
  fileUpload: fixture(
    {
      id: "attachments",
      name: "Attachments",
      type: "fileUpload",
      description: "Queued files and host-controlled upload status.",
      uploadLabel: "Attach files",
      multiple: true,
      defaultValue: uploadingFiles,
    },
    uploadingFiles,
  ),
} satisfies Record<string, ParamEditorInputFixture>;
