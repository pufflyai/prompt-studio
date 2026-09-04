import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { PageRef } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../../core";

const pageRef = (id: string): PageRef => ({ extensionId: "host.breadcrumb-example", kind: "page", id });

interface BreadcrumbPage {
  id: string;
  ref: PageRef;
  title: string;
  icon: string;
  path: string;
  parentId?: string;
}

const breadcrumbPages: readonly BreadcrumbPage[] = [
  {
    id: "host.breadcrumb.root",
    ref: pageRef("root"),
    title: "Prompt Studio",
    icon: "FolderGit2",
    path: "review",
  },
  {
    id: "host.breadcrumb.pull-requests",
    ref: pageRef("pull-requests"),
    title: "Pull requests",
    icon: "GitPullRequest",
    path: "review/pull-requests",
    parentId: "host.breadcrumb.root",
  },
  {
    id: "host.breadcrumb.pull-request",
    ref: pageRef("pull-request"),
    title: "#646 Additive pages",
    icon: "GitPullRequest",
    path: "review/pull-requests/646",
    parentId: "host.breadcrumb.pull-requests",
  },
  {
    id: "host.breadcrumb.files",
    ref: pageRef("files"),
    title: "Files changed",
    icon: "Files",
    path: "review/pull-requests/646/files",
    parentId: "host.breadcrumb.pull-request",
  },
  {
    id: "host.breadcrumb.file",
    ref: pageRef("file"),
    title: "workbench-core.ts",
    icon: "FileCode2",
    path: "review/pull-requests/646/files/workbench-core",
    parentId: "host.breadcrumb.files",
  },
];

export const createBreadcrumbWorkbench = () => {
  const workbench = createWorkbench({ startPage: breadcrumbPages[0]!.ref });
  workbench.modes.registerMode({ id: "review", label: "Review", activate: () => undefined });

  for (const page of breadcrumbPages) {
    const viewId = `${page.id}.view`;
    workbench.views.registerView({
      id: viewId,
      title: page.title,
      body: {
        kind: "react",
        render: ({ workbench }) => (
          <Stack h="full" gap="md" p="lg" bg="bg">
            <Stack gap="xs">
              <Text textStyle="heading/M/semibold">{page.title}</Text>
              <Text color="fg.muted">
                This is a real page location. Use Back and Forward in the header to move through the five-page history.
              </Text>
            </Stack>
            <HStack gap="sm" flexWrap="wrap">
              {breadcrumbPages.map((target) => (
                <Button
                  key={target.id}
                  size="sm"
                  variant="outline"
                  disabled={target.id === page.id}
                  onClick={() => workbench.pageLocations.navigate({ kind: "page", page: target.ref })}
                >
                  Open {target.title}
                </Button>
              ))}
            </HStack>
          </Stack>
        ),
      },
    });
    workbench.pages.registerPage({
      id: page.id,
      ref: page.ref,
      title: page.title,
      icon: page.icon,
      path: page.path,
      modeId: "review",
      parentId: page.parentId,
      slots: [{ id: "content", role: "primary", region: "main", viewId }],
    });
  }

  workbench.pageLocations.switchProject("breadcrumb-story");
  for (const page of breadcrumbPages.slice(1)) {
    workbench.pageLocations.navigate({ kind: "page", page: page.ref });
  }
  return workbench;
};
