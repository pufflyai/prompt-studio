import { kilnStore } from "../apps/kiln-state";
import { KilnViewport } from "../apps/kiln-viewport";
import { createExampleView } from "../create-view";
export default createExampleView(KilnViewport, kilnStore);
