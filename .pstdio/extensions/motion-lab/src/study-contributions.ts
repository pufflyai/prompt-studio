import { defineCommandPaletteResource, defineView } from "@pstdio/sdk/extensions";
import { commands } from "./commands";
import { listStudies } from "./studies";
import { projectFiles } from "./study-commands";
import { studiesChanged } from "./study-events";
import { animation, resource, target } from "./study-navigation";
export const files = defineView({
  id: "animations",
  title: "Animations",
  icon: "folder",
  body: {
    kind: "tree",
    refreshEvents: [studiesChanged],
    defaultExpandedNodeIds: ["Chat", "Workbench", "Invalid"],
    header: () => [
      {
        id: "header",
        nodes: [],
        label: "Animations",
        actions: [{ id: "refresh", label: "Refresh", icon: "refresh-cw", command: commands["studies.refresh"].ref }],
      },
    ],
    body: async (ctx, input) => {
      const studies = await listStudies(projectFiles(ctx));
      return [
        {
          id: "animations",
          collapsible: false,
          nodes: [...new Set(studies.map((s) => s.group))].map((group) => ({
            id: group,
            label: group,
            icon: "folder",
            collapsible: true,
            children: studies
              .filter((s) => s.group === group)
              .map((study) => ({
                id: study.id,
                label: study.title,
                icon: study.ok ? "film" : "triangle-alert",
                resource: resource(study.id, input.renderer.projectId, study.title),
                target: target(study.id, input.renderer.projectId, study.title),
                selected: input.renderer.resource?.id === study.id,
              })),
          })),
        },
      ];
    },
  },
});
export const palette = defineCommandPaletteResource({
  id: "animations",
  title: "Motion Lab animations",
  resourceKind: animation.ref,
  refreshEvents: [studiesChanged],
  query: async (ctx, input) => ({
    items: (await listStudies(projectFiles(ctx)))
      .filter((study) =>
        `${study.title} ${study.description} motion lab animation`.toLowerCase().includes(input.query.toLowerCase()),
      )
      .slice(0, input.limit)
      .map((study) => ({
        id: study.id,
        label: study.title,
        icon: study.ok ? "film" : "triangle-alert",
        keywords: ["motion", "animation", "study", study.id],
        target: target(study.id, input.projectId, study.title),
      })),
  }),
});
