import { defineExtension } from "@pstdio/sdk/extensions";
import { labHarnesses } from "./src/harnesses";
export default defineExtension({ harnesses: labHarnesses });
