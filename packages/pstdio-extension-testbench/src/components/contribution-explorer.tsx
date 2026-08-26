import { Box, Button } from "@chakra-ui/react";
import type { ResourceRef, WorkbenchCore } from "@pstdio/workbench";
import { settingsPanelResource } from "@pstdio/workbench/react";
import { formatForDisplay } from "@tanstack/hotkeys";
import { text } from "pstdio-extensions/workbench";
import type { ExtensionBenchLoadResponse } from "../lib/api-contract";
import { isViewForResourceKind } from "../lib/resource-bindings";
import { contentContributionWidgetId } from "./content-contribution-panel";
import { MenuSelect } from "./menu-select";

type Platform = "mac" | "windows" | "linux";

const detectExplorerPlatform = (): Platform => {
  if (typeof navigator === "undefined") return "linux";
  const platform = navigator.platform?.toLowerCase() ?? "";
  if (platform.includes("mac")) return "mac";
  if (platform.includes("win")) return "windows";
  return "linux";
};

interface ContributionExplorerProps {
  bench: ExtensionBenchLoadResponse;
  resource: ResourceRef;
  workbench: WorkbenchCore;
}

const openResource = (workbench: WorkbenchCore, resource: ResourceRef) => {
  void workbench.resources.openResource(resource).catch(() => undefined);
};

interface ContributionMenuItem {
  id: string;
  label: string;
  description?: string;
  onActivate(): void;
}

const ContributionSelect = (props: { count: number; items: ContributionMenuItem[]; label: string }) => {
  const { count, items, label } = props;

  return (
    <MenuSelect
      label={label}
      value=""
      placeholder={`${label} (${count})`}
      options={items.map((item) => ({ value: item.id, label: item.label, description: item.description }))}
      disabled={count === 0}
      flex="0 0 136px"
      minW="0"
      size="xs"
      contentMinW="240px"
      onSelect={(itemId) => {
        const item = items.find((candidate) => candidate.id === itemId);
        item?.onActivate();
      }}
    />
  );
};

const ContributionButton = (props: { label: string; onClick(): void }) => {
  const { label, onClick } = props;

  return (
    <Button
      flexShrink="0"
      maxW="180px"
      minW="0"
      onClick={onClick}
      overflow="hidden"
      size="xs"
      textOverflow="ellipsis"
      type="button"
      variant="outline"
      whiteSpace="nowrap"
    >
      {label}
    </Button>
  );
};

const clearResourcePanels = (workbench: WorkbenchCore) => {
  workbench.layout.clearRegion("main");
  workbench.layout.clearRegion("main-left-menu");
  workbench.layout.clearRegion("main-right-menu");
};

const viewItems = (props: ContributionExplorerProps) => {
  const { bench, resource, workbench } = props;

  return bench.metadata.views.map((view) => ({
    id: view.id,
    label: text(view.title, view.id),
    description: view.id,
    onActivate: () => {
      void workbench.views.openView(view.id, {
        pinned: true,
        resource: isViewForResourceKind(bench.metadata, view.localId, resource.kind) ? resource : undefined,
        title: text(view.title, view.id),
      });
    },
  }));
};

const dataItems = (props: ContributionExplorerProps) => {
  const { bench, workbench } = props;

  return bench.metadata.views
    .filter((view) => view.body.kind === "kanban")
    .map((view) => ({
      id: view.id,
      label: text(view.title, view.id),
      description: view.id,
      onActivate: () => {
        clearResourcePanels(workbench);
        void workbench.views.openView(view.id, {
          pinned: true,
          title: text(view.title, view.id),
        });
      },
    }));
};

const settingsItems = (props: ContributionExplorerProps) => {
  const { bench, workbench } = props;

  return bench.metadata.settingsPanels.map((panel) => {
    const view = bench.metadata.views.find((candidate) => candidate.localId === panel.view.id);
    const title = text(view?.title, panel.id);
    return {
      id: panel.id,
      label: title,
      description: panel.id,
      onActivate: () => openResource(workbench, settingsPanelResource({ id: panel.id, title })),
    };
  });
};

const routeItems = (props: ContributionExplorerProps) => {
  const { bench, workbench } = props;

  return bench.metadata.views
    .filter((view) => view.path)
    .map((view) => ({
      id: view.id,
      label: text(view.title, view.id),
      description: view.path,
      onActivate: () => void workbench.views.openView(view.id, { pinned: true }),
    }));
};

const modeItems = (props: ContributionExplorerProps) => {
  const { bench, workbench } = props;

  return bench.metadata.modes.map((mode) => ({
    id: mode.id,
    label: text(mode.label, mode.id),
    description: mode.id,
    onActivate: () => workbench.modes.setActiveMode(mode.id),
  }));
};

