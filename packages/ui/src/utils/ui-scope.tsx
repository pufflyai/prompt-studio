import { Box, Portal as ChakraPortal, type createToaster, type PortalProps } from "@chakra-ui/react";
import { createContext, type ReactNode, type RefObject, useContext, useRef, useState } from "react";
import { createUiToaster } from "./create-ui-toaster";

export interface UiScope {
  root: RefObject<HTMLDivElement | null>;
  active: boolean;
  toaster: ReturnType<typeof createToaster>;
}
const UiScopeContext = createContext<UiScope | null>(null);

/** Keeps window overlays and imperative component feedback inside their owning surface. */
export const UiScopeProvider = (props: { active: boolean; children: ReactNode }) => {
  const { active, children } = props;
  const root = useRef<HTMLDivElement>(null);
  const [toaster] = useState(createUiToaster);
  return <UiScopeContext value={{ root, active, toaster }}>{children}</UiScopeContext>;
};

/** Render inside the host's Chakra provider; the scope itself creates no provider or DOM. */
export const UiScopeRoot = (props: { children: ReactNode }) => {
  const scope = useUiScope();
  return (
    <Box
      ref={scope?.root}
      data-ui-scope=""
      hidden={scope ? !scope.active : false}
      inert={scope ? !scope.active : false}
      h="full"
      minH="0"
      minW="0"
      w="full"
      position="relative"
    >
      {props.children}
    </Box>
  );
};

export const useUiScope: () => UiScope | null = () => useContext(UiScopeContext);

/** Defaults to the owning surface, or the document body for standalone components. */
export const Portal = (props: PortalProps & { children?: ReactNode }) => {
  const scope = useUiScope();
  return <ChakraPortal {...props} container={props.container ?? scope?.root} />;
};
