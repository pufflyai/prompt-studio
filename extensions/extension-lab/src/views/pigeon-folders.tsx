import { Folders } from "../apps/pigeon-navigation";
import { pigeonStore } from "../apps/pigeon-state";
import { createExampleView, viewBackgrounds } from "../create-view";
import type { ExampleViewInput } from "../view-context";

const View = (props: { input: ExampleViewInput }) => <Folders host={props.input.host} />;
export default createExampleView(View, pigeonStore, viewBackgrounds.sidenav);
