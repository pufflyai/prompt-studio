import { Box } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import { Breadcrumb } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { ExtensionMenuSlot } from "@/features/extensions/components/extension-menu-slot";
import { DashboardHeader } from "@/features/project/components/dashboard-header";
import { PROJECT_SIDEBAR_STORAGE_KEY } from "@/features/project/components/project-sidebar";
import { TicketsBreadcrumbTitle } from "@/features/project/components/tickets-breadcrumb-title";

export const TicketsHeader = () => {
  const { projectId } = useParams({ strict: false });
  const breadcrumbItems: BreadcrumbItem[] = [{ title: <TicketsBreadcrumbTitle /> }];

  return (
    <DashboardHeader
      title={<Breadcrumb separator="/" separatorGap="xs" items={breadcrumbItems} />}
      sidebarStorageKey={PROJECT_SIDEBAR_STORAGE_KEY}
    >
      <Box flex="1" />
      {projectId ? (
        <>
          <ExtensionMenuSlot
            slotId="project.headerPrimary"
            slotKind="menu"
            context={{ projectId }}
            overflowLabel="Project actions"
            presentation="button-group"
          />
          <ExtensionMenuSlot
            slotId="project.headerOverflow"
            slotKind="menu"
            context={{ projectId }}
            overflowLabel="Project actions"
            presentation="overflow-menu"
          />
        </>
      ) : null}
    </DashboardHeader>
  );
};
