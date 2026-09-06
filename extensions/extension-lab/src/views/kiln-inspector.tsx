import { KilnInspector } from "../apps/kiln-inspector";
import { kilnStore } from "../apps/kiln-state";
import { createExampleView, viewBackgrounds } from "../create-view";
export default createExampleView(KilnInspector, kilnStore, viewBackgrounds.widget);
