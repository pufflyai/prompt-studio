import type { NormalizedExtension } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator, RegistryIndex } from "./accumulator";
import { registerFileIconThemes } from "./file-icon-themes";
import { registerThemes } from "./themes";

export const registerAppearance = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  registerThemes(ext, source, runtime, index);
  registerFileIconThemes(ext, source, runtime, index);
};
