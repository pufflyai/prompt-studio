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
    if (!active) element.id = inactiveId;
    else if (element.id === inactiveId) element.id = "typeahead-menu";
  }, [anchor, active, inactiveId]);
};
