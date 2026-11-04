# Remote devices — PS-827

Canvas: `remote-devices.canvas.tsx`, titled `Proposals/PS-827 Remote devices`.

- `OnlineConversation`: the normal composer and an online workspace link.
- `QueuedOnLaptop`: sending a message adds it to the device's queue; interrupt ends the current turn.
- `OfflineLaptop`: readable conversation and queue, an offline notice, and no workspace link.
- `NewSessionDevicePicker`: select an online device before starting a session.

Frames use local synthetic state and never call an API. The workspace action only describes its destination; it does not create a workspace or open a real file viewer. The selector lists online devices only. Existing sessions keep their device fixed.

The unchanged chat, device and workspace controls are imported from production. Only the offline notice is copied here. After this proposal merges, apply that notice's change to `src/modules/sessions/components/session-personal-device.tsx`, wire the production controls to online presence and remote commands, and delete this folder.
