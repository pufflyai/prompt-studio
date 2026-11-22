# Temporary ordering of generated migration dependencies

Proposed: 2026-11-21

Status: Accepted for the PS-1200 candidate. Full phase qualification remains pending.

## Intended design

Generate schema migrations with the package's `db:generate` command and run them with Drizzle's public migrator. Preserve released data through the durable conversion path. Do not edit generated SQL by hand. This supports storage ownership under RB 1.A.3 and follows guidance 0007-contributing.6.1, 0007-contributing.6.3 and 0007-contributing.6.4.

## External limitation

The installed Drizzle Kit 0.31 generator emits `DROP TABLE automation_principals CASCADE` before explicit drops of the foreign keys from `automation_runs` and `automation_tokens`. PostgreSQL removes those keys during the cascade. The later constraint drops fail because the constraints no longer exist. The failing statement was reproduced by the owning automation and identity migration tests against PGlite.

The same generator also emits a replacement `asset_transfers` primary key using `owner_id` before the `ADD COLUMN owner_id` statement. PostgreSQL rejects that primary key because its column does not exist. The asset-owner migration regression reproduces this on a fresh database as well as a released-schema upgrade.

Changing the desired schema cannot express the missing statement-order dependency. Keeping the principal table would prevent the approved consolidation. Hand-editing this migration would also leave the next generated migration exposed to the same failure.

## Temporary workaround

[`generate-database.ts`](../../packages/pstdio-db/scripts/generate-database.ts) runs Drizzle Kit, then processes only newly generated migrations. It uses the preceding schema snapshot to identify explicit foreign-key drops whose referenced table is also dropped. It moves those drops before the first table drop, preserving their relative order. It also recognizes generated column additions and moves an addition before an earlier constraint on the same table that uses that column. Other generated statements retain their order. The migration remains reproducible through `db:generate`.

The released-schema upgrade tests execute the generated result, including populated automation and asset-transfer rows, owner-key replacement, and restart recovery. The workaround adds no runtime migration adapter or SQL exceptions.

## Limitations

The adapter recognizes the current PostgreSQL statement format and snapshot foreign-key metadata. A generator format or table-rename change needs review and an executable upgrade rehearsal. Qualification must exercise a parent removal with surviving referencing tables; empty creation alone does not cover this dependency. It must also exercise an added column used by a replacement primary key.

## Removal

Remove the ordering step when the installed generator emits dependent constraint drops before parent-table drops and required columns before replacement constraints. Regenerate the candidate and run the owning released-schema migration and interruption tests before removing the adapter. Retain the unmodified generated SQL as evidence that the upstream output now works.
