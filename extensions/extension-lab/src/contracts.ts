import { qualifyRef } from "@pstdio/sdk/extensions";
import { example as pigeon } from "./examples/pigeon";
import { example as scribble } from "./examples/scribble";
import { readState, updateState } from "./state-commands";

const owner = "pstdio.extension-lab";

// Consumers receive provider-owned refs. The provider still registers local definitions.
export const scribblePage = qualifyRef(owner, scribble.page.ref);
export const pigeonPage = qualifyRef(owner, pigeon.page.ref);
export const pigeonReader = qualifyRef(owner, pigeon.page.panels.reader);
export const readExample = qualifyRef(owner, readState.ref);
export const updateExample = qualifyRef(owner, updateState.ref);
