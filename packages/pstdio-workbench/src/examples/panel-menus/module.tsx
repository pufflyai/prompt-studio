import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { createWorkbenchCore, type WorkbenchWidgetRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";

const rendererId = "panel-menus.renderer";

const PanelContent = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  return (
    <Stack h="full" minH="0" gap="md" p="lg" bg="bg">
      <HStack gap="xs">
        <WorkbenchIcon name="panel-top" size={16} />
        <Text textStyle="heading/M">{input.widget.title}</Text>
      </HStack>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Each docked menu belongs to this panel. Switch tabs to see the menu set follow its host.
      </Text>
    </Stack>
  );
};

const MenuContent = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  return (
    <Stack w="full" gap="xs" p="xs">
      <Text textStyle="label/XS/medium" color="fg.muted">
        {input.widget.title}
      </Text>
      <Button size="2xs" variant="ghost" justifyContent="flex-start">
        <WorkbenchIcon name="circle-dot" size={12} />
        Option one
      </Button>
      <Button size="2xs" variant="ghost" justifyContent="flex-start">
        <WorkbenchIcon name="circle-dot" size={12} />
        Option two
      </Button>
    </Stack>
  );
};

export const createPanelMenusWorkbench = () => {
  const workbench = createWorkbenchCore();
  workbench.renderers.registerRenderer({
    id: rendererId,
    render: (input) =>
      "menu" in input.widget && input.widget.menu ? <MenuContent input={input} /> : <PanelContent input={input} />,
  });

  workbench.layout.registerWidget({
    id: "panel-menus.editor",
    title: "Editor",
    area: "main",
    rendererId,
    closable: true,
  });
  workbench.layout.registerWidget({
    id: "panel-menus.preview",
    title: "Preview",
    area: "main",
    rendererId,
    closable: true,
  });
  workbench.layout.registerWidget({
    id: "panel-menus.files",
    title: "Files",
    area: "main",
    rendererId,
    menu: { host: "panel-menus.editor", side: "left", icon: "paperclip" },
  });
  workbench.layout.registerWidget({
    id: "panel-menus.properties",
    title: "Properties",
    area: "main",
    rendererId,
    menu: { host: "panel-menus.editor", side: "right", icon: "sliders-horizontal" },
  });
  workbench.layout.registerWidget({
    id: "panel-menus.preview-details",
    title: "Preview details",
    area: "main",
    rendererId,
    menu: { host: "panel-menus.preview", side: "right", icon: "scan-search" },
  });

  workbench.layout.openWidget("panel-menus.editor");
  workbench.layout.openWidget("panel-menus.files");
  workbench.layout.openWidget("panel-menus.properties");
  workbench.layout.openWidget("panel-menus.preview");
  workbench.layout.openWidget("panel-menus.preview-details");
  workbench.layout.activateWidget("panel-menus.editor");

  return workbench;
};
