import type { JsonValue, StorageIndexField } from "@pstdio/sdk/extensions";
import type { StoredTicketReviewLink } from "./types";

const keys = ["id", "url", "provider", "kind", "createdAt"] as const;
export const reviewLinkProjectionFields = keys.map((key) => `reviewLink:${key}`);
export const reviewLinkProjections = Object.fromEntries(
  keys.map((key) => [
    `reviewLink:${key}`,
    {
      path: ["reviewLinks"],
      type: "array",
      derive: {
        kind: "expression",
        expression: {
          each: { variable: "value" },
          as: "link",
          mode: "map",
          where: { get: { variable: "link" }, key },
        },
      },
    } satisfies StorageIndexField,
  ]),
);

export const readReviewLinkProjections = (fields: Record<string, JsonValue>): StoredTicketReviewLink[] => {
  const ids = fields["reviewLink:id"];
  if (!Array.isArray(ids)) return [];
  return ids.flatMap((_, i) => {
    const values = Object.fromEntries(
      keys.map((key) => [key, (fields[`reviewLink:${key}`] as string[] | undefined)?.[i]]),
    );
    if (!keys.every((key) => typeof values[key] === "string")) return [];
    return [{ ...values, updatedAt: values.createdAt, externalId: null, title: null } as StoredTicketReviewLink];
  });
};
