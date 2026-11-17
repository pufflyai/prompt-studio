import { Spinner } from "@chakra-ui/react";
import { type ComponentProps, lazy, Suspense } from "react";
import type { WorkbenchDataTableView as DataTableView } from "./data-table-view";

const DataTable = lazy(() =>
  import("./data-table-view").then((module) => ({ default: module.WorkbenchDataTableView })),
);

export const WorkbenchDataTableView = (props: ComponentProps<typeof DataTableView>) => (
  <Suspense fallback={<Spinner />}>
    <DataTable {...props} />
  </Suspense>
);
