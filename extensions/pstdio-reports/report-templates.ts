import { defineTemplate, packageAsset } from "@pstdio/sdk/extensions";

export const reportTemplates = [
  defineTemplate({
    id: "review",
    title: "Review",
    type: "report",
    source: packageAsset("./templates/review.md", import.meta.url),
  }),
  defineTemplate({
    id: "change_request",
    title: "Change request",
    type: "report",
    source: packageAsset("./templates/change_request.md", import.meta.url),
  }),
];

export const reportTemplateNames = reportTemplates.map((template) => template.id.replaceAll("_", "-")).sort();
