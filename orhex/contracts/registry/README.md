# Registry Contract

## Overview

The **Registry** is the **name service and governance layer** for the Ohrex DEX ecosystem. It manages DEX name reservations, tracks DEX activity, and controls access to the launchpad system. DEX operators must register through the Registry to gain launchpad privileges and be discoverable by users.

## Architecture

### Registry Cell Structure (256 bytes)

The Registry stores its global configuration in a **256-byte cell**:

```
Offset  Size  Field
------  ----  -----
0       32    owner_lock_hash         — Registry admin's lock hash
32      8     creation_fee_ckb        — Fee to create a DEX entry (default: 5,000 CKB)
40      8     re_listing_fee_ckb      — Fee to re-list a delisted DEX (default: 1,000 CKB)
48      8     reservation_fee_ckb     — Fee to reserve a name (default: 500 CKB)
56      8     total_registrations     — Total DEX entries registered
64      8     total_fees_collected    — Cumulative fees collected
72      2     manual_launch_fee_bps   — Fee for manual launches (100 = 1%)
80      2     auto_launch_fee_bps     — Fee for auto launches (300 = 3%)
88      8     activity_check_period   — Activity check window (2,592,000s = 30 days)
96      8     min_trade_volume_ckb    — Minimum volume to stay active (10,000 CKB)
104     8     min_trade_count         — Minimum trades to stay active (5)
112     8     bump                    — Unique ID counter
120     136   reserved                — Reserved for future use
```

### DEX Entry Cell Structure (320 bytes)

Each registered DEX has a **320-byte entry cell**:

```
Offset  Size  Field
------  ----  -----
0       32    dex_name_hash           — Hash of reserved DEX name
32      32    owner_lock_hash         — DEX owner's lock hash
64      32    reserved_name           — Human-readable name (32 chars)
96      8     reservation_fee_paid    — Fee paid for reservation
104     8     reserved_at             — Reservation timestamp
112     8     expires_at              — Expiration timestamp (reserved_at + 30 days)
120     8     pool_deployed_at        — When first pool was deployed
128     1     launch_mode             — 0=Manual, 1=Auto
129     8     total_launches          — Total token launches
136     8     total_volume            — Total trading volume
144     8     total_fees_paid         — Total fees paid to registry
152     8     pool_count              — Number of pools
160     1     status                  — See status codes below
161     32    pool_script_hash        — Pool type script hash
193     32    factory_script_hash     — Factory that created DEX
225     2     dex_fee_bps             — DEX trading fee
227     8     bump                    — Unique counter
235     8     last_trade_at           — Last trade timestamp
243     8     trade_count             — Total trades
251     8     last_trade_volume       — Last trade volume
259     8     stake_ckb               — CKB stake for launchpad
267     2     price_multiplier_bps    — Bonding curve multiplier (default: 100 = 1.0x)
269     8     launch_offset_blocks    — Block offset for staggered launches
277     32    reserved                — Reserved for future use
```

## Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 0 | `STATUS_RESERVED` | Name reserved, pool not yet deployed |
| 1 | `STATUS_ACTIVE` | Pool deployed, actively trading |
| 2 | `STATUS_SUSPENDED` | Temporarily suspended |
| 3 | `STATUS_INACTIVE` | No recent trading activity |
| 4 | `STATUS_EXPIRED_NO_POOL` | Reservation expired, no pool deployed |
| 5 | `STATUS_EXPIRED_WITH_POOL` | Had pool but became inactive |
| 6 | `STATUS_DELISTED_INACTIVE` | Permanently delisted |

## Operations

### 1. Register DEX

Reserves a DEX name and creates a registry entry. Validates:
- **Reservation fee paid** — `reservation_fee_paid ≥ reservation_fee_ckb`
- **Name is set** — `reserved_name` cannot be all zeros
- **Owner is set** — `owner_lock_hash` cannot be all zeros
- **Valid duration** — `expires_at > reserved_at`
- **Initial status** — Must start as `STATUS_RESERVED`

The reservation grants a **30-day window** (`RESERVATION_DURATION = 2,592,000 seconds`) to deploy the first pool.

### 2. Deploy Pool

