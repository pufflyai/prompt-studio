import type * as Y from "yjs";

export const resourceNumbersDocumentId = "resource-identities";
export const coreOwnerId = "pstdio";

export interface NumberedResource {
  id: string;
  extensionId: string;
  kind: string;
  prefix: string;
  value: number;
}

export const resourceNumbers = (document: Y.Doc) => document.getMap<NumberedResource>("resource-numbers");
const history = (document: Y.Doc) => document.getMap<true>("resource-number-history");
export const resourceShorthand = (resource: NumberedResource) => `${resource.prefix}-${resource.value}`;
export const rememberResourceNumber = (document: Y.Doc, resource: NumberedResource) => {
  history(document).set(JSON.stringify([resource.id, resourceShorthand(resource)]), true);
};
