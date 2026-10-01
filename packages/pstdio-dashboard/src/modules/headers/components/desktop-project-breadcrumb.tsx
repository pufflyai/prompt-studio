import { HStack, Text } from "@chakra-ui/react";
import { useWorkbenchStore, WorkbenchBreadcrumbView, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { ProjectCrumb } from "../../projects/components/project-crumb";

// Desktop shows the project in its tab strip, so the breadcrumb only needs the project crumb when it
// starts inside a Sidenav level. Without it, a level page such as Sessions has no crumb to leave by.
export const DesktopProjectBreadcrumb = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const items = useWorkbenchStore(input.workbench.breadcrumbs.store, (state) => state.items) ?? [];

  return (
    <HStack gap="xs" h="full" minW="0" w="full">
      {items[0]?.startsLevel ? (
        <>
          <ProjectCrumb workbench={input.workbench} />
          <Text aria-hidden="true" color="fg.subtle" flexShrink={0}>
            /
          </Text>
        </>
      ) : null}
      <WorkbenchBreadcrumbView workbench={input.workbench} />
    </HStack>
  );
};
