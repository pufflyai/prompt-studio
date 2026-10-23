# Temporary lossless JSON projection encoding

Proposed: 2026-10-22

## Intended design

A derived query projection must preserve every JSON value accepted by record
storage. Installing the projection must not turn an existing valid save into an
error or change its value.

## External limitation

PostgreSQL JSONB rejects NUL characters and unpaired UTF-16 surrogates. JavaScript
JSON can represent them. Yjs preserves NUL but replaces unpaired surrogates with
U+FFFD when it serializes strings. A live document can otherwise differ from its
durable representation. Storing unrestricted JSON directly in JSONB also rejects
values, such as NUL, that the durable CRDT preserves.

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
The codec does not change CRDT bytes or sync identities.

Normalize accepted record values, object keys and shared edits to well-formed
UTF-16 before writing the source document. This exposes Yjs's existing replacement
behavior at the write boundary so live memory, indexed rows, content revisions and
reopened documents agree. It does not add a wire representation or reject saves.
Queries can still contain unpaired surrogate needles, including a match for one
half of an emoji, so their private comparison encoding remains lossless.

## Limitations

Exceptional strings need additional derived comparison bytes. Queries must avoid
converting those bytes back to PostgreSQL text. The encoding is internal and must
never appear in an extension response. Index definitions and paths must pass
through the same codec.

Storage does not retain unpaired surrogates in accepted values or object keys.
It replaces them with U+FFFD. This is an existing Yjs wire limitation, now applied
before projection maintenance instead of becoming visible only after reopening.

## Removal

Remove the codec and rebuild the derived projection when its backend can store
and compare the complete supported JSON string domain directly. No authoritative
record migration is needed because CRDT values never use this encoding. Remove
input normalization only if the authoritative format can preserve arbitrary
UTF-16 without changing existing merge behavior.
