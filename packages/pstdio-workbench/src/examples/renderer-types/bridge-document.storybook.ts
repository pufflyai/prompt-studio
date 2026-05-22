import runtimeScript from "pstdio-extensions/bridge/runtime.bundle.js?raw";
import { createBridgeDocument } from "./bridge-document";

export const createStorybookBridgeDocument = () => createBridgeDocument({ runtimeScript });
