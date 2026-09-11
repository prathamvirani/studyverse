# Feature ownership

Each domain owns its operations, policies, data and migrations. Applications select public server/browser exports; features use SDK contracts rather than another feature’s implementation.

| Domain      | Ownership                                                                             |
| ----------- | ------------------------------------------------------------------------------------- |
| identity    | Users, OAuth identities/flows, account and session operations                         |
| rooms       | Persistent rooms, membership, general and friend invitations, room access ports       |
| friends     | Relationships, blocks, privacy and public social directory                            |
| presence    | Ephemeral connection leases and privacy-filtered presence                             |
| pomodoro    | Independent Personal/account and Shared/room timestamp anchors; shared timer events   |
| tasks       | Separate private and shared tables/policies, versions, ordering and replay tombstones |
| chat        | Room messages, history, moderation tombstones and block-filtered projection           |
| backgrounds | Curated catalog, validated local imports and durable owner-controlled room defaults   |
| rtc         | Ephemeral media leases, scoped admission, authorized audience and provider revocation |

Rooms’ public ProductivityRooms port supplies transaction-aware access to productivity, backgrounds and RTC; its existing public name is retained. Friends supplies block checks and Identity supplies public names. No feature queries another feature’s private tables. Foreign keys and cross-schema migration dependencies are deliberate referential integrity, not runtime access ports.

Web composition registers domain panels, dock actions, environment and media renderers. RoomShell consumes generic registries. LiveKit SDKs remain in adapters; adversarial/synthetic providers live in tests. See [current architecture](../../docs/architecture/CODEBASE.md).
