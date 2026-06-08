# Service Layer

The API uses a three-tier service architecture. Each tier has a clear responsibility and a naming convention that makes the layer obvious at a glance.

## Tiers

```
Routes (HTTP handlers)
  |
  v
Domain Services          pstdio-api/src/services/
  |         |
  v         v
DB Services    Storage Services
(pstdio-db)    (pstdio-storage)
```

### DB Services (`*DBService`)

Pure data-access functions. Each takes a `DbClient` and returns an object of query methods. No business logic, no events, no hooks.

- Package: `pstdio-db`
- Naming: `create<Entity>DBService(db)` (e.g., `createSessionsDBService`, `createProjectsDBService`)
- Examples: `get`, `list`, `create`, `update`, `softDelete`

### Storage Services (`*StorageService`)

Pure filesystem operations — no database, no DB services.

- Package: `pstdio-storage`
- Naming: `create<Entity>StorageService(...)` (e.g., `createFilesStorageService`, `createDocsStorageService`)
- Take filesystem paths or options as constructor args, never `db` or DB services
- When a storage service needs data from the database (e.g., repo paths), the domain service resolves it and passes the result

### Domain Services (no suffix)

Orchestration layer. Each wraps one or more DB/storage services and adds:

- EventBus emission on mutations
- Lifecycle hooks (pre/post)
- Cross-entity coordination

- Package: `pstdio-api/src/services/`
- Naming: `create<Entity>Service(deps)` (e.g., `createSessionService`, `createProjectService`)
- Deps: receives DB services, storage services, eventBus, and other domain services as needed

## Dependency Rules

1. **Routes receive only domain services** via `RouteDeps`. Routes never import from `pstdio-db` or `pstdio-storage` directly.
2. **Domain services compose from DB/storage services + infrastructure.** They are constructed in `app.ts` and injected into `RouteDeps`.
3. **DB and storage services are stateless.** They don't know about events, hooks, or other services.
4. **Routes never access `db` directly.** All queries go through a domain service.

## RouteDeps

The `RouteDeps` interface is the contract between `app.ts` and all route handlers:

## Wiring (`app.ts`)

Services are constructed in a strict order:

```ts
// 1. DB services
const sessionsDBService = createSessionsDBService(db);

// 2. Storage services
const filesDBService = createFilesDBService(db);
const filesStorageService = createFilesStorageService(storageRoot);

// 3. Infrastructure
const eventBus = new EventBus();

// 4. Domain services (compose from above)
const fileService = createFileService({ filesDBService, filesStorageService });
const sessionService = createSessionService({ sessionsDb: sessionsDBService, eventBus, ... });

// 5. Only domain services go to routes
const deps = { sessionService, projectService, ... };
```

## Adding a New Entity

1. **DB service** in `pstdio-db/src/services/<entity>/` -- `create<Entity>DBService(db)` with CRUD methods. Export from `pstdio-db/src/index.ts`.
2. **Domain service** in `pstdio-api/src/services/<entity>-service.ts` -- `create<Entity>Service(deps)` wrapping the DB service. Add event emission for mutations.
3. **RouteDeps** -- add the domain service type to `features/deps.ts`.
4. **app.ts** -- construct DB service, then domain service, add to `deps`.
5. **Route handlers** -- use `deps.<entity>Service.*` methods.

## EventBus

Domain services own event emission. When a mutation succeeds, the domain service calls `deps.eventBus.emit(table, op, data)`. Routes should not emit events directly -- if you find yourself calling `eventBus.emit` in a route handler, the logic belongs in a domain service.

## Activity Events DB Service

`createActivityEventsDBService(db)` is the durable activity log storage for ticket/workspace/session timelines.

- Table: `activity_events`
- Ordering: deterministic reverse chronology `created_at DESC, id DESC`
- Pagination: cursor-based, where cursor encodes `{ createdAt, id }`
- Supported filters: `resource_type`, `event_type`, and `created_at` range (`fromCreatedAt`, `toCreatedAt`)
- Payload policy: `payload_json` stores concise structured deltas (status/tag/etc), not full markdown bodies

Planner tickets are extension-owned. Core services may log activity that refers
to planner resources, but there is no core `ticketService` or ticket DB service.
