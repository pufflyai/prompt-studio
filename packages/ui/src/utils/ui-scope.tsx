import { Box, Portal as ChakraPortal, type createToaster, type PortalProps } from "@chakra-ui/react";
import { createContext, type ReactNode, type RefObject, useContext, useRef, useState } from "react";
import { createUiToaster } from "./create-ui-toaster";

export interface UiScope {
  root: RefObject<HTMLDivElement | null>;
  active: boolean;
  toaster: ReturnType<typeof createToaster>;
}
const UiScopeContext = createContext<UiScope | null>(null);
const UiScopeViewActivityContext = createContext({ active: true, revision: 0 });
const UiScopePortalContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

/** Keeps window overlays and imperative component feedback inside their owning surface. */
export const UiScopeProvider = (props: { active: boolean; children: ReactNode }) => {
  const { active, children } = props;
  const parent = useContext(UiScopeContext);
  const root = useRef<HTMLDivElement>(null);
  const [toaster] = useState(createUiToaster);
  return (
    <UiScopeContext value={{ root, active: active && (parent?.active ?? true), toaster }}>
      <UiScopePortalContext value={null}>{children}</UiScopePortalContext>
    </UiScopeContext>
  );
};

/** Retained views own overlay visibility independently of their suspended React content. */
export const UiScopeActivity = (props: { active: boolean; children: ReactNode }) => {
  const { active, children } = props;
  const scope = useUiScope();
  const parent = useContext(UiScopeViewActivityContext);
  const parentPortal = useContext(UiScopePortalContext);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const [activity, setActivity] = useState({ active, revision: 0 });
  if (activity.active !== active) {
    setActivity({ active, revision: activity.revision + Number(!active) });
  }
  const enabled = active && parent.active && (scope?.active ?? true);
  return (
    <UiScopeViewActivityContext
      value={{ active: parent.active && active, revision: parent.revision + activity.revision }}
    >
      <UiScopeContext value={scope ? { ...scope, active: enabled } : null}>
        <UiScopePortalContext value={{ current: portal }}>{children}</UiScopePortalContext>
      </UiScopeContext>
      <ChakraPortal container={parentPortal ?? scope?.root}>
        <Box
          ref={setPortal}
          data-ui-view-overlays=""
          display={enabled ? "contents" : "none"}
          hidden={!enabled}
          inert={!enabled}
        />
      </ChakraPortal>
    </UiScopeViewActivityContext>
  );
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

// View navigation dismisses overlays; suspending the whole surface preserves its unfinished work.
export const useUiScopeViewActivity = () => useContext(UiScopeViewActivityContext);

/** Defaults to the owning surface, or the document body for standalone components. */
export const Portal = (props: PortalProps & { children?: ReactNode }) => {
  const scope = useUiScope();
  const viewPortal = useContext(UiScopePortalContext);
  return <ChakraPortal {...props} container={props.container ?? viewPortal ?? scope?.root} />;
};
