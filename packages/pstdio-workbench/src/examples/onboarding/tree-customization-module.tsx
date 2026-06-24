import { Badge, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ResourceRef, TreeNode, TreeViewSection, WorkbenchModuleContribution } from "../../core";

const TREE_ID = "onboarding.tree-customization.tree";
const DOC_WIDGET_ID = "onboarding.tree-customization.doc";
const DOC_RENDERER_ID = "onboarding.tree-customization.doc.renderer";
const DOC_KIND = "onboarding.tree-customization.doc";

const docs = [
  { id: "overview", label: "Overview", status: "Required", body: "This row is protected from customization." },
  { id: "daily", label: "Daily brief", status: "Default", body: "A regular tree row that can be hidden." },
  { id: "archive", label: "Archive", status: "Hidden", body: "Hidden by default but still available in Customize." },
  { id: "experiment", label: "Experiment", status: "Hidden", body: "Part of a hidden-by-default section." },
] as const;

const docResource = (doc: (typeof docs)[number]): ResourceRef => ({
  kind: DOC_KIND,
  uri: `${DOC_KIND}:${doc.id}`,
  id: doc.id,
  label: doc.label,
  icon: "FileText",
  metadata: { body: doc.body, status: doc.status },
});

const docById = new Map(docs.map((doc) => [doc.id, doc]));

const docNode = (id: (typeof docs)[number]["id"], options: Partial<TreeNode> = {}): TreeNode => {
  const doc = docById.get(id)!;
  const resource = docResource(doc);
  return {
    id: resource.uri,
    label: doc.label,
    description: doc.status,
    icon: resource.icon,
    resource,
    ...options,
  };
};

const treeBody = (): TreeViewSection[] => [
  {
    id: "workspace",
    label: "Workspace",
    nodes: [
      docNode("overview", { canHide: false, iconTooltip: "Pinned by the host" }),
      docNode("daily"),
      docNode("archive", { hiddenByDefault: true }),
    ],
  },
  {
    id: "experiments",
    label: "Experiments",
    hiddenByDefault: true,
    nodes: [docNode("experiment")],
  },
];

const DocPanel = (props: { resource?: ResourceRef }) => {
  const { resource } = props;
  const status = typeof resource?.metadata?.status === "string" ? resource.metadata.status : "Open";
  const body = typeof resource?.metadata?.body === "string" ? resource.metadata.body : "No document selected.";

  return (
    <ScrollArea h="full" minH="0" bg="bg" color="fg" contentProps={{ p: "lg" }}>
      <Stack gap="md" maxW="680px">
        <HStack gap="sm" wrap="wrap">
          <Text textStyle="title/S/semibold">{resource?.label ?? "Tree customization"}</Text>
          <Badge colorPalette={status === "Hidden" ? "orange" : "blue"}>{status}</Badge>
        </HStack>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          {body}
        </Text>
        <Text textStyle="paragraph/S/regular" color="fg.subtle">
          Right-click the empty tree background and use Customize to hide rows, restore hidden entries, or reset the
          tree. Protected rows stay visible.
        </Text>
      </Stack>
    </ScrollArea>
  );
};

export const createTreeCustomizationModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.tree-customization",
  activate(ctx) {
    ctx.resources.registerKind({ kind: DOC_KIND, label: "Tree document", icon: "FileText" });
    ctx.resources.registerOpener({
      id: "onboarding.tree-customization.doc-opener",
      canOpen: (resource) => resource.kind === DOC_KIND,
      open: (resource, input) =>
        ctx.layout.openWidget(DOC_WIDGET_ID, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        }),
    });

    ctx.renderers.registerRenderer({
      id: DOC_RENDERER_ID,
      render: ({ placement }) => <DocPanel resource={placement.resource} />,
    });
    ctx.layout.registerWidget({
      id: DOC_WIDGET_ID,
      title: "Document",
      area: "main",
      rendererId: DOC_RENDERER_ID,
      singleton: false,
      resourceKinds: [DOC_KIND],
    });

    ctx.renderers.registerTreeRenderer({
      id: TREE_ID,
      title: "Customizable tree",
      defaultExpandedSectionIds: ["workspace", "experiments"],
      getBody: treeBody,
      getChildren: () => [],
    });
    ctx.layout.registerWidget({
      id: TREE_ID,
      title: "Customizable tree",
      area: "left",
      areaSize: { defaultPx: 280, minPx: 240 },
      rendererId: TREE_ID,
    });
    ctx.layout.openWidget(TREE_ID);
    void ctx.resources.openResource(docResource(docs[0]));
  },
});
