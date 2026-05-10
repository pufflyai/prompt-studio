import type { BreadcrumbItem } from "@pstdio/ui";
import { Breadcrumb } from "@pstdio/ui";
import { DashboardHeader } from "@/features/project/components/dashboard-header";
import { TicketsBreadcrumbTitle } from "@/features/project/components/tickets-breadcrumb-title";
import { PROJECT_SIDEBAR_STORAGE_KEY } from "@/shared/sidebar/project-sidebar";

export const TicketsHeader = () => {
  const breadcrumbItems: BreadcrumbItem[] = [{ title: <TicketsBreadcrumbTitle /> }];

  return (
    <DashboardHeader
      title={<Breadcrumb separator="/" separatorGap="xs" items={breadcrumbItems} />}
      sidebarStorageKey={PROJECT_SIDEBAR_STORAGE_KEY}
    />
  );
};
