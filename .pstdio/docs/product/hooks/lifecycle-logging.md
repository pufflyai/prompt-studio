# Lifecycle Logging

Lifecycle automation now runs through extensions. Logging should happen at the extension event or command middleware boundary:

- command middleware should log rejected transitions with the command id and resource id
- event handlers should log async failures without failing the originating request
- extension command execution should log command id, extension id, status, and duration
