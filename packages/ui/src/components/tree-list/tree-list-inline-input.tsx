import { Box, Flex, Input } from "@chakra-ui/react";
import { type ReactNode, useRef, useState } from "react";
import type { TreeListInlineInput } from "./tree-list.types";

interface TreeListInlineInputRowProps {
  input: TreeListInlineInput;
  icon?: ReactNode;
  level: number;
}

const paddingLeft = (level: number) => {
  if (level <= 0) return "sm";
  return `calc(var(--chakra-spacing-1) + ${level} * 12px)`;
};

export const TreeListInlineInputRow = (props: TreeListInlineInputRowProps) => {
  const { input, icon, level } = props;
  const [value, setValue] = useState(input.defaultValue ?? "");
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const commit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(undefined);
    try {
      await input.onCommit(value.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create file.");
      queueMicrotask(() => inputRef.current?.focus());
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <Flex
      h="1.75rem"
      w="full"
      minW="0"
      alignItems="center"
      gap="1"
      pr="sm"
      pl={paddingLeft(level)}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {icon ? (
        <Box
          boxSize="16px"
          color="fg.muted"
          flexShrink={0}
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          css={{ "& > svg": { width: "16px", height: "16px" } }}
        >
          {icon}
        </Box>
      ) : null}
      <Input
        ref={inputRef}
        autoFocus
        size="xs"
        value={value}
        aria-label={input.ariaLabel}
        aria-invalid={Boolean(error) || undefined}
        placeholder={input.placeholder}
        title={error}
        onChange={(event) => setValue(event.currentTarget.value)}
        onBlur={() => {
          if (!submittingRef.current) input.onCancel?.();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape" && !submittingRef.current) {
            event.preventDefault();
            input.onCancel?.();
          }
        }}
      />
    </Flex>
  );
};
