import { Button, Icon } from "@chakra-ui/react";
import { ListFilter } from "lucide-react";
import { EmptyState } from "@/components/primitives/empty-state";

interface CollectionFilterEmptyStateProps {
  ruleCount: number;
  hiddenCount: number;
  onEditFilter?: () => void;
}

/** Filter feedback leaves room for the collection's group structure below. */
export const CollectionFilterEmptyState = (props: CollectionFilterEmptyStateProps) => {
  const { ruleCount, hiddenCount, onEditFilter } = props;
  return (
    <EmptyState
      role="status"
      size="sm"
      flexShrink="0"
      icon={<Icon as={ListFilter} />}
      title="Nothing matches this view"
      description={`${ruleCount} filter ${ruleCount === 1 ? "rule hides" : "rules hide"} all ${hiddenCount} ${hiddenCount === 1 ? "item" : "items"}.`}
    >
      {onEditFilter ? (
        <Button size="2xs" variant="outline" onClick={onEditFilter}>
          <ListFilter /> Edit filter
        </Button>
      ) : null}
    </EmptyState>
  );
};
