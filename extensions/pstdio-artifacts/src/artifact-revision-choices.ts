import type { ExtensionViewRenderContext, WebviewResourceActionChoice } from "@pstdio/sdk/extensions";
import type { ArtifactRevision } from "./artifacts";

const pageSize = 100;
export const revisionChoicePrefix = "revision:";
export const newerVersionsChoice = "page:newer";
export const olderVersionsChoice = "page:older";

/** Keep large histories within the public action channel's finite message limit. */
export const artifactRevisionChoices = (
  revisions: Pick<ArtifactRevision, "id" | "label">[],
  selected: string | undefined,
  requestedPage: number,
  t: ExtensionViewRenderContext["t"],
) => {
  const lastPage = Math.max(0, Math.ceil(revisions.length / pageSize) - 1);
  const page = Math.max(0, Math.min(requestedPage, lastPage));
  const start = page * pageSize;
  const end = start + pageSize;
  const selectedIndex = revisions.findIndex((revision) => revision.id === selected);
  const indices = Array.from({ length: Math.min(pageSize, revisions.length - start) }, (_, index) => start + index);
  if (selectedIndex >= 0 && (selectedIndex < start || selectedIndex >= end)) indices.unshift(selectedIndex);
  const choices: WebviewResourceActionChoice[] = indices.map((index) => {
    const revision = revisions[index];
    const suffix = index === 0 ? t("reader.latest", " · Latest") : "";
    const label =
      revision.label?.trim() || t("reader.version", "Version {{number}}", { number: revisions.length - index });
    const available = 1000 - suffix.length;
    const caption = label.length > available ? `${label.slice(0, available - 1)}…` : label;
    return { id: revisionChoicePrefix + revision.id, label: caption + suffix, selected: revision.id === selected };
  });
  if (lastPage > 0)
    choices.push(
      {
        id: newerVersionsChoice,
        label: t("reader.newerVersions", "Newer versions…"),
        kind: "action",
        closeOnSelect: false,
        disabled: page === 0,
      },
      {
        id: olderVersionsChoice,
        label: t("reader.olderVersions", "Older versions…"),
        kind: "action",
        closeOnSelect: false,
        disabled: page === lastPage,
      },
    );
  return { choices, page, lastPage };
};
