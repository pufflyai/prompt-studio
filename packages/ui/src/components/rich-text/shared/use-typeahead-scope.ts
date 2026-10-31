import { type RefObject, useId, useLayoutEffect } from "react";
import { useUiScope } from "@/utils/ui-scope";

/** Lexical supplies the body anchor; keep that anchor under the editor's visibility ownership. */
export const useTypeaheadScope = (anchor: RefObject<HTMLElement | null>) => {
  const active = useUiScope()?.active ?? true;
  const inactiveId = useId();
  useLayoutEffect(() => {
    const element = anchor.current;
    if (!element) return;
    element.hidden = !active;
    element.inert = !active;
    if (active) {
      if (element.id === inactiveId) element.id = "typeahead-menu";
      return;
    }
    const repairId = () => {
      if (element.id !== inactiveId) element.id = inactiveId;
    };
    repairId();
    // Lexical rewrites its fixed ID on reposition. See ADR 0117 for removal.
    const observer = new MutationObserver(repairId);
    observer.observe(element, { attributes: true, attributeFilter: ["id"] });
    return () => observer.disconnect();
  }, [anchor, active, inactiveId]);
  return active;
};
