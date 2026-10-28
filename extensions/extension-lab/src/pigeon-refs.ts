import { qualifyRef } from "@pstdio/sdk/extensions";

export const pigeonReader = qualifyRef("pstdio.extension-lab", {
  kind: "page-slot",
  page: { kind: "page", id: "pigeon" },
  id: "reader",
});
