import { localProviderSuite } from "./workspace-provider-local.fixture";

// The same provider behaviour with its backend in a worker process (pstdio.backendRuntime "process").
localProviderSuite({ backendRuntime: "process" });
