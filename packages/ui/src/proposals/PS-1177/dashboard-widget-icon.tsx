import { Icon } from "@chakra-ui/react";
import { ChartColumn, ChartLine, Hash, Table2 } from "lucide-react";
import type { WidgetKind } from "./dashboard-fixtures";

const icons = { metric: Hash, line: ChartLine, bar: ChartColumn, table: Table2 };

export function WidgetIcon({ kind }: { kind: WidgetKind }) {
  return <Icon as={icons[kind]} aria-hidden />;
}
