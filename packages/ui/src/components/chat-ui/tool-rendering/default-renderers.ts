import { renderApplyPatch } from "./apply-patch-renderer";
import { renderEdit } from "./edit-renderer";
import { buildBaseTitle, buildIndicator, prependErrorBlock } from "./shared";
import { renderBash, renderGlob, renderGrep, renderRead, renderSkill } from "./standard-renderers";
import { createTodowriteRenderer } from "./todowrite-renderer";
import type { ToolRenderersMap } from "./types";

const renderTodowrite = createTodowriteRenderer({
  buildBaseTitle,
  buildIndicator,
  prependErrorBlock,
});

export const createDefaultToolRenderers = () => {
  return {
    apply_patch: renderApplyPatch,
    bash: renderBash,
    edit: renderEdit,
    glob: renderGlob,
    grep: renderGrep,
    read: renderRead,
    skill: renderSkill,
    todo_write: renderTodowrite,
    todowrite: renderTodowrite,
  } satisfies ToolRenderersMap;
};
