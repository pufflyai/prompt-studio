import { Button, Icon } from "@chakra-ui/react";
import { SearchX, X } from "lucide-react";
import { EmptyState } from "@/components/primitives/empty-state";

export interface CollectionViewEmptyStateProps {
  search: string;
  onClearSearch: () => void;
}

/** Search feedback offers a direct way back to the collection. */
export const CollectionViewEmptyState = (props: CollectionViewEmptyStateProps) => {
  const { search, onClearSearch } = props;
  return (
    <EmptyState
      h="full"
      icon={<Icon as={SearchX} />}
      title={`No results for “${search.trim()}”`}
      description="Search looks at the titles and properties this view shows."
    >
      <Button size="2xs" variant="outline" onClick={onClearSearch}>
        <X /> Clear search
      </Button>
    </EmptyState>
  );
};
