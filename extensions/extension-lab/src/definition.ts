import type { ModeContribution, PageBoundSlot, ViewRef } from "@pstdio/sdk/extensions";
import {
  defineMode,
  defineNavigationItem,
  definePage,
  defineResourceKind,
  defineTheme,
  defineView,
  l10n,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { type ExampleName, exampleResources } from "./state-defaults";

const baseUrl = new URL("../extension.ts", import.meta.url).href;
export const webview = (id: string, title: string) =>
  defineView({
    id,
    title: l10n(`views.${id}`, title),
    body: {
      kind: "webview",
      entry: packageAsset(`./src/views/${id}.tsx`, baseUrl),
      capabilities: ["commands.execute", "navigation.open"],
    },
  });
interface ExampleDefinition {
  name: ExampleName;
  label: string;
  icon: string;
  primary: ViewRef;
  chrome?: ModeContribution["chrome"];
  floatingPanels?: ModeContribution["floatingPanels"];
  regionSettings?: ModeContribution["regionSettings"];
  slots?: PageBoundSlot[];
  initialResource?: boolean;
}
export const defineExample = (input: ExampleDefinition) => {
  const { name, label, icon } = input;
  const theme = defineTheme({
    id: name,
    title: l10n(`themes.${name}`, label),
    format: "vscode-color-theme",
    mode: name === "scribble" || name === "pigeon" ? "light" : "dark",
    source: packageAsset(`./themes/${name}.json`, baseUrl),
  });
  const resourceKind = defineResourceKind({
    id: exampleResources[name][0].type,
    label: l10n(`resources.${name}`, label),
    icon,
  });
  const mode = defineMode({
    id: name,
    label: l10n(`modes.${name}`, label),
    icon,
    regions: ["main", "side", "secondary"],
    defaultTheme: theme.ref,
    chrome: input.chrome,
    floatingPanels: input.floatingPanels,
    regionSettings: { main: { alwaysShowTabs: false }, ...input.regionSettings },
  });
  const homePage = definePage({
    id: name,
    title: l10n(`pages.${name}`, label),
    icon,
    path: name,
    mode: mode.ref,
    slots: [{ id: "content", role: "primary", region: "main", view: input.primary }],
  });
  const page = definePage({
    id: `${name}-resource`,
    title: l10n(`pages.${name}`, label),
    icon,
    path: `${name}/resource`,
    mode: mode.ref,
    parent: homePage.ref,
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        binding: { kind: resourceKind.ref, view: input.primary, cardinality: "one" },
      },
      ...(input.slots ?? []),
    ],
  });
  const navigation = defineNavigationItem({
    id: name,
    label: l10n(`navigation.${name}`, label),
    icon,
    owner: workbenchModes.project,
    group: "Examples",
    slot: "content",
    action: input.initialResource
      ? { kind: "page", page: page.ref, resource: exampleResources[name][0] }
      : { kind: "page", page: homePage.ref },
  });
  return { theme, resourceKind, mode, homePage, page, navigation };
};
