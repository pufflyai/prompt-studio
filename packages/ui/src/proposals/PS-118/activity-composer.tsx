import type { HTMLChakraProps } from "@chakra-ui/react";
import { Box, chakra, HStack, Icon, IconButton, Input, Spacer, Textarea } from "@chakra-ui/react";
import { ArrowUp, Paperclip } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import type { ActivityActor } from "@/components/activity/activity.types";
import { ActivityAvatar } from "@/components/activity/activity-avatar";
import { Tooltip } from "@/components/primitives/tooltip";

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
    onAttach,
    onChange,
    onSubmit,
    ...rootProps
  } = props;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value ?? internalValue;
  const isInline = variant === "inline";
  const canSubmit = currentValue.trim().length > 0;

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

  const controls = (
    <HStack gap="2xs" flexShrink="0">
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
  );

  if (variant === "compact") {
    return (
      <chakra.form
        width="full"
        background="bg"
        borderWidth="1px"
        borderColor="border"
        borderRadius="sm"
        onSubmit={handleSubmit}
        {...rootProps}
      >
        <HStack gap="xs" padding="sm" alignItems="center">
          {actor ? <ActivityAvatar actor={actor} /> : null}
          <Input
            value={currentValue}
            aria-label={placeholder}
            placeholder={placeholder}
            flex="1"
            minW="0"
            border="0"
            padding="0"
            background="transparent"
            textStyle="label/S/regular"
            onChange={(event) => handleChange(event.currentTarget.value)}
          />
          {controls}
        </HStack>
      </chakra.form>
    );
  }

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
          <Textarea
            value={currentValue}
            rows={minRows}
            resize="none"
            border="0"
            padding="0"
            minH={isInline ? "1.5rem" : "4rem"}
            background="transparent"
            color="fg"
            textStyle="label/S/regular"
            placeholder={placeholder}
            _placeholder={{ color: "fg.subtle" }}
            onChange={(event) => handleChange(event.currentTarget.value)}
          />
          <Box marginTop={isInline ? "0" : "sm"}>{controls}</Box>
        </Box>
      </HStack>
    </chakra.form>
  );
};
