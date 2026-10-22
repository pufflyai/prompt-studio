# Temporary lossless JSON projection encoding

Proposed: 2026-10-22

## Intended design

A derived query projection must preserve every JSON value accepted by record
storage. Installing the projection must not turn an existing valid save into an
error or change its value.

## External limitation

PostgreSQL JSONB rejects NUL characters and unpaired UTF-16 surrogates. JavaScript
JSON and the authoritative CRDT can represent them. Storing unrestricted JSON
directly in JSONB therefore breaks the existing storage contract.

## Decision

Use a private reversible encoding for NUL and non-ASCII strings.
Reserve and escape a key namespace so encoded strings cannot collide with user
objects. Retain exact UTF-16 units for decoding and byte sequences for string
comparison. Non-ASCII strings also need encoding because PostgreSQL and JavaScript
have different Unicode lowercase rules. Store the JavaScript lowercase form as
independently encoded UTF-16 units so substring predicates preserve the existing
JavaScript behavior, including half-surrogate matches. Use code point bytes for
ordering. Ordinary ASCII string and object values keep their existing representation.
Decode values at the projection read boundary. Equality, ordering, substring
predicates and field paths use the same encoding in the SQL compiler.

This is a temporary workaround for the backend limitation, not a public storage
format. It remains confined to the derived projection and its query compiler.
CRDT bytes, public values, content revisions and sync identities remain unchanged.

## Limitations

Exceptional strings need additional derived comparison bytes. Queries must avoid
converting those bytes back to PostgreSQL text. The encoding is internal and must
never appear in an extension response. Index definitions and paths must pass
through the same codec.

## Removal

Remove the codec and rebuild the derived projection when its backend can store
and compare the complete supported JSON string domain directly. No authoritative
record migration is needed because CRDT values never use this encoding.
