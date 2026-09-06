import type { ReactAttributeDescriptor, ReactBoardColumnConfig } from "./kanban-presentation";

const attribute: ReactAttributeDescriptor = {
  id: "title",
  label: "Title",
  type: { kind: "string" },
  render: () => "Title",
};
const malformedAttribute: ReactAttributeDescriptor = {
  ...attribute,
  // @ts-expect-error Arbitrary objects are not React nodes.
  render: () => ({ unexpected: true }),
};
const malformedColumn: ReactBoardColumnConfig = {
  // @ts-expect-error Icons must be React components with size props.
  actions: [{ id: "create", label: "Create", icon: "plus" }],
};
void [malformedAttribute, malformedColumn];
