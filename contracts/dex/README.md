# DEX Contract

## Overview

The **DEX** contract represents an individual decentralized exchange instance within the Ohrex ecosystem. Each DEX is created by the Factory contract and operates independently, managing its own pools, trading fees, and activity tracking. A DEX is owned by a single entity (the DEX operator) who can create pools, record trades, and update DEX settings.

## Architecture

### Cell Structure

The DEX stores its state in a **256-byte cell data** layout:

```
Offset  Size  Field
------  ----  -----
0       32    dex_name_hash         — Hash of DEX name (unique identifier)
32      32    owner_lock_hash       — DEX owner's lock script hash
64      32    dex_name              — Human-readable name (32 chars, zero-padded)
96      32    description_hash      — Hash of DEX description
128     32    factory_script_hash   — Factory that created this DEX
160     32    registry_entry_hash   — Registry entry (when registered)
192     8     pool_count            — Number of trading pools
200     8     total_volume          — Total trading volume (CKB)
208     8     total_trades          — Total number of trades
216     8     total_fees_collected  — Total fees collected (CKB)
224     2     dex_fee_bps           — Trading fee in basis points (e.g., 30 = 0.3%)
226     1     status                — 0=Active, 1=Suspended, 2=Delisted
227     8     created_at            — Creation timestamp
235     8     last_activity_at      — Last trade timestamp
243     8     bump                  — Unique ID counter
251     88    reserved              — Reserved for future use
```

## Operations

### 1. Create Pool

The DEX owner can create new trading pools. Validates:
- **Owner authorization** — Signature must match `owner_lock_hash`
- **Transaction structure** — Must have valid inputs and outputs
- **Pool token validity** — Token A and Token B type hashes must be non-zero
- **Token uniqueness** — Token A and Token B must be different (no self-pairs)

The pool cell is created as a second output in the transaction, with the DEX cell as the first output.

### 2. Remove Pool

The DEX owner can remove existing pools. Requires owner signature verification.

### 3. Update DEX

The DEX owner can update DEX settings (name, description, fee, etc.). Requires owner signature verification.

### 4. Record Trade

Records trading activity (volume, fees). This operation is lightweight — actual trade validation happens at the **Pool** contract level. The DEX contract simply tracks aggregate statistics.

## Operation Detection

The DEX contract determines which operation is being performed by analyzing the transaction structure:

```
Output Count  Input vs Output  Operation
------------  ---------------  ---------
≥ 2 outputs   any              CreatePool (DEX cell + Pool cell)
< inputs      more inputs      RemovePool (pool cell consumed)
1 in, 1 out   equal            UpdateDex (single cell update)
other         any              RecordTrade (fee payment)
```

This approach avoids requiring clients to specify an operation — the contract infers it from the transaction structure, preventing spoofing.

## Signature Verification

The DEX uses a **two-layer verification** model:

1. **CKB lock script level** — The input's lock script (Secp256k1Blake160) verifies the cryptographic signature
2. **Contract level** — The contract verifies that the lock script hash of the input matches the DEX owner's stored `owner_lock_hash`

This is the correct CKB pattern: don't duplicate signature verification in the contract, rely on CKB's lock script for cryptography, and verify identity at the application level.

## DEX Naming

DEX names are:
- Maximum 32 characters
- Alphanumeric, spaces, underscores, and hyphens only
- Hashed using XOR-based hashing for the `dex_name_hash` field
- Validated before creation to prevent invalid names

## Status Lifecycle

```
Active (0) ──→ Suspended (1) ──→ Delisted (2)
    ↑              │
    └──────────────┘
    (can be reactivated)
```

- **Active**: Normal operation, can create pools and trade
- **Suspended**: Temporarily paused, no new operations
- **Delisted**: Permanently removed from the ecosystem

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 0 | `SUCCESS` | Operation succeeded |
| 1 | `ERROR_INVALID_ARGUMENT` | Invalid argument |
| 2 | `ERROR_INVALID_DATA_LENGTH` | Cell data length mismatch |
| 3 | `ERROR_UNAUTHORIZED` | Caller not authorized |
| 4 | `ERROR_INVALID_OPERATION` | Unknown operation |
| 5 | `ERROR_POOL_NOT_FOUND` | Pool doesn't exist |
| 6 | `ERROR_POOL_ALREADY_EXISTS` | Duplicate pool |
| 7 | `ERROR_DEX_SUSPENDED` | DEX is suspended |
| 8 | `ERROR_REGISTRY_NOT_FOUND` | No registry entry |
| 9 | `ERROR_INVALID_FEE` | Invalid fee |
| 10 | `ERROR_SLIPPAGE` | Slippage exceeded |
| 11 | `ERROR_INSUFFICIENT_LIQUIDITY` | Not enough liquidity |

## File Structure

```
dex/
├── Cargo.toml
└── src/
    ├── main.rs   — Entry point, operation detection and dispatch
    ├── dex.rs    — DexData struct, serialization, state management
    ├── error.rs  — Error code definitions
    └── util.rs   — Signature verification, name parsing, ID generation
```

## Relationship to Other Contracts

```
Factory ──creates──→ DEX ──creates──→ Pool
                      │
                      └──registers──→ Registry
```

- **Factory**: Creates and governs the DEX (sets fee bounds, collects fees)
- **Pool**: Created by the DEX, handles actual AMM swaps
- **Registry**: DEX can register for discoverability and launchpad access
