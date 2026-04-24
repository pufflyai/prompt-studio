import { renderApplyPatch } from "./apply-patch-renderer";
import { renderEdit } from "./edit-renderer";
import { renderBash, renderGlob, renderGrep, renderRead, renderSkill } from "./standard-renderers";
import { renderTodoWrite } from "./todo-write-renderer";
import type { ToolRenderersMap } from "./types";

export const createDefaultToolRenderers = () => {
  return {
    apply_patch: renderApplyPatch,
    bash: renderBash,
    edit: renderEdit,
    glob: renderGlob,
    grep: renderGrep,
    read: renderRead,
    skill: renderSkill,
    todowrite: renderTodoWrite,
  } satisfies ToolRenderersMap;
};
