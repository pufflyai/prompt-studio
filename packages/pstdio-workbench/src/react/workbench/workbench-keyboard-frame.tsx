import { Flex } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";

interface WorkbenchKeyboardFrameProps {
  children: ReactNode;
}

const interactivePointerTargetSelector = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[role='button']",
  "[role='checkbox']",
  "[role='menuitem']",
  "[role='option']",
  "[role='radio']",
  "[role='switch']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const hasClosest = (target: EventTarget | null): target is EventTarget & { closest(selector: string): unknown } =>
  typeof (target as { closest?: unknown } | null)?.closest === "function";

export const shouldFocusWorkbenchKeyboardFrame = (target: EventTarget | null, currentTarget: EventTarget) => {
  if (target === currentTarget) return true;
  if (!hasClosest(target)) return false;
  return !target.closest(interactivePointerTargetSelector);
};

const focusWorkbenchKeyboardFrame = (element: HTMLDivElement | null) => {
  element?.focus({ preventScroll: true });
};

export const WorkbenchKeyboardFrame = (props: WorkbenchKeyboardFrameProps) => {
  const { children } = props;
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    focusWorkbenchKeyboardFrame(ref.current);
  }, []);

  return (
    <Flex
      ref={ref}
      h="full"
      minH="0"
      minW="0"
      w="full"
      tabIndex={-1}
      outline="none"
      onPointerDown={(event) => {
        if (shouldFocusWorkbenchKeyboardFrame(event.target, event.currentTarget)) {
          focusWorkbenchKeyboardFrame(event.currentTarget);
        }
      }}
    >
      {children}
    </Flex>
  );
};
