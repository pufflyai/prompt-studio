import { Box, chakra, Flex, IconButton, Popover, Portal } from "@chakra-ui/react";
import { Check, X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";

interface InlineEditActionsProps {
  cancelLabel: string;
  saveLabel: string;
  onCancel: () => void;
  onSave: () => void;
}

const InlineEditActions = (props: InlineEditActionsProps) => {
  const { cancelLabel, saveLabel, onCancel, onSave } = props;

  return (
    <Flex gap="2xs" flexShrink="0">
      <IconButton type="button" size="2xs" variant="ghost" aria-label={saveLabel} onClick={onSave}>
        <Check />
      </IconButton>
      <IconButton type="button" size="2xs" variant="ghost" aria-label={cancelLabel} onClick={onCancel}>
        <X />
      </IconButton>
    </Flex>
  );
};

interface EditModeTextSurfaceProps {
  accessibleName: string;
  textStyle: string;
  value: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
}

const EditModeTextSurface = (props: EditModeTextSurfaceProps) => {
  const { accessibleName, textStyle, value, onCancel, onChange, onSave } = props;
  const elementRef = useRef<HTMLDivElement>(null);
  const initialValueRef = useRef(value);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.textContent = initialValueRef.current;
    element.focus();
    const selection = globalThis.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSave();
    }
    if (event.key === "Escape") onCancel();
  };

  return (
    <chakra.div
      ref={elementRef}
      role="textbox"
      aria-label={accessibleName}
      contentEditable
      suppressContentEditableWarning
      height="10"
      width="100%"
      paddingX="xs"
      paddingY="xs"
      overflow="hidden"
      background="transparent"
      border="none"
      borderRadius="0"
      outline="none"
      textStyle={textStyle}
      textOverflow="ellipsis"
      whiteSpace="nowrap"
      onInput={(event) => onChange(event.currentTarget.textContent ?? "")}
      onKeyDown={handleKeyDown}
    />
  );
};

interface EditModeHeaderEditorProps {
  accessibleName: string;
  draft: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
}

export const EditModeHeaderEditor = (props: EditModeHeaderEditorProps) => {
  const { accessibleName, draft, onCancel, onChange, onSave } = props;

  return (
    <Box position="absolute" inset="0" width="100%" height="10" background="bg.subtle" zIndex="1">
      <EditModeTextSurface
        accessibleName={`Rename column ${accessibleName}`}
        textStyle="label/S/medium"
        value={draft}
        onChange={onChange}
        onSave={onSave}
        onCancel={onCancel}
      />
      <Box position="absolute" top="50%" right="2xs" transform="translateY(-50%)" background="bg.subtle">
        <InlineEditActions
          saveLabel="Save column name"
          cancelLabel="Cancel column rename"
          onSave={onSave}
          onCancel={onCancel}
        />
      </Box>
    </Box>
  );
};

interface EditModeCellEditorProps {
  anchorRef: RefObject<HTMLElement | null>;
  customEditor?: ReactNode;
  draft: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
}

export const EditModeCellEditor = (props: EditModeCellEditorProps) => {
  const { anchorRef, customEditor, draft, onCancel, onChange, onSave } = props;

  return (
    <Popover.Root
      open
      closeOnInteractOutside={false}
      positioning={{
        placement: "bottom-start",
        offset: { mainAxis: -40 },
        getAnchorElement: () => anchorRef.current,
      }}
    >
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            data-table-cell-editor
            width="calc(var(--reference-width) + 3rem)"
            minWidth="calc(var(--reference-width) + 3rem)"
            maxWidth="calc(100vw - 2rem)"
            padding="0"
            overflow="hidden"
            background="bg"
            animation="none"
            zIndex="popover"
          >
            <ScrollArea
              data-table-cell-editor-body
              width="100%"
              minHeight="10"
              maxHeight="48"
              contentProps={{ minHeight: "10" }}
              viewportProps={{ maxHeight: "48", overscrollBehavior: "contain" }}
            >
              {customEditor ?? (
                <EditModeTextSurface
                  accessibleName="Edit cell"
                  textStyle="paragraph/S/regular"
                  value={draft}
                  onChange={onChange}
                  onSave={onSave}
                  onCancel={onCancel}
                />
              )}
            </ScrollArea>
            <Flex
              data-table-cell-editor-footer
              height="8"
              flexShrink="0"
              alignItems="center"
              justifyContent="flex-end"
              paddingX="xs"
              borderTopWidth="1px"
              borderColor="border.subtle"
              background="bg.subtle"
            >
              <InlineEditActions
                saveLabel="Save cell"
                cancelLabel="Cancel cell edit"
                onSave={onSave}
                onCancel={onCancel}
              />
            </Flex>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
