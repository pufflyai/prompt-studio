import type { AttemptRecord } from "./attempt-types";

export const requireGitBase = (attempt: AttemptRecord) => {
  if (!attempt.base) throw new Error("This attempt works directly in the project folder and has no Git base.");
  return attempt.base;
};
