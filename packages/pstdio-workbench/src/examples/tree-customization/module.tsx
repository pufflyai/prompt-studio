import { Stack, Text } from "@chakra-ui/react";
import type { WorkbenchModuleContribution } from "../../core";

const customizableTreeId = "tree-customization.customizable";
const lockedTreeId = "tree-customization.locked";
const customizableTreeRendererId = customizableTreeId;
const lockedTreeRendererId = lockedTreeId;
const mainWidgetId = "tree-customization.main";
const mainRendererId = mainWidgetId;

const Panel = (props: { title: string; description: string }) => (
  <Stack p="md" gap="xs">
    <Text textStyle="title/M">{props.title}</Text>
    <Text textStyle="paragraph/S/regular" color="fg.muted">
      {props.description}
    </Text>
  </Stack>
);

export const createTreeCustomizationModule = (): WorkbenchModuleContribution => ({
  id: "tree-customization",
  activate(ctx) {
    ctx.layout.registerWidget({
      id: customizableTreeId,
      title: "Project",
      area: "left",
      singleton: true,
      rendererId: customizableTreeRendererId,
    });
    ctx.layout.registerWidget({
      id: lockedTreeId,
      title: "Settings",
      area: "main-left",
      singleton: true,
      rendererId: lockedTreeRendererId,
    });
    ctx.layout.registerWidget({
      id: mainWidgetId,
      title: "Welcome",
      area: "main",
      singleton: true,
      rendererId: mainRendererId,
    });

    ctx.renderers.registerRenderer({
      id: mainRendererId,
      render: () => (
        <Panel
          title="Customizable tree views"
          description="Right-click a section header in the left sidebar to toggle visibility, drag the grip glyph (visible on hover) to reorder. The Settings tree declares customizable: false and shows neither affordance."
        />
      ),
    });

    ctx.renderers.registerTreeRenderer({
      id: customizableTreeId,
      title: "Project",
      defaultExpandedSectionIds: ["sources", "tools", "danger-zone"],
      getBody: () => [
        {
          id: "sources",
          label: "Sources",
          collapsible: true,
          nodes: [
            { id: "sources.readme", label: "README.md" },
            { id: "sources.changelog", label: "CHANGELOG.md" },
            { id: "sources.licence", label: "LICENCE" },
          ],
        },
        {
          id: "tools",
          label: "Tools",
          collapsible: true,
          nodes: [
            { id: "tools.format", label: "Format" },
            { id: "tools.lint", label: "Lint", hiddenByDefault: true },
            { id: "tools.test", label: "Test" },
          ],
        },
        {
          id: "danger-zone",
          label: "Danger zone",
          collapsible: true,
          hiddenByDefault: true,
          nodes: [{ id: "danger.reset", label: "Reset project" }],
        },
      ],
      getChildren: () => [],
    });

    ctx.renderers.registerTreeRenderer({
      id: lockedTreeId,
      title: "Settings",
      customizable: false,
      defaultExpandedSectionIds: ["general", "advanced"],
      getBody: () => [
        {
          id: "general",
          label: "General",
          collapsible: true,
          nodes: [
            { id: "general.profile", label: "Profile" },
            { id: "general.appearance", label: "Appearance" },
          ],
        },
        {
          id: "advanced",
          label: "Advanced",
          collapsible: true,
          nodes: [
            { id: "advanced.experiments", label: "Experiments" },
            { id: "advanced.developer", label: "Developer tools" },
          ],
        },
      ],
      getChildren: () => [],
    });

    // Mount the widgets so each tree shows up in its side panel and the main
    // welcome panel renders on load. Without openWidget, registered singleton
    // widgets stay dormant and the panels appear empty.
    ctx.layout.openWidget(customizableTreeId);
    ctx.layout.openWidget(lockedTreeId);
    ctx.layout.openWidget(mainWidgetId);
  },
});
