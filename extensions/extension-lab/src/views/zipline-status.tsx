import { IssueCount, ziplineStore } from "../apps/zipline";
import { createExampleView, viewBackgrounds } from "../create-view";
export default createExampleView(IssueCount, ziplineStore, viewBackgrounds.status);
