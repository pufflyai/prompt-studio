import { nativeFileContentSchema } from "pstdio-api-contracts";
import { textFailure } from "./errors";
import type { TextConnection, TextEditingDeps, TextGrant } from "./types";

export const validateTextPresentation = async (deps: TextEditingDeps, connection: TextConnection) => {
  if (connection.disposed) throw textFailure("session_closed", "This text placement is closed");
  if (connection.input.kind !== "placement" || !connection.input.viewId) return;
  const catalog = await deps.catalog.get(connection.projectId);
  const viewId = connection.input.viewId;
  const view = catalog.runtime.views.find((view) => view.id === viewId);
  if (
    catalog.stale ||
    !view ||
    view.contribution.body.kind !== "webview" ||
    !view.contribution.body.capabilities?.some((cap) => cap === "editing.text" || cap === "editing.text@1")
  )
    throw textFailure("capability_denied", "This presentation cannot use text editing");
  connection.extensionId = view.extensionId;
};
const selectedPresentation = (loaded: Pick<Awaited<ReturnType<TextEditingDeps["load"]>>, "content" | "owner">) => {
  const content = nativeFileContentSchema.parse(loaded.content);
  if (content.textEditor && !content.textDocument)
    throw textFailure("grant_invalid", "A custom text editor needs a declared text source");
  return content.textEditor
    ? `${content.textEditor.extensionId ?? loaded.owner.extensionId}.view.${content.textEditor.id}`
    : undefined;
};
export const grantTextSource = async (
  deps: TextEditingDeps,
  connection: TextConnection,
  target: TextGrant["target"],
) => {
  const loaded = await deps.load({ ...target, projectId: connection.projectId });
  if (
    "fileRendererId" in target &&
    connection.input.kind === "placement" &&
    selectedPresentation(loaded) !== connection.input.viewId
  )
    throw textFailure("capability_denied", "The source owner selected a different text presentation");
  const grant: TextGrant = {
    token: crypto.randomUUID(),
    target,
    documentKey: loaded.documentKey,
    ownerId: loaded.owner.extensionId,
    editable: loaded.content.editable !== false,
  };
  connection.grants.set(grant.token, grant);
  return grant;
};
export const validateTextGrant = async (
  deps: TextEditingDeps,
  connection: TextConnection,
  grant: TextGrant,
  writable = false,
) => {
  await validateTextPresentation(deps, connection);
  if (connection.grants.get(grant.token) !== grant)
    throw textFailure("grant_invalid", "This source grant belongs to another placement");
  const loaded = await deps.access({ ...grant.target, projectId: connection.projectId });
  if (loaded.documentKey !== grant.documentKey || loaded.owner.extensionId !== grant.ownerId)
    throw textFailure("source_retired", "This source lifetime has been retired");
  if (
    "fileRendererId" in grant.target &&
    connection.input.kind === "placement" &&
    selectedPresentation(loaded) !== connection.input.viewId
  )
    throw textFailure("capability_denied", "The source owner changed its text presentation");
  if (writable && (!grant.editable || loaded.content.editable === false))
    throw textFailure("source_read_only", "The text source is read only");
  return loaded;
};
