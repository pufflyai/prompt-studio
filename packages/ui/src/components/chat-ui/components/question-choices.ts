/** The "Other" choice shared by the question form and the helpers that read its answers. */
export const OTHER_CHOICE_LABEL = "Other";

/**
 * The value the choice group carries while "Other" is picked. It never leaves the form: the typed
 * text is the answer. Listed choices use positional values, so agent labels cannot collide with it.
 */
export const OTHER_CHOICE_VALUE = "__pstdio_other__";

// Question ids come from agents and may match inherited object properties.
export const getOwnQuestionValue = <T>(values: Record<string, T>, key: string) =>
  Object.hasOwn(values, key) ? values[key] : undefined;

/**
 * A question with options offers its free text as an "Other" choice. A question with no options is
 * free text from the start, so its field is always open and there is nothing to be other than.
 */
export const questionOffersOtherChoice = (question: { options: unknown[]; allowCustomAnswer?: boolean }) =>
  Boolean(question.allowCustomAnswer) && question.options.length > 0;
