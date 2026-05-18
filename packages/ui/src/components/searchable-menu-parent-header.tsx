import { Icon } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import type { ElementType, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { Header } from "./header";
import { ListRow } from "./list-row/list-row";

interface SearchableMenuParentHeaderProps {
  ariaLabel?: string;
  disabled?: boolean;
  selectedIcon?: ElementType;
  selectedLabel: string;
  onToggle: () => void;
}

export const SearchableMenuParentHeader = (props: SearchableMenuParentHeaderProps) => {
  const { ariaLabel, disabled, selectedIcon, selectedLabel, onToggle } = props;

  const handleClick = (event: ReactMouseEvent) => {
    event.stopPropagation();
    if (disabled) return;
    onToggle();
  };

  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.stopPropagation();

    if (event.key === " ") {
      event.preventDefault();
    }

    if (disabled) return;
    onToggle();
  };

  return (
    <Header
      as="div"
      role="button"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      variant="narrow"
      px="0"
      borderBottomWidth="1px"
      borderColor="border.muted"
      flexShrink={0}
      onPointerDownCapture={(event) => event.stopPropagation()}
      onClickCapture={handleClick}
      onKeyDownCapture={handleKeyDown}
    >
      <ListRow
        asChild
        aria-hidden="true"
        variant="compact"
        id="__parent-toggle"
        label={selectedLabel}
        icon={selectedIcon ? <Icon as={selectedIcon} boxSize="14px" /> : undefined}
        disabled={disabled}
        endContent={disabled ? undefined : <Icon as={ChevronDown} boxSize="14px" />}
      />
    </Header>
  );
};
