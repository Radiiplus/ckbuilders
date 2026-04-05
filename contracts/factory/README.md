# Factory Contract

## Overview

The **Factory** is the root contract of the Ohrex DEX ecosystem. It acts as a **registry and fee governor** for all DEX instances created under it. Every DEX must be created through the Factory, which enforces fee bounds, collects a cut of trading fees, and charges a creation fee.

## Architecture

### Cell Structure

The Factory stores its configuration in a **256-byte cell data** layout:

```
Offset  Size  Field
------  ----  -----
0       32    owner_lock_hash       — Owner's lock script hash (32 bytes)
40      2     factory_fee_bps       — % of DEX fee that goes to factory (basis points)
48      8     dex_count             — Total DEX instances created
56      8     total_fees_collected  — Cumulative fees collected
64      2     minimum_dex_fee_bps   — Minimum allowed DEX fee (default: 10 = 0.1%)
72      2     maximum_dex_fee_bps   — Maximum allowed DEX fee (default: 500 = 5%)
80      8     creation_fee_ckb      — CKB fee to create a new DEX
88      8     total_creation_fees   — Cumulative creation fees collected
96      2     creator_fee_bps       — % of DEX fee that goes to DEX creator
104     8     bump                  — Unique ID generation counter
112     152   reserved              — Reserved for future use
```

### DEX Instance Structure

Each DEX created by the Factory is a **192-byte cell**:

```
Offset  Size  Field
------  ----  -----
0       32    dex_id              — Unique DEX identifier
32      32    dex_name_hash       — Hash of DEX name
64      32    owner_lock_hash     — DEX owner's lock hash
96      2     dex_fee_bps         — DEX trading fee (basis points)
104     2     factory_fee_bps     — Factory's cut of DEX fee
112     2     creator_fee_bps     — Creator's cut of DEX fee
120     2     lp_fee_bps          — LP's cut of DEX fee
128     8     pool_count          — Number of pools in this DEX
136     8     total_volume        — Total trading volume
144     8     total_fees_paid     — Total fees paid to factory
168     1     status              — 0=Active, 1=Suspended, 2=Delisted
248     8     bump                — Unique counter
```

## Operations

### 1. Create DEX

The primary operation. Validates:
- **DEX fee is within bounds** (`minimum_dex_fee_bps` ≤ `dex_fee_bps` ≤ `maximum_dex_fee_bps`)
- **Fee breakdown is correct** — Factory calculates expected factory/creator/LP fee splits and verifies they match the DEX instance
- **No zero fees** — All three fee recipients must receive non-zero amounts
- **Owner is set** — DEX owner lock hash cannot be all zeros
- **DEX ID is set** — DEX ID cannot be all zeros
- **Creation fee paid** — The transaction must include the required creation fee

### 2. Update Factory

Only the Factory owner can update factory parameters (fee rates, creation fee, etc.). Requires signature verification against `owner_lock_hash`.

### 3. Collect Fees

Factory owner can collect accumulated fees. Requires signature verification.

### 4. Update DEX

DEX owner can update their DEX instance. Validates:
- Signature matches DEX owner
- Fee breakdown still matches Factory's expected calculation

## Fee Model

The Factory enforces a **three-way fee split** on every DEX trade:

```
DEX Fee (e.g., 30 bps = 0.3%)
├── Factory Fee   = dex_fee_bps × factory_fee_bps / 10000
├── Creator Fee   = dex_fee_bps × creator_fee_bps / 10000
└── LP Fee        = dex_fee_bps - factory_fee - creator_fee
```

**Default values:**
- `factory_fee_bps`: 500 (16.67% of DEX fee)
- `creator_fee_bps`: 300 (10% of DEX fee)
- Remaining ~73.33% goes to LPs

## Security Model

- **Signature verification**: Owner-only operations verify the caller's lock script hash matches the stored `owner_lock_hash`
- **Fee enforcement**: The Factory refuses to create DEX instances with fees outside the allowed range
- **Creation fee**: Prevents spam by requiring CKB payment for each DEX creation
- **No trust in client data**: Fee breakdowns are recalculated on-chain, never trusted from transaction inputs

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 0 | `SUCCESS` | Operation succeeded |
| 1 | `ERROR_INVALID_ARGUMENT` | Invalid argument provided |
| 2 | `ERROR_INVALID_DATA_LENGTH` | Cell data length mismatch |
| 13 | `ERROR_INVALID_DEX_NAME` | DEX name is invalid |
| 14 | `ERROR_INVALID_DEX_FEE` | DEX fee out of bounds |
| 16 | `ERROR_UNAUTHORIZED` | Caller not authorized |
| 17 | `ERROR_INVALID_OWNER` | Owner lock hash is zero |
| 34 | `ERROR_INVALID_OPERATION` | Unknown operation |
| 43 | `ERROR_INSUFFICIENT_FEE_BALANCE` | Creation fee not paid |
| 44 | `ERROR_INVALID_FEE_PERCENTAGE` | Fee breakdown mismatch |

## File Structure

```
factory/
├── Cargo.toml
└── src/
    ├── main.rs      — Entry point, operation dispatch
    ├── factory.rs   — FactoryData & DexInstanceData structs
    ├── error.rs     — Error code definitions
    └── util.rs      — Signature verification, name hashing
```