const keybindingItems = (props: ContributionExplorerProps) => {
  const platform = detectExplorerPlatform();
  const otherPlatforms: Platform[] = (["mac", "windows", "linux"] as Platform[]).filter(
    (candidate) => candidate !== platform,
  );

  return (props.bench.metadata.keybindings ?? []).map((binding) => {
    const sourceChord = binding.platformOverrides?.[platform === "windows" ? "win" : platform] ?? binding.key;
    const primary = formatForDisplay(sourceChord, { platform, useSymbols: false });
    const secondary = otherPlatforms
      .map((other) => {
        const otherChord = binding.platformOverrides?.[other === "windows" ? "win" : other] ?? binding.key;
        return `${other}: ${formatForDisplay(otherChord, { platform: other, useSymbols: false })}`;
      })
      .join(" · ");

    return {
      id: binding.id,
      label: `${primary} → ${binding.commandId}`,
      description: secondary,
      onActivate: () => undefined,
    };
  });
};

const diagnosticItems = (props: ContributionExplorerProps) =>
  props.bench.metadata.diagnostics.map((diagnostic, index) => ({
    id: `${diagnostic.code}-${index}`,
    label: `${diagnostic.severity}: ${diagnostic.code}`,
    description: diagnostic.message,
    onActivate: () => undefined,
  }));

const commandItems = (props: ContributionExplorerProps) => {
  const { bench, workbench } = props;

  return bench.metadata.commands.map((command) => {
    const label = text(command.title, command.id);

    return {
      id: command.id,
      label,
      description: text(command.description, command.id),
      onActivate: () => workbench.commandPalette.open({ initialQuery: `> ${label}` }),
    };
  });
};

const treeViewItems = (props: ContributionExplorerProps) => {
  const { bench, resource, workbench } = props;

  return bench.metadata.views
    .filter((view) => view.body.kind === "tree")
    .map((view) => ({
      id: view.id,
      label: text(view.title, view.id),
      description: view.id,
      onActivate: () =>
        void workbench.views.openView(view.id, {
          pinned: true,
          resource: isViewForResourceKind(bench.metadata, view.localId, resource.kind) ? resource : undefined,
          title: text(view.title, view.id),
        }),
    }));
};

const detail = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(" · ");

const contentItems = <T extends { id: string; title: Parameters<typeof text>[0] }>(
  props: ContributionExplorerProps,
  kind: Parameters<typeof contentContributionWidgetId>[0],
  entries: readonly T[],
  describe: (entry: T) => string,
) => {
  const { workbench } = props;

  return entries.map((entry) => ({
    id: entry.id,
    label: text(entry.title, entry.id),
    description: describe(entry),
    onActivate: () => {
      clearResourcePanels(workbench);
      workbench.layout.openPanel(contentContributionWidgetId(kind, entry.id), {
        pinned: true,
        title: text(entry.title, entry.id),
      });
    },
  }));
};

const templateItems = (props: ContributionExplorerProps) =>
  contentItems(props, "template", props.bench.inventory.templates, (template) =>
    detail(template.type, text(template.description), template.sourcePath),
  );

const skillItems = (props: ContributionExplorerProps) =>
  contentItems(props, "skill", props.bench.inventory.skills, (skill) =>
    detail(text(skill.description), skill.sourcePath),
  );

const themeItems = (props: ContributionExplorerProps) =>
  contentItems(props, "theme", props.bench.inventory.themes, (theme) =>
    detail(theme.mode, theme.format, text(theme.description), theme.sourcePath),
  );

const fileIconThemeItems = (props: ContributionExplorerProps) =>
  contentItems(props, "fileIconTheme", props.bench.inventory.fileIconThemes, (theme) =>
    detail(theme.format, text(theme.description), theme.sourcePath),
  );

const contributionMenus = (props: ContributionExplorerProps) => {
  const menus = [
    { label: "Commands", items: commandItems(props) },
    { label: "Keybindings", items: keybindingItems(props) },
    { label: "Views", items: viewItems(props) },
    { label: "Trees", items: treeViewItems(props) },
    { label: "Data", items: dataItems(props) },
    { label: "Templates", items: templateItems(props) },
    { label: "Skills", items: skillItems(props) },
    { label: "Themes", items: themeItems(props) },
    { label: "Icons", items: fileIconThemeItems(props) },
    { label: "Settings", items: settingsItems(props) },
    { label: "Paths", items: routeItems(props) },
    { label: "Modes", items: modeItems(props) },
    { label: "Diagnostics", items: diagnosticItems(props) },
  ];

  return menus satisfies { label: string; items: ContributionMenuItem[] }[];
};

export const ContributionExplorer = (props: ContributionExplorerProps) => {
  const { resource, workbench } = props;

  return (
    <Box
      as="aside"
      alignItems="center"
      aria-label="Extension contributions"
      bg="bg.panel"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      display="flex"
      gap="2"
      minW="0"
      overflowX="auto"
      p="2"
    >
      {contributionMenus(props).map((menu) => (
        <ContributionSelect key={menu.label} count={menu.items.length} items={menu.items} label={menu.label} />
      ))}
      <Box flex="1" minW="3" />
      <ContributionButton label={resource.id ?? resource.uri} onClick={() => openResource(workbench, resource)} />
    </Box>
  );
};
