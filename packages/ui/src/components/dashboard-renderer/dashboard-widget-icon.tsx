import { Icon } from "@chakra-ui/react";
import { ChartColumn, ChartLine, ChartPie, ChartScatter, Hash, PanelsTopLeft, Table2 } from "lucide-react";
import type { DashboardWidgetKind } from "./dashboard-types";

const icons = {
  metric: Hash,
  line: ChartLine,
  bar: ChartColumn,
  scatter: ChartScatter,
  ring: ChartPie,
  table: Table2,
  custom: PanelsTopLeft,
};

export function WidgetIcon({ kind }: { kind: DashboardWidgetKind }) {
  return <Icon as={icons[kind]} aria-hidden />;
}
