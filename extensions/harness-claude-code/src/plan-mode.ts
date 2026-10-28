import type { HarnessQuestionChannel } from "@pstdio/sdk/extensions";

export const EXIT_PLAN_MODE = "ExitPlanMode";
const APPROVE = "Approve and implement";

export const planQuestionInput = () => {
  return {
    questions: [
      {
        question: "Approve this plan and start implementation?",
        options: [
          { label: APPROVE, description: "Leave plan mode and carry out the plan." },
          { label: "Request changes", description: "Keep planning. Enter feedback with Other." },
        ],
        multiple: false,
        custom: true,
      },
    ],
  };
};

export const reviewPlan = async (
  questions: HarnessQuestionChannel,
  request: { id: string; toolUseId: string; input: unknown },
) => {
  const response = await questions.ask({
    id: request.id,
    toolUseId: request.toolUseId,
    questions: planQuestionInput().questions,
  });
  const answers = response.answers[0] ?? [];
  if (answers.length === 1 && answers[0] === APPROVE) return { behavior: "allow", updatedInput: request.input };
  return {
    behavior: "deny",
    message:
      answers.length > 0
        ? `The user requested changes to the plan: ${answers.join("\n")}`
        : "The user skipped plan approval. Stay in plan mode and wait for their direction.",
    interrupt: false,
  };
};
