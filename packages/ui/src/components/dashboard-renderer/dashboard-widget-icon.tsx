import { Icon } from "@chakra-ui/react";
import { ChartColumn, ChartLine, Hash, Table2 } from "lucide-react";
import type { DashboardWidgetKind } from "./dashboard-types";

const icons = { metric: Hash, line: ChartLine, bar: ChartColumn, table: Table2 };

export function WidgetIcon({ kind }: { kind: DashboardWidgetKind }) {
  return <Icon as={icons[kind]} aria-hidden />;
}
