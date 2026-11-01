# Keep status changes and their side effects together

## 1. When to use

- Adding a session status change, recovery path, queue operation, or lifecycle hook.

## 2. Failure

- Some paths updated status and sent sync events but omitted hooks. Automation behaved differently after an endpoint call, process exit, or startup recovery.

## 3. Prevention

- Use the session service's transition, resume, and queue methods.
- Keep database changes, sync events, hooks, and required queue entries with their owner.
- Do not repeat part of a transition in a caller.
- Cover secondary paths such as spawn failure and recovery, including guarded transitions that update no row.

## 4. Evidence

- [Session service](../../packages/pstdio-api/src/services/session-service.ts)
- [Session status lifecycle](../references/architecture/0019-session-status-lifecycle.md)
