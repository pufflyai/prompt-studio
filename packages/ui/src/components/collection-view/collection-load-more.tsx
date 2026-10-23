import { Button, Icon } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";

/** Uses the shared activity feed's keyboard-accessible load action. */
export const CollectionLoadMore = (props: { loading?: boolean; onLoadMore: () => void; label: string }) => (
  <Button type="button" variant="ghost" size="2xs" width="full" loading={props.loading} onClick={props.onLoadMore}>
    <Icon as={ChevronDown} boxSize="3" />
    {props.label}
  </Button>
);
