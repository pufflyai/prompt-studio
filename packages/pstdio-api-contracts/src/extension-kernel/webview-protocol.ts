export const EXTENSION_EVENTS_SCOPE = "extension.events";

export const artifactMountId = (mount: string | { id: string }) => (typeof mount === "string" ? mount : mount.id);
