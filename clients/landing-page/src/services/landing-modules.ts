import { deferredComponent } from "./deferred-module";

export const ShaderDemo = deferredComponent(async () => ({
  default: (await import("../components/examples/shader-editor-demo")).ShaderEditorDemo,
}));
export const AgentDemo = deferredComponent(async () => ({
  default: (await import("../components/examples/agent-dashboard-demo")).AgentDashboardDemo,
}));
export const FormulaDemo = deferredComponent(async () => ({
  default: (await import("../components/examples/formula-glossary-demo")).FormulaGlossaryDemo,
}));
export const WhatIsPage = deferredComponent(async () => ({
  default: (await import("../components/sections/what-is-prompt-studio-view")).WhatIsPromptStudioView,
}));
export const ExamplesPage = deferredComponent(async () => ({
  default: (await import("../components/sections/examples-view")).ExamplesView,
}));
export const FeaturesPage = deferredComponent(async () => ({
  default: (await import("../components/sections/features-view")).FeaturesView,
}));
export const ReadingPage = deferredComponent(async () => ({
  default: (await import("../components/workbench/reading-content")).ReadingContent,
}));
export const DocsNavigation = deferredComponent(async () => ({
  default: (await import("../components/docs/docs-sidebar")).DocsSidebar,
}));
export const BlogNavigation = deferredComponent(async () => ({
  default: (await import("../components/blog/blog-sidebar")).BlogSidebar,
}));
export const CommandMenu = deferredComponent(async () => ({
  default: (await import("../components/workbench/command-palette-modal")).CommandPaletteModal,
}));

export const BACKGROUND_MODULES = [
  ShaderDemo,
  AgentDemo,
  FormulaDemo,
  WhatIsPage,
  ExamplesPage,
  FeaturesPage,
  ReadingPage,
  DocsNavigation,
  BlogNavigation,
  CommandMenu,
];
