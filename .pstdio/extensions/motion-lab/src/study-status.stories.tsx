import { StudyStatus } from "./study-status";
export default { title: "Motion Lab/Study status", component: StudyStatus };
export const Deleted = { args: { message: "This study was deleted or does not exist." } };
export const InvalidMetadata = {
  args: { message: "duration: Must be greater than zero\nmarkers.0.at: Markers must be sorted and before the end" },
};
export const BuildError = {
  args: { message: 'scene.tsx:3:12: "unavailable-library" is not available to Motion Lab scenes' },
};
