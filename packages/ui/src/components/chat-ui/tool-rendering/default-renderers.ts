import { renderApplyPatch } from "./apply-patch-renderer";
import { renderEdit } from "./edit-renderer";
import { createQuestionRenderer } from "./question-renderer";
import { buildBaseTitle, buildIndicator, prependErrorBlock } from "./shared";
import { renderBash, renderGlob, renderGrep, renderRead, renderShell, renderSkill } from "./standard-renderers";
import { createTodowriteRenderer } from "./todowrite-renderer";
import type { ToolRenderersMap } from "./types";

const renderQuestion = createQuestionRenderer({
  buildBaseTitle,
  buildIndicator,
  prependErrorBlock,
});

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
    question: renderQuestion,
    read: renderRead,
    shell: renderShell,
    skill: renderSkill,
    todo_write: renderTodowrite,
    todowrite: renderTodowrite,
  } satisfies ToolRenderersMap;
};
