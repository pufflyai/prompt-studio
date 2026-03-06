import { generateEditorStateFromString } from "../../rich-text";

export const createSerializedPromptState = (input = "") => {
  return JSON.stringify(generateEditorStateFromString(input));
};
