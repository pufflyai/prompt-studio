import Mustache from "mustache";

export const replacePlaceholders = (content: string, values: Record<string, string>) =>
  Mustache.render(content, values);
