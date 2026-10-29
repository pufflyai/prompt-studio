import type {
  ModeContribution,
  PageContribution,
  PageSlot,
  ViewRef,
  WebviewCapabilityDeclaration,
} from "@pstdio/sdk/extensions";
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
import { exampleResources } from "./state-defaults";

const baseUrl = new URL("../extension.ts", import.meta.url).href;
export const webview = (id: string, title: string, capabilities: WebviewCapabilityDeclaration[] = []) =>
  defineView({
    id,
    title: l10n(`views.${id}`, title),
    body: {
      kind: "webview",
      entry: packageAsset(`./src/views/${id}.tsx`, baseUrl),
      capabilities: [
        "commands.execute",
        "navigation.open",
        "page.params.update",
        "editing.session",
        "overlays",
        ...capabilities,
      ],
    },
  });
interface ExampleEnvironment {
  name: keyof typeof exampleResources;
  label: string;
  icon: string;
  regions?: ModeContribution["regions"];
  chrome?: ModeContribution["chrome"];
  floatingPanels?: ModeContribution["floatingPanels"];
  canFullscreen?: ModeContribution["canFullscreen"];
  regionSettings?: ModeContribution["regionSettings"];
}
interface ExampleDefinition extends ExampleEnvironment {
  primary: ViewRef;
  slots?: PageSlot[];
  initialResource?: boolean;
  params?: PageContribution["params"];
}
export const defineExampleEnvironment = (input: ExampleEnvironment) => {
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
    regions: input.regions ?? ["main", "side", "secondary"],
    defaultTheme: theme.ref,
    chrome: input.chrome,
    floatingPanels: input.floatingPanels,
    canFullscreen: input.canFullscreen,
    regionSettings: { main: { alwaysShowTabs: false }, ...input.regionSettings },
  });
  return { theme, resourceKind, mode };
};

export const defineExample = (input: ExampleDefinition) => {
  const { theme, resourceKind, mode } = defineExampleEnvironment(input);
  const { name, label, icon } = input;
  const homePage = definePage({
    id: name,
    title: l10n(`pages.${name}`, label),
    icon,
    path: name,
    mode: mode.ref,
    params: input.params,
    main: {
      kind: "view",
      view: input.primary,
      cardinality: "one",
    },
    slots: [],
  });
  const page = definePage({
    id: `${name}-resource`,
    title: l10n(`pages.${name}`, label),
    icon,
    path: `${name}/resource`,
    mode: mode.ref,
    parent: homePage.ref,
    params: input.params,
    resource: {
      kinds: [resourceKind.ref],
    },
    main: {
      kind: "view",
      view: input.primary,
      cardinality: "one",
    },
    slots: [...(input.slots ?? [])],
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

export const definePageExample = (input: Omit<ExampleDefinition, "initialResource">) => {
  const { theme, resourceKind, mode } = defineExampleEnvironment(input);
  const { name, label, icon } = input;
  const page = definePage({
    id: name,
    title: l10n(`pages.${name}`, label),
    icon,
    path: name,
    mode: mode.ref,
    params: input.params,
    main: { kind: "view", view: input.primary, cardinality: "one", presentation: "page" },
    slots: input.slots ?? [],
  });
  const navigation = defineNavigationItem({
    id: name,
    label: l10n(`navigation.${name}`, label),
    icon,
    owner: workbenchModes.project,
    group: "Examples",
    slot: "content",
    action: { kind: "page", page: page.ref },
  });
  return { theme, resourceKind, mode, page, navigation };
};
