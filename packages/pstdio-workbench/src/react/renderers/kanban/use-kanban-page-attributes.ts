import { useState } from "react";
import type { ReactAttributeDescriptor } from "./kanban-presentation";

/** Page requests follow the accepted query's schema, including reads loaded by another placement. */
export const useKanbanPageAttributes = (scope: string, declared: ReactAttributeDescriptor[]) => {
  const [accepted, setAccepted] = useState<{ scope: string; attributes?: ReactAttributeDescriptor[] }>({ scope });
  if (accepted.scope !== scope) setAccepted({ scope });
  const attributes = accepted.scope === scope ? (accepted.attributes ?? declared) : declared;
  return {
    attributes,
    accept: (next: ReactAttributeDescriptor[] | undefined, enabled: boolean) => {
      if (enabled && next && next !== attributes) setAccepted({ scope, attributes: next });
    },
  };
};
