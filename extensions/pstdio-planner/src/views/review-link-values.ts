export interface ReviewLinkValue {
  id?: string;
  url: string;
  provider?: string | null;
  kind?: string | null;
  externalId?: string | null;
  title?: string | null;
}

const clean = (value: string | null | undefined) => value?.trim() ?? "";

const cleanTitle = (link: ReviewLinkValue) => {
  const title = clean(link.title);
  return title === link.url ? "" : title;
};

const labelPart = (value: string | null | undefined) => clean(value).replace(/_/g, " ");

export const reviewLinkLabel = (link: ReviewLinkValue) => clean(link.externalId) || cleanTitle(link) || "Review link";

export const reviewLinkTooltip = (link: ReviewLinkValue) => {
  const provider = labelPart(link.provider);
  const kind = labelPart(link.kind);
  const externalId = clean(link.externalId);
  const title = cleanTitle(link);
  const parts = [provider, kind, externalId ? `#${externalId}` : "", title].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Review link";
};
