import { mergeRefs } from "@chakra-ui/react";
import { createContext, type Ref, useContext, useState } from "react";

export const OverlayTriggerContext = createContext<((id: string) => void) | null>(null);

/** asChild and composed controls can replace the generated DOM id. The machine must use that final id too. */
export const useOverlayTriggerId = () => {
  const [triggerId, setTriggerId] = useState<string>();
  return { triggerId, setTriggerId };
};

export const useOverlayTriggerRef = (ref: Ref<HTMLButtonElement>) => {
  const setTriggerId = useContext(OverlayTriggerContext);
  return mergeRefs(ref, (element: HTMLButtonElement | null) => {
    if (element?.id) setTriggerId?.(element.id);
  });
};
