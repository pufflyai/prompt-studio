export const EXTENSION_EVENTS_SCOPE = "extension.events";
/** Host event sent with `{ type: "changed" }` after a listed resource's actions may have changed. */
export const RESOURCE_ACTIONS_EVENTS_SCOPE = "resources.actions";

export const artifactMountId = (mount: string | { id: string }) => (typeof mount === "string" ? mount : mount.id);
