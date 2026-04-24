import type {
  BooleanParam,
  HarnessParam,
  LongTextParam,
  ResourceParam,
  SelectParam,
  TemplateParam,
  TextParam,
} from "./types";

export const params = {
  text(input: Omit<TextParam, "type"> = {}) {
    return { ...input, type: "text" as const };
  },

  longText(input: Omit<LongTextParam, "type"> = {}) {
    return { ...input, type: "longtext" as const };
  },

  boolean(input: Omit<BooleanParam, "type"> = {}) {
    return { ...input, type: "boolean" as const };
  },

  select(input: Omit<SelectParam, "type">) {
    return { ...input, type: "select" as const };
  },

  template(input: Omit<TemplateParam, "type"> = {}) {
    return { ...input, type: "template" as const };
  },

  harness(input: Omit<HarnessParam, "type"> = {}) {
    return { ...input, type: "harness" as const };
  },

  resource(input: Omit<ResourceParam, "type"> = {}) {
    return { ...input, type: "resource" as const };
  },
};
