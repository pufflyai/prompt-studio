import { defineResourceKind } from "@pstdio/sdk/extensions";

export const threadResource = defineResourceKind({
  id: "thread",
  label: "Thread",
  menuSlots: [{ id: "header-actions", placement: "header-primary", access: "owner" }],
});
