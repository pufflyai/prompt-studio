import { createOwnerLayoutScopeHandler } from "../page-runtime/owner-layout-scope-handler";
import type { MainFullscreenController } from "./fullscreen-controller";

export const createFullscreenScopeHandler = (
  fullscreen: MainFullscreenController,
  input: Parameters<typeof createOwnerLayoutScopeHandler>[0],
) => {
  const apply = createOwnerLayoutScopeHandler(input);
  return (state: Parameters<typeof apply>[0]) => {
    fullscreen.beforeTransition(state);
    return apply(state);
  };
};
