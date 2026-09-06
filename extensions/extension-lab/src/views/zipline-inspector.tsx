import { IssueInspector, ziplineStore } from "../apps/zipline";
import { createExampleView, viewBackgrounds } from "../create-view";
export default createExampleView(IssueInspector, ziplineStore, viewBackgrounds.widget);
