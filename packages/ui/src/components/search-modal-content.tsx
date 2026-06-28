import { Box, CloseButton, Dialog, Input, InputGroup } from "@chakra-ui/react";
import type { KeyboardEventHandler, ReactNode, Ref } from "react";
import { ScrollArea, type ScrollAreaProps } from "./scroll-area";

export interface SearchModalContentProps {
  children: ReactNode;
  searchValue: string;
  searchPlaceholder: string;
  searchAriaLabel?: string;
  searchIcon?: ReactNode;
  searchInputRef?: Ref<HTMLInputElement>;
  searchAutoFocus?: boolean;
  showCloseButton?: boolean;
  closeButtonLabel?: string;
  bodyBefore?: ReactNode;
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
  scrollAreaProps?: Omit<ScrollAreaProps, "children">;
  onSearchChange: (value: string) => void;
  onSearchKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}

const searchInputStateProps = {
  borderColor: "transparent",
  outline: "none",
} as const;

const hasContent = (value: ReactNode) => value !== undefined && value !== null;

const footerJustifyContent = (hasFooterStart: boolean, hasFooterEnd: boolean) => {
  if (hasFooterStart && hasFooterEnd) return "space-between";
  if (hasFooterEnd) return "flex-end";
  return "flex-start";
};

export const SearchModalContent = (props: SearchModalContentProps) => {
  const {
    children,
    searchValue,
    searchPlaceholder,
    searchAriaLabel = searchPlaceholder,
    searchIcon,
    searchInputRef,
    searchAutoFocus,
    showCloseButton = false,
    closeButtonLabel = "Close",
    bodyBefore,
    footerStart,
    footerEnd,
    scrollAreaProps,
    onSearchChange,
    onSearchKeyDown,
  } = props;
  const hasFooterStart = hasContent(footerStart);
  const hasFooterEnd = hasContent(footerEnd);
  const { maxH = "24rem", showHorizontalScrollbar = false, ...restScrollAreaProps } = scrollAreaProps ?? {};

  return (
    <>
      <Dialog.Header px="0" py="0" borderBottomWidth="1px" borderBottomColor="border.muted">
        <InputGroup startElement={searchIcon} width="full">
          <Input
            ref={searchInputRef}
            value={searchValue}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
            autoComplete="off"
            autoFocus={searchAutoFocus}
            borderWidth="0"
            borderColor="transparent"
            borderRadius="0"
            h="3rem"
            _hover={searchInputStateProps}
            _active={searchInputStateProps}
            _focus={searchInputStateProps}
            _focusVisible={searchInputStateProps}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={onSearchKeyDown}
          />
        </InputGroup>
        {showCloseButton ? (
          <Dialog.CloseTrigger asChild>
            <CloseButton aria-label={closeButtonLabel} size="sm" mr="2" />
          </Dialog.CloseTrigger>
        ) : null}
      </Dialog.Header>
      <Dialog.Body p="0">
        {bodyBefore}
        <ScrollArea maxH={maxH} showHorizontalScrollbar={showHorizontalScrollbar} {...restScrollAreaProps}>
          {children}
        </ScrollArea>
      </Dialog.Body>
      {hasFooterStart || hasFooterEnd ? (
        <Dialog.Footer
          justifyContent={footerJustifyContent(hasFooterStart, hasFooterEnd)}
          px="sm"
          py="xs"
          borderTopWidth="1px"
          borderTopColor="border.muted"
        >
          {hasFooterStart ? <Box minW="0">{footerStart}</Box> : null}
          {hasFooterEnd ? <Box flexShrink={0}>{footerEnd}</Box> : null}
        </Dialog.Footer>
      ) : null}
    </>
  );
};
