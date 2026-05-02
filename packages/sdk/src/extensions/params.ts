import type { ParamDescriptor } from "./types/params";
import type { ResourceRef } from "./types/resources";

const param = <T extends ParamDescriptor>(descriptor: T): T => descriptor;

export const params = {
  text: (options: Omit<ParamDescriptor<string>, "type"> = {}): ParamDescriptor<string> =>
    param({ type: "text", ...options }),

  longText: (options: Omit<ParamDescriptor<string>, "type"> = {}): ParamDescriptor<string> =>
    param({ type: "longtext", ...options }),

  number: (options: Omit<ParamDescriptor<number>, "type"> = {}): ParamDescriptor<number> =>
    param({ type: "number", ...options }),

  boolean: (options: Omit<ParamDescriptor<boolean>, "type"> = {}): ParamDescriptor<boolean> =>
    param({ type: "boolean", ...options }),

  select: (
    options: Omit<ParamDescriptor<string>, "type"> & { options: Array<{ label: string; value: string }> },
  ): ParamDescriptor<string> => param({ type: "select", ...options }),

  multiSelect: (
    options: Omit<ParamDescriptor<string[]>, "type"> & { options: Array<{ label: string; value: string }> },
  ): ParamDescriptor<string[]> => param({ type: "multi-select", ...options }),

  repo: (
    options: Omit<ParamDescriptor<{ repoId: string; branch?: string }>, "type"> = {},
  ): ParamDescriptor<{ repoId: string; branch?: string }> => param({ type: "repo", ...options }),

  harness: (
    options: Omit<ParamDescriptor<{ harnessId: string; model?: string }>, "type"> = {},
  ): ParamDescriptor<{ harnessId: string; model?: string }> => param({ type: "harness", ...options }),

  template: (options: Omit<ParamDescriptor<string>, "type"> & { type: string }): ParamDescriptor<string> =>
    param({ ...options, type: "template", templateType: options.type }),

  resource: (
    options: Omit<ParamDescriptor<ResourceRef>, "type"> & { resourceType: string },
  ): ParamDescriptor<ResourceRef> => param({ type: "resource", ...options }),

  json: <T = unknown>(options: Omit<ParamDescriptor<T>, "type"> = {}): ParamDescriptor<T> =>
    param({ type: "json", ...options }) as ParamDescriptor<T>,
};
