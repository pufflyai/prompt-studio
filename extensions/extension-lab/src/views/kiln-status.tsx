import { KilnStatus } from "../apps/kiln-chrome";
import { kilnStore } from "../apps/kiln-state";
import { createExampleView, viewBackgrounds } from "../create-view";
import type { ExampleViewInput } from "../view-context";

const View = (props: { input: ExampleViewInput }) => <KilnStatus host={props.input.host} />;
export default createExampleView(View, kilnStore, viewBackgrounds.status);
