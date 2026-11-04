import { Box } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { createContext, type Dispatch, type RefCallback, type SetStateAction } from "react";

// Keep controllers mounted with their frame while their presentation uses screen-space outlets.
export const FrameEditorOutlet = createContext<HTMLElement | null>(null);
export const FrameEditorVisible = createContext(true);
export const FrameAnimationOutlet = createContext<{
  element: HTMLElement | null;
  open: boolean;
  setActiveFrame: Dispatch<SetStateAction<string | undefined>>;
  reportHeight: (height: number) => void;
  heightLimit?: number;
} | null>(null);
interface FrameEditorMenuProps {
  outlet: RefCallback<HTMLDivElement>;
  open: boolean;
}
export const FrameEditorMenu = (props: FrameEditorMenuProps) => (
  <Box as="aside" aria-label="Frame editor" display={props.open ? "flex" : "none"} h="full" w="full" minH="0" bg="bg">
    <ScrollArea flex="1" minH="0">
      <Box ref={props.outlet} />
    </ScrollArea>
  </Box>
);
