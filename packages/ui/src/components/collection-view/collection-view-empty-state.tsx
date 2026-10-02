import { Button, Icon } from "@chakra-ui/react";
import { ListFilter, SearchX, X } from "lucide-react";
import { EmptyState } from "@/components/primitives/empty-state";

export interface CollectionViewEmptyStateProps {
  search: string;
  ruleCount: number;
  /** How many rows the view's filter hides. */
  hiddenCount: number;
  onClearSearch: () => void;
  onEditFilter: () => void;
}

/** Names what hides the rows and offers the one action that brings them back. Search comes first: it is the latest thing the person did. */
export const CollectionViewEmptyState = (props: CollectionViewEmptyStateProps) => {
  const { search, ruleCount, hiddenCount, onClearSearch, onEditFilter } = props;

  if (search.trim())
    return (
      <EmptyState
        h="full"
        icon={<Icon as={SearchX} />}
        title={`No results for “${search.trim()}”`}
        description="Search looks at the titles and properties this view shows."
      >
        <Button size="2xs" variant="outline" onClick={onClearSearch}>
          <X />
          Clear search
        </Button>
      </EmptyState>
    );

  return (
    <EmptyState
      h="full"
      icon={<Icon as={ListFilter} />}
      title="Nothing matches this view"
      description={`${ruleCount} filter ${ruleCount === 1 ? "rule hides" : "rules hide"} all ${hiddenCount} ${hiddenCount === 1 ? "item" : "items"}.`}
    >
      <Button size="2xs" variant="outline" onClick={onEditFilter}>
        <ListFilter />
        Edit filter
      </Button>
    </EmptyState>
  );
};
