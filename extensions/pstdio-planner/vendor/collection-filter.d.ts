import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor, buildFilterCategories } from "@pstdio/ui/kanban-renderer";
import type { ReactElement } from "react";

/** Temporary packaged public UI control. See ADR 0071. */
interface CollectionFilterProps {
  itemLabel?: string;
  fields: AttributeDescriptor[];
  filter: ViewFilterGroup;
  optionsFor: (field: AttributeDescriptor) => ReturnType<typeof buildFilterCategories>[number]["options"];
  onFilterChange: (filter: ViewFilterGroup) => void;
}
export declare function CollectionFilter(props: CollectionFilterProps): ReactElement;
