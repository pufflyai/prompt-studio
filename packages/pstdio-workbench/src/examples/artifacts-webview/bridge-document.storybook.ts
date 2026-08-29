import runtimeScript from "pstdio-extensions/bridge/webview-runtime.bundle.js?raw";
import { createArtifactsBridgeDocument } from "./bridge-document";

export const createStorybookArtifactsBridgeDocument = () => createArtifactsBridgeDocument({ runtimeScript });
