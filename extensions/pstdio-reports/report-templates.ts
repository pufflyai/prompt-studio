import { packageAsset } from "@pstdio/sdk/extensions";

export const reportTemplates = {
  review: {
    title: "Review",
    type: "report",
    source: packageAsset("./templates/review.md", import.meta.url),
  },
  change_request: {
    title: "Change request",
    type: "report",
    source: packageAsset("./templates/change_request.md", import.meta.url),
  },
};

export const reportTemplateNames = Object.keys(reportTemplates)
  .map((name) => name.replaceAll("_", "-"))
  .sort();
