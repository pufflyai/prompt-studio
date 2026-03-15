import { useTranslation } from "react-i18next";
import { DashboardHeader } from "@/features/project/components/dashboard-header";
import { PROJECT_SIDEBAR_STORAGE_KEY } from "@/features/project/components/project-sidebar";

export const TicketsHeader = () => {
  const { t } = useTranslation("tickets");

  return <DashboardHeader title={t("ticketListHeader.title")} sidebarStorageKey={PROJECT_SIDEBAR_STORAGE_KEY} />;
};
