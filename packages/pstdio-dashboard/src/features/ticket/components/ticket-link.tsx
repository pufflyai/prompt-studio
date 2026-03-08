import { Button } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";

interface TicketLinkProps {
  label: string;
  title?: string;
  onSelect?: () => void;
  isDisabled?: boolean;
}

export const TicketLink = (props: TicketLinkProps) => {
  const { label, title, onSelect, isDisabled = false } = props;

  return (
    <Tooltip content={title ?? label}>
      <Button size="sm" _hover={{ bg: "background.tertiary" }} onClick={onSelect} disabled={isDisabled}>
        {label}
      </Button>
    </Tooltip>
  );
};
