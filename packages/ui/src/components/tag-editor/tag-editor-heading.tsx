import { HStack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface TagEditorHeadingProps {
  children: ReactNode;
  /** Appends the unsaved-changes marker. */
  hasChanges?: boolean;
}

/**
 * Screen heading for a tag settings panel. The asterisk stays quiet on purpose —
 * the enabled Save button in the same header is the loud signal.
 */
export const TagEditorHeading = (props: TagEditorHeadingProps) => {
  const { children, hasChanges } = props;

  return (
    <HStack gap="3xs" minWidth="0">
      <Text textStyle="label/L/medium" truncate>
        {children}
      </Text>
      {hasChanges ? (
        <Text textStyle="label/L/medium" color="fg.muted" aria-label="Unsaved changes">
          *
        </Text>
      ) : null}
    </HStack>
  );
};
