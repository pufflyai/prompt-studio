import type { HTMLChakraProps } from "@chakra-ui/react";
import { Box, chakra, HStack, Icon, IconButton, Spacer, Textarea } from "@chakra-ui/react";
import { ArrowUp, Paperclip } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";

import { Tooltip } from "../tooltip";
import type { ActivityActor } from "./activity.types";
import { ActivityAvatar } from "./activity-avatar";

export interface ActivityComposerProps extends Omit<HTMLChakraProps<"form">, "onChange" | "onSubmit"> {
  actor?: ActivityActor;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  variant?: "standalone" | "inline";
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

  return (
    <chakra.form
      width="full"
      background="bg"
      borderWidth={isInline ? "0" : "1px"}
      borderColor="border.muted"
      borderRadius={isInline ? "0" : "sm"}
      transition="border-color 0.12s ease, box-shadow 0.12s ease"
      _focusWithin={isInline ? undefined : { borderColor: "blue.border", boxShadow: "mid" }}
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
            _focus={{ borderColor: "transparent", boxShadow: "none", outline: "none" }}
            _focusVisible={{ borderColor: "transparent", boxShadow: "none", outline: "none" }}
            onChange={(event) => handleChange(event.currentTarget.value)}
          />
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
