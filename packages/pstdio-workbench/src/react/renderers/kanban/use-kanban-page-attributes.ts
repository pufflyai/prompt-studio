import { useState } from "react";
import type { ReactAttributeDescriptor } from "./kanban-presentation";

interface PageAttributes {
  scope: string;
  declared: ReactAttributeDescriptor[];
  attributes?: ReactAttributeDescriptor[];
}

/**
 * Page requests follow the accepted query's schema, including reads loaded by another placement.
 * Until a read is accepted they keep the attributes declared when the scope started. A read can
 * publish its attributes to the declared source before its page arrives; following that source would
 * change the request and cancel the read, so the board would wait for a second read.
 */
export const useKanbanPageAttributes = (scope: string, declared: ReactAttributeDescriptor[]) => {
  const [accepted, setAccepted] = useState<PageAttributes>({ scope, declared });
  if (accepted.scope !== scope) setAccepted({ scope, declared });
  const attributes = accepted.scope === scope ? (accepted.attributes ?? accepted.declared) : declared;
  return {
    attributes,
    accept: (next: ReactAttributeDescriptor[] | undefined, enabled: boolean) => {
      if (enabled && next && next !== attributes) setAccepted({ scope, declared: accepted.declared, attributes: next });
    },
  };
};
