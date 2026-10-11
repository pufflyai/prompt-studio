import type { WorkbenchCore } from "../../core";
import { createShowcaseStore } from "./showcase-store";

const createBoomboxStore = () =>
  createShowcaseStore({ playing: true, likedIds: ["paper-moon"], queueIds: ["afterimage", "still-life"] });
const stores = new WeakMap<WorkbenchCore, ReturnType<typeof createBoomboxStore>>();

export const getBoomboxStore = (workbench: WorkbenchCore) => {
  let store = stores.get(workbench);
  if (!store) {
    store = createBoomboxStore();
    stores.set(workbench, store);
  }
  return store;
};
