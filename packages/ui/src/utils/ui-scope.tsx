import { Box, Portal as ChakraPortal, type createToaster, type PortalProps } from "@chakra-ui/react";
import { createContext, type ReactNode, type RefObject, useContext, useRef, useState } from "react";
import { createUiToaster } from "./create-ui-toaster";
import { PortalContainerContext } from "./portal-container";

export interface UiScope {
  root: RefObject<HTMLDivElement | null>;
  active: boolean;
  toaster: ReturnType<typeof createToaster>;
}
const UiScopeContext = createContext<UiScope | null>(null);
const UiScopeViewActivityContext = createContext({ active: true, revision: 0 });
interface PortalOwner {
  container: RefObject<HTMLDivElement | null>;
  modalContainer: PortalProps["container"];
}
const UiScopePortalContext = createContext<PortalOwner | null>(null);

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
  const modalContainer = useContext(PortalContainerContext);
  const parentContainer = useDefaultPortalContainer();
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  // Activity detaches refs while hidden; the retained portal still owns its unfinished content.
  const attachPortal = (node: HTMLDivElement | null) => {
    if (node) setPortal(node);
  };
  // A suspended child can miss the inactive render; retain that dismissal until it resumes.
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
        <UiScopePortalContext value={{ container: { current: portal }, modalContainer }}>
          {children}
        </UiScopePortalContext>
      </UiScopeContext>
      <ChakraPortal container={parentContainer}>
        <Box
          ref={attachPortal}
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
  const modalContainer = useContext(PortalContainerContext);
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
      {scope ? (
        <UiScopePortalContext value={{ container: scope.root, modalContainer }}>{props.children}</UiScopePortalContext>
      ) : (
        props.children
      )}
    </Box>
  );
};

export const useUiScope: () => UiScope | null = () => useContext(UiScopeContext);

// View navigation dismisses overlays; suspending the whole surface preserves its unfinished work.
export const useUiScopeViewActivity = () => useContext(UiScopeViewActivityContext);

const useDefaultPortalContainer = () => {
  const scope = useUiScope();
  const owner = useContext(UiScopePortalContext);
  const modalContainer = useContext(PortalContainerContext);
  // A deeper modal owns its choices; a boundary inside that modal owns their visibility.
  if (modalContainer && modalContainer !== owner?.modalContainer) return modalContainer;
  return owner?.container ?? modalContainer ?? scope?.root;
};

/** Defaults to the closest modal, view or surface owner or the standalone document body. */
export const Portal = (props: PortalProps & { children?: ReactNode }) => {
  const container = useDefaultPortalContainer();
  return <ChakraPortal {...props} container={props.container ?? container} />;
};