Marks the DEX entry as having deployed its first pool. Validates:
- **Pool not already deployed** — Prevents double-deployment
- **Owner authorization** — Signature must match DEX entry owner
- **Within grace period** — Can deploy during reservation period + 7-day grace period

After deployment, status transitions from `STATUS_RESERVED` → `STATUS_ACTIVE`.

### 3. Set Launch Mode

Sets whether the DEX uses manual or automatic token launches:
- **Manual (0)**: Creator manually triggers each launch (fee: 1% = 100 bps)
- **Auto (1)**: Launches happen automatically when conditions are met (fee: 3% = 300 bps)

### 4. Launch Token

Executes a token launch through the launchpad system. The Registry tracks launch statistics and collects fees.

### 5. Update Registry

Registry admin can update global parameters (fees, activity thresholds). Requires admin signature verification.

## Fee Structure

| Fee Type | Default | Min | Max | Description |
|----------|---------|-----|-----|-------------|
| Creation Fee | 5,000 CKB | 100 | 50,000 | One-time DEX entry creation |
| Re-listing Fee | 1,000 CKB | 50 | 10,000 | Re-list a delisted DEX |
| Reservation Fee | 500 CKB | 50 | 5,000 | Reserve a DEX name |
| Manual Launch Fee | 1% (100 bps) | — | — | Fee for manual launches |
| Auto Launch Fee | 3% (300 bps) | — | — | Fee for automatic launches |

## Activity Enforcement

The Registry enforces **activity requirements** to keep DEX entries active:

- **Activity Check Period**: 30 days (`2,592,000 seconds`)
- **Minimum Trade Volume**: 10,000 CKB
- **Minimum Trade Count**: 5 trades

If a DEX fails to meet these requirements within the check period, it may be marked as `STATUS_INACTIVE` or `STATUS_EXPIRED_WITH_POOL`.

## Lifecycle

```
                    Reserve Name
                         │
                         ▼
                   STATUS_RESERVED ──────── 30 days ──→ STATUS_EXPIRED_NO_POOL
                         │
                    Deploy Pool
                         │
                         ▼
                   STATUS_ACTIVE ──── No activity ──→ STATUS_INACTIVE
                         │                                │
                    Delist?                          STATUS_EXPIRED_WITH_POOL
                         │
                         ▼
                STATUS_DELISTED_INACTIVE
```

## Security Model

- **Signature verification**: Owner-only operations verify the caller's lock script hash
- **Fee enforcement**: All fees have min/max bounds to prevent admin abuse
- **Time-bounded reservations**: Names expire if not used, preventing name squatting
- **Grace period**: 7-day grace period after reservation expiry allows pool deployment
- **No duplicate names**: Name hash uniqueness prevents impersonation

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 0 | `SUCCESS` | Operation succeeded |
| 1 | `ERROR_INVALID_ARGUMENT` | Invalid argument |
| 2 | `ERROR_INVALID_DATA_LENGTH` | Cell data length mismatch |
| 12 | `ERROR_DEX_NOT_FOUND` | DEX entry not found |
| 13 | `ERROR_INVALID_DEX_NAME` | Name is invalid |
| 16 | `ERROR_UNAUTHORIZED` | Caller not authorized |
| 17 | `ERROR_INVALID_OWNER` | Owner lock hash is zero |
| 19 | `ERROR_INVALID_REGISTRY_ENTRY` | Entry data is invalid |
| 20 | `ERROR_RESERVATION_FEE_NOT_PAID` | Reservation fee insufficient |
| 34 | `ERROR_INVALID_OPERATION` | Unknown operation |
| 36 | `ERROR_POOL_ALREADY_DEPLOYED` | Pool already deployed |

## File Structure

```
registry/
├── Cargo.toml
└── src/
    ├── main.rs       — Entry point, operation dispatch
    ├── registry.rs   — RegistryData & DexEntryData structs
    ├── error.rs      — Error code definitions
    └── util.rs       — Signature verification, name hashing
```

## Relationship to Other Contracts

```
Factory ──creates──→ DEX ──registers──→ Registry ──grants──→ Launchpad Access
                                            │
                                            ├── Name reservation
                                            ├── Activity tracking
                                            └── Launch fee collection
```

- **Factory**: Creates DEX instances that can be registered
- **DEX**: The entity being registered
- **Launchpad**: Registry entries gain access to token launch functionality
