import type { PreferenceSchemaContribution } from "../../core";

// Demo preference schema. Global (user) values apply everywhere; project values are
// scoped to the active project. The workbench auto-renders these as a param editor.
export const demoPreferenceSchema = {
  properties: {
    "demo.appearance.theme": {
      type: "string",
      enum: ["system", "light", "dark"],
      default: "system",
      scope: "user",
      description: "Color theme applied across the workbench.",
    },
    "demo.appearance.density": {
      type: "string",
      enum: ["comfortable", "compact"],
      default: "comfortable",
      scope: "user",
      description: "Spacing used for lists, trees, and toolbars.",
    },
    "demo.appearance.badges": {
      type: "boolean",
      default: true,
      scope: "user",
      description: "Show count badges on sidenav entries.",
    },
    "demo.editor.fontSize": {
      type: "number",
      default: 13,
      scope: "project",
      description: "Editor font size in pixels (per project).",
    },
    "demo.editor.wordWrap": {
      type: "boolean",
      default: false,
      scope: "project",
      description: "Wrap long lines to the editor width (per project).",
    },
    "demo.editor.rulers": {
      type: "array",
      enum: ["80", "100", "120"],
      default: ["80"],
      scope: "project",
      description: "Columns where vertical rulers are drawn (per project).",
    },
  },
} satisfies PreferenceSchemaContribution;

// Local demo data for the collection example. "Snippet" is a neutral stand-in — the
// framework knows nothing about it; the example owns the data and the editor.
export interface DemoSnippet {
  id: string;
  name: string;
  category: string;
  body: string;
}

const snippets: DemoSnippet[] = [
  { id: "greeting", name: "Greeting", category: "Prose", body: "Hello there!" },
  { id: "signoff", name: "Sign-off", category: "Prose", body: "Best,\n" },
  { id: "fixme", name: "FIXME", category: "Code", body: "// FIXME: " },
];

let created = 0;

export const demoSnippets = {
  list: () => [...snippets],
  create: () => {
    created += 1;
    snippets.push({ id: `snippet-${created}`, name: `New snippet ${created}`, category: "Prose", body: "" });
  },
};
