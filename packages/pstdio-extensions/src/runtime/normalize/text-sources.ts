import { contributionRefId } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { resolveDeclaredParams } from "../runner/validate-params";
import type { Accumulator, RegistryIndex } from "./accumulator";
import { registerPrivateHandler } from "./private-handlers";

export const registerTextSources = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const provider of source.definition.textSources ?? []) {
    const id = contributionRefId({ extensionId: ext.id, ...provider.ref });
    for (const operation of ["resolve", "project"] as const) {
      registerPrivateHandler({
        ext,
        source,
        runtime,
        index,
        rendererId: id,
        rendererLocalId: provider.id,
        rendererKind: "textSource",
        operation,
        handler: async (
          ctx: Parameters<typeof provider.resolve>[0],
          input: {
            params: Record<string, unknown>;
            resource?: Parameters<typeof provider.resolve>[1]["resource"];
            content: string;
          },
        ) => {
          const params = resolveDeclaredParams(provider.params, input.params);
          return provider[operation](ctx, { ...input, params });
        },
      });
    }
  }
};
