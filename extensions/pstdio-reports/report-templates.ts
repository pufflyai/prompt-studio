import { defineTemplate, packageAsset } from "@pstdio/sdk/extensions";

export const reportTemplateAssets = [
  {
    id: "review",
    title: "Review",
    type: "report",
    path: "templates/review.md",
  },
  {
    id: "change-request",
    title: "Change request",
    type: "report",
    path: "templates/change-request.md",
  },
];

export const reportTemplates = reportTemplateAssets.map((template) =>
  defineTemplate({
    id: template.id,
    title: template.title,
    type: template.type,
    source: packageAsset(`./${template.path}`, import.meta.url),
  }),
);

export const reportTemplateNames = reportTemplateAssets.map((template) => template.id).sort();
