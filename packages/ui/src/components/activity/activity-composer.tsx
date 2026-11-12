import type { HTMLChakraProps } from "@chakra-ui/react";
import { Box, chakra, HStack, Icon, IconButton, Spacer, useSlotRecipe } from "@chakra-ui/react";
import { ArrowUp, Paperclip } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { Tooltip } from "@/components/primitives/tooltip";
import { activityComposerSlotRecipe } from "@/theme/recipes/activity-composer";
import { SendButton } from "../chat-ui/components/send-button";
import type { ActivityActor } from "./activity.types";
import { ActivityAvatar } from "./activity-avatar";
import { ActivityRichInput } from "./activity-rich-input";

export interface ActivityComposerProps extends Omit<HTMLChakraProps<"form">, "onChange" | "onSubmit"> {
  actor?: ActivityActor;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  variant?: "standalone" | "inline" | "compact";
  minRows?: number;
  attachLabel?: string;
  submitLabel?: string;
  actions?: ReactNode;
  attachmentList?: ReactNode;
  hasAttachments?: boolean;
  disabled?: boolean;
  onAttach?: () => void;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

export const ActivityComposer = (props: ActivityComposerProps) => {
  const {
    actor,
    value,
    defaultValue = "",
    placeholder = "Leave a comment...",
    variant = "standalone",
    minRows = variant === "standalone" ? 3 : 1,
    attachLabel = "Attach file",
    submitLabel = "Submit comment",
    actions,
    attachmentList,
    hasAttachments = false,
    disabled = false,
    onAttach,
    onChange,
    onSubmit,
    ...rootProps
  } = props;
  const recipe = useSlotRecipe({ recipe: activityComposerSlotRecipe });
  const styles = recipe({ variant });
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value ?? internalValue;
  const isInline = variant === "inline";
  const canSubmit = !disabled && (currentValue.trim().length > 0 || hasAttachments);

  const handleChange = (nextValue: string) => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onChange?.(nextValue);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    onSubmit?.(currentValue.trim());

    if (value === undefined) {
      setInternalValue("");
    }
  };

  if (variant === "compact")
    return (
      <chakra.form css={styles.root} onSubmit={handleSubmit} {...rootProps}>
        {attachmentList}
        <Box css={styles.row}>
          {actor ? <ActivityAvatar actor={actor} /> : null}
          <Box css={styles.input} minH={`${minRows}lh`}>
            <ActivityRichInput
              value={currentValue}
              disabled={disabled}
              placeholder={placeholder}
              onChange={handleChange}
            />
          </Box>
          <Box css={styles.actions}>
            {actions}
            {onAttach && (
              <IconButton
                type="button"
                size="xs"
                variant="ghost"
                aria-label={attachLabel}
                onClick={onAttach}
                disabled={disabled}
              >
                <Paperclip />
              </IconButton>
            )}
            <SendButton type="submit" title={submitLabel} canInterrupt={false} disabled={!canSubmit} />
          </Box>
        </Box>
      </chakra.form>
    );

  return (
    <chakra.form
      width="full"
      background="bg"
      borderWidth={isInline ? "0" : "1px"}
      borderColor="border"
      borderRadius={isInline ? "0" : "sm"}
      transition="border-color 0.12s ease"
      _hover={isInline ? undefined : { borderColor: "border" }}
      _focusWithin={isInline ? undefined : { borderColor: "border.accent" }}
      onSubmit={handleSubmit}
      {...rootProps}
    >
      <HStack alignItems="flex-start" gap="xs" padding={isInline ? "sm" : "md"}>
        {actor ? <ActivityAvatar actor={actor} /> : null}
        <Box flex="1" minW="0">
          <Box minH={`${minRows}lh`}>
            <ActivityRichInput
              value={currentValue}
              disabled={disabled}
              placeholder={placeholder}
              onChange={handleChange}
            />
          </Box>
          <HStack gap="2xs" marginTop={isInline ? "0" : "sm"}>
            {actions}
            <Spacer />
            <Tooltip content={attachLabel}>
              <IconButton size="2xs" variant="ghost" aria-label={attachLabel} type="button" onClick={onAttach}>
                <Icon as={Paperclip} boxSize="14px" />
              </IconButton>
            </Tooltip>
            <Tooltip content={submitLabel}>
              <IconButton size="2xs" variant="subtle" aria-label={submitLabel} type="submit" disabled={!canSubmit}>
                <Icon as={ArrowUp} boxSize="14px" />
              </IconButton>
            </Tooltip>
          </HStack>
        </Box>
      </HStack>
    </chakra.form>
  );
};
