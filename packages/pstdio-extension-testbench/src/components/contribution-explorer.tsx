import { Box, Button, NativeSelect } from "@chakra-ui/react";
import { text } from "pstdio-extensions/workbench";
import type { ResourceRef, WorkbenchCore } from "pstdio-workbench/core";
import { settingsPanelResource } from "pstdio-workbench/react";
import type { ExtensionBenchLoadResponse } from "../lib/api-contract";
import { contentContributionWidgetId } from "./content-contribution-panel";

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
    <NativeSelect.Root disabled={count === 0} flex="0 0 136px" minW="0" size="xs">
      <NativeSelect.Field
        aria-label={label}
        value=""
        onChange={(event) => {
          const item = items.find((candidate) => candidate.id === event.currentTarget.value);
          item?.onActivate();
        }}
      >
        <option value="">
          {label} ({count})
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
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
  workbench.layout.clearArea("main");
  workbench.layout.clearArea("main-left");
  workbench.layout.clearArea("main-right");
};

const viewItems = (props: ContributionExplorerProps) => {
  const { bench, resource, workbench } = props;

  return bench.metadata.views.map((view) => ({
    id: view.id,
    label: text(view.title, view.id),
    description: view.id,
    onActivate: () => {
      const isModal = view.surface === "modal";
      workbench.layout.openWidget(view.id, {
        closable: isModal ? true : undefined,
        pinned: !isModal,
        resource: view.resourceKind === resource.kind ? resource : undefined,
        title: text(view.title, view.id),
      });
    },
  }));
};

const dataItems = (props: ContributionExplorerProps) => {
  const { bench, workbench } = props;

  return (bench.metadata.dataRenderers ?? []).map((renderer) => ({
    id: renderer.id,
    label: text(renderer.title, renderer.id),
    description: renderer.id,
    onActivate: () => {
      clearResourcePanels(workbench);
      workbench.layout.openWidget(renderer.id, {
        pinned: true,
        title: text(renderer.title, renderer.id),
      });
    },
  }));
};

const settingsItems = (props: ContributionExplorerProps) => {
  const { bench, workbench } = props;

  return bench.metadata.settingsPanels.map((panel) => ({
    id: panel.id,
    label: text(panel.title, panel.id),
    description: panel.id,
    onActivate: () =>
      openResource(
        workbench,
        settingsPanelResource({
          id: panel.id,
          title: text(panel.title, panel.id),
        }),
      ),
  }));
};

const routeItems = (props: ContributionExplorerProps) => {
  const { bench, workbench } = props;

  return bench.metadata.routes.map((route) => ({
    id: route.id,
    label: text(route.label, route.id),
    description: route.path,
    onActivate: () => workbench.layout.openWidget(route.id, { pinned: true, title: text(route.label, route.id) }),
  }));
};

const modeItems = (props: ContributionExplorerProps) => {
  const { bench, workbench } = props;

  return bench.metadata.modes.map((mode) => ({
    id: mode.modeId,
    label: text(mode.label, mode.modeId),
    description: mode.modeId,
    onActivate: () => workbench.modes.setActiveMode(mode.modeId),
  }));
};

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

const treeRendererItems = (props: ContributionExplorerProps) => {
  const { bench, resource, workbench } = props;

  return (bench.metadata.treeRenderers ?? []).map((renderer) => {
    const view = bench.metadata.views.find((candidate) => candidate.treeRendererId === renderer.id);
    const widgetId = view?.id ?? `extension-testbench.tree.${renderer.id}`;
    const title = text(view?.title ?? renderer.title, renderer.id);

    return {
      id: renderer.id,
      label: title,
      description: renderer.id,
      onActivate: () => {
        if (!view && !workbench.layout.getWidget(widgetId)) {
          workbench.layout.registerWidget({
            id: widgetId,
            title,
            area: "main-left",
            rendererId: renderer.id,
            resourceKinds: [resource.kind],
          });
        }

        workbench.layout.openWidget(widgetId, {
          pinned: true,
          resource: view?.resourceKind === resource.kind || !view ? resource : undefined,
          title,
        });
      },
    };
  });
};

const detail = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(" · ");

const templateItems = (props: ContributionExplorerProps) => {
  const { bench, workbench } = props;

  return bench.inventory.templates.map((template) => ({
    id: template.id,
    label: text(template.title, template.id),
    description: detail(template.type, text(template.description), template.sourcePath),
    onActivate: () => {
      clearResourcePanels(workbench);
      workbench.layout.openWidget(contentContributionWidgetId("template", template.id), {
        pinned: true,
        title: text(template.title, template.id),
      });
    },
  }));
};

const skillItems = (props: ContributionExplorerProps) => {
  const { bench, workbench } = props;

  return bench.inventory.skills.map((skill) => ({
    id: skill.id,
    label: text(skill.title, skill.id),
    description: detail(text(skill.description), skill.sourcePath),
    onActivate: () => {
      clearResourcePanels(workbench);
      workbench.layout.openWidget(contentContributionWidgetId("skill", skill.id), {
        pinned: true,
        title: text(skill.title, skill.id),
      });
    },
  }));
};

const contributionMenus = (props: ContributionExplorerProps) => {
  const menus = [
    { label: "Commands", items: commandItems(props) },
    { label: "Views", items: viewItems(props) },
    { label: "Trees", items: treeRendererItems(props) },
    { label: "Data", items: dataItems(props) },
    { label: "Templates", items: templateItems(props) },
    { label: "Skills", items: skillItems(props) },
    { label: "Settings", items: settingsItems(props) },
    { label: "Routes", items: routeItems(props) },
    { label: "Modes", items: modeItems(props) },
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
