import { kilnStore } from "../apps/kiln-state";
import { KilnTimeline } from "../apps/kiln-timeline";
import { createExampleView, viewBackgrounds } from "../create-view";
import type { ExampleViewInput } from "../view-context";

const View = (props: { input: ExampleViewInput }) => <KilnTimeline host={props.input.host} />;
export default createExampleView(View, kilnStore, viewBackgrounds.panel);
