import { ReadingPane } from "../apps/pigeon";
import { pigeonStore } from "../apps/pigeon-state";
import { createExampleView, viewBackgrounds } from "../create-view";
export default createExampleView(ReadingPane, pigeonStore, viewBackgrounds.widget);
