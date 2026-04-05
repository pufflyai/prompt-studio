import Mustache from "mustache";

export const renderPrompt = (template: string, data: Record<string, unknown>) => Mustache.render(template, data);
