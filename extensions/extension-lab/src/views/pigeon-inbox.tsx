import { Inbox } from "../apps/pigeon";
import { pigeonStore } from "../apps/pigeon-state";
import { createExampleView } from "../create-view";
export default createExampleView(Inbox, pigeonStore);
