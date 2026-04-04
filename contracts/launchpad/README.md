# Launchpad Contract

## Overview

The **Launchpad** is the most complex contract in the ATHEON ecosystem. It implements a **bonding curve-based token launch system** with built-in refund mechanisms, Merkle proof-based LP token distribution, fee vaults, and DEX operator staking. It enables fair token launches where contributors buy into a bonding curve, and if the target is met, LP tokens are distributed proportionally.

## Security Model: Off-Chain Time Coordination

A critical design decision: **time windows are enforced off-chain**, not on-chain. The contract acts as a **state machine** that validates:

1. **State transitions** are valid (PENDING → ACTIVE → SUCCESS/EXPIRED)
2. **Cryptographic proofs** (Merkle proofs for claims/refunds)
3. **Authorization** (only creator can finalize)
4. **Capacity constraints** (contributions don't exceed target)

This avoids reliance on CKB block timestamps, which require header dependencies and are not reliably available in scripts. The off-chain indexer/SDK refuses to build invalid transactions.

## Architecture

### Launch Configuration (512 bytes)

```
Offset  Size  Field
------  ----  -----
0       32    launch_id               — Unique launch identifier
32      32    creator_lock_hash       — Token creator's lock hash
64      32    token_type_hash         — Launched token type hash (SUDT)
96      32    token_name              — Token name (32 chars, zero-padded)
128     16    token_symbol            — Token symbol (16 chars, zero-padded)
144     8     total_supply            — Total token supply
152     8     target_ckb              — Soft cap (CKB to raise)
160     8     max_ckb                 — Hard cap (max CKB to accept)
168     2     price_multiplier_bps    — Price multiplier (90-110 = 0.9x-1.1x)
170     1     status                  — See status codes below
171     8     start_time              — Bonding curve start timestamp
179     8     end_time                — Bonding curve end timestamp
187     8     launch_offset           — Block offset from parent launch
195     8     total_contributed_ckb   — Total CKB contributed
203     8     total_tokens_allocated  — Total tokens allocated to curve
211     8     contributor_count       — Number of unique contributors
219     32    dex_script_hash         — DEX where liquidity deploys
251     32    registry_entry_hash     — Registry entry hash
283     8     stake_ckb               — DEX operator stake (slashable)
291     2     fee_bps                 — Fee for this launch (basis points)
293     98    reserved                — Reserved for future use
```

### Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 0 | `STATUS_PENDING` | Launch created, not yet active |
| 1 | `STATUS_ACTIVE` | Bonding curve is accepting contributions |
| 2 | `STATUS_SUCCESS` | Target reached, launch successful |
| 3 | `STATUS_EXPIRED` | Time window passed, target not met |
| 4 | `STATUS_CANCELLED` | Launch manually cancelled |

### DCurve — Bonding Curve (256 bytes)

Each DEX operator can create a bonding curve for a launch:

```
Offset  Size  Field
------  ----  -----
0       32    curve_id                — Unique curve identifier
32      32    launch_id               — Reference to launch config
64      32    dex_operator_lock_hash  — DEX operator's lock hash
96      32    dex_script_hash         — DEX script hash
128     2     price_multiplier_bps    — 95=0.95x, 100=1.0x, 105=1.05x
130     1     status                  — See curve status codes below
131     8     start_time              — Curve start timestamp
139     8     end_time                — Curve end timestamp
147     8     launch_offset_blocks    — Block offset from previous curve
155     8     target_ckb              — Target CKB for this curve
163     8     current_ckb             — Current CKB in curve
171     8     tokens_allocated        — Tokens allocated to curve
179     8     tokens_sold             — Tokens sold via bonding curve
187     8     contributor_count       — Number of contributors
195     8     stake_ckb               — Slashable stake
203     8     fees_generated          — Fees generated (CKB)
211     8     current_price_scaled    — Current price (scaled by 1e12)
219     8     initial_price_scaled    — Initial price (scaled by 1e12)
227     70    reserved                — Reserved for future use
```

### Curve Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 0 | `CURVE_STATUS_PENDING` | Curve created, not yet active |
| 1 | `CURVE_STATUS_ACTIVE` | Accepting contributions |
| 2 | `CURVE_STATUS_FILLED` | Target reached |
| 3 | `CURVE_STATUS_SUCCESS` | Successfully completed |
| 4 | `CURVE_STATUS_EXPIRED` | Time window passed |
| 5 | `CURVE_STATUS_REFUNDED` | Refunds processed |

### Fee Vault (192 bytes)

Manages fee distribution after a successful launch:

```
Offset  Size  Field
------  ----  -----
0       32    vault_id                — Unique vault identifier
32      32    launch_id               — Associated launch
64      8     total_fees_collected    — Total fees collected (CKB)
72      8     total_fees_distributed  — Total fees distributed (CKB)
80      8     lp_count                — Number of LPs
88      8     total_lp_shares         — Total LP shares for pro-rata
96      8     last_distribution_time  — Last distribution timestamp
104     8     distribution_count      — Number of distributions
112     2     lp_fee_bps              — LP fee (default: 7000 = 70%)
114     2     operator_fee_bps        — Operator fee (default: 2000 = 20%)
116     2     protocol_fee_bps        — Protocol fee (default: 1000 = 10%)
118     106   reserved                — Reserved for future use
```

### Refund Claim (128 bytes)

Manages refund processing for failed launches:

```
Offset  Size  Field
------  ----  -----
0       32    merkle_root             — Merkle root of all refund claims
32      32    launch_id               — Associated launch
64      32    curve_id                — Associated curve
96      8     total_refund_ckb        — Total CKB to refund
104     8     total_refund_tokens     — Total tokens to refund
112     8     claim_count             — Total number of claims
120     8     claims_processed        — Claims processed so far
128     1     status                  — 0=Pending, 1=Active, 2=Completed
129     8     refund_start_time       — Refund window start
137     8     refund_end_time         — Refund window end
145     17    reserved                — Reserved for future use
```

## Operations

### 1. Create Launch

Creates a new token launch configuration. Validates:
- **Target and supply are non-zero** — `target_ckb > 0` and `total_supply > 0`
- **Price multiplier is reasonable** — 90-110 bps (0.9x to 1.1x)
- **Time window is valid** — `end_time > start_time`

The launch cell is created with `status = STATUS_PENDING`.

### 2. Contribute

Contributes CKB to the bonding curve. Validates:
- **Transaction has inputs** — CKB must be coming from somewhere
- **Curve is active** — `status == CURVE_STATUS_ACTIVE`
- **Curve not full** — `current_ckb < target_ckb`
- **Contribution within bounds** — Doesn't exceed remaining capacity

**Bonding curve pricing** uses an exponential formula:
```
price = initial_price × (1 + tokens_sold / tokens_allocated) × price_multiplier_bps / 100
tokens = ckb_amount × 1e12 / price
```

This means the price increases as more tokens are sold, creating a natural price discovery mechanism.

### 3. Finalize

Finalizes a successful launch. Validates:
- **Caller is authorized** — Must be the launch creator
- **Target reached** — `total_contributed_ckb ≥ target_ckb`
- **Token supply sufficient** — `total_supply ≥ total_tokens_allocated`
- **State transition valid** — PENDING/ACTIVE → SUCCESS

After finalization, LP tokens can be claimed by contributors.

### 4. Claim LP Tokens

Claims LP tokens after a successful launch. Validates:
- **Launch was successful** — `status == STATUS_SUCCESS`
- **Valid Merkle proof** — Claimant must provide a cryptographic proof showing they contributed

The Merkle proof is embedded in the transaction witness:
```
Witness format: [leaf_hash: 32][proof_length: 1][proof_hashes: N×32][index: 8]
```

### 5. Refund

Claims a refund for a failed launch. Validates:
- **Refund is active** — `status == 1` (set by off-chain coordinator)
- **Claims remaining** — `claims_processed < claim_count`
- **Valid Merkle proof** — Same witness format as LP claims

Refunds use the same Merkle tree mechanism as LP claims, ensuring cryptographic proof of contribution.

### 6. Distribute Fees

Distributes accumulated trading fees. Validates:
- **Caller is authorized** — Only creator can distribute
- **Fees available** — `total_fees_collected > total_fees_distributed`

Fee distribution follows the vault's fee split:
- **70% to LPs** (pro-rata by LP shares)
- **20% to DEX operator**
- **10% to protocol**

## Operation Detection

The contract determines the operation by analyzing output cell data sizes:

| Output Data Size | Operation |
|-----------------|-----------|
| 512 bytes | CreateLaunch / Contribute / Finalize (based on status byte) |
| 256 bytes | Contribute (DCurve cell) |
| 192 bytes | DistributeFees (FeeVault cell) |
| 128 bytes | Refund (RefundClaim cell) |

The status byte at offset 170 of the launch config determines the specific operation:
- `0` → CreateLaunch
- `1` → Contribute
- `2` → Finalize
- `3` → Refund

## State Machine

```
                    Create Launch
                         │
                         ▼
                   STATUS_PENDING
                         │
                    Start Time
                         │
                         ▼
                   STATUS_ACTIVE ──── Contribute ──→ Curve fills
                         │                                │
                    Target met?                           ▼
                    /        \                     STATUS_SUCCESS
                   Yes        No                       │
                   │          │                        │
                   ▼          ▼                        ▼
             STATUS_SUCCESS  STATUS_EXPIRED      Claim LP Tokens
                   │          │
                   │          ▼
                   │     Refund Claims
                   │          │
                   │          ▼
                   │    STATUS_COMPLETED
                   │
                   ▼
             Fee Distribution
```

## Merkle Proof System

Both LP claims and refunds use **Blake2b-256 Merkle trees** for cryptographic proof of contribution:

### Tree Construction
1. Each contributor gets a **leaf**: `blake2b(address || amount || launchId)`
2. Leaves are paired and hashed up to a **root**
3. The root is stored on-chain in the launch/refund cell

### Claim Verification
1. Claimant provides: leaf hash, proof hashes, index
2. Contract recomputes the root from the leaf and proof
3. If computed root matches stored root → claim is valid

This supports up to **2^16 = 65,536 contributors** with a maximum proof depth of 16.

## DEX Operator Staking

DEX operators must **stake CKB** when creating curves. This stake is **slashable** if the operator behaves maliciously (e.g., creates curves but doesn't follow through). The stake amount is stored in both the launch config (`stake_ckb`) and the curve (`stake_ckb`).

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 0 | `SUCCESS` | Operation succeeded |
| 1 | `ERROR_INVALID_ARGUMENT` | Invalid argument |
| 2 | `ERROR_INVALID_DATA_LENGTH` | Cell data length mismatch |
| 3 | `ERROR_UNAUTHORIZED` | Caller not authorized |
| 4 | `ERROR_INVALID_STATE` | Invalid state for operation |
| 5 | `ERROR_CURVE_NOT_FOUND` | Curve cell not found |
| 6 | `ERROR_CURVE_ALREADY_ACTIVE` | Curve already active |
| 7 | `ERROR_CURVE_EXPIRED` | Curve has expired |
| 8 | `ERROR_TARGET_NOT_REACHED` | Target not met for finalization |
| 9 | `ERROR_TARGET_EXCEEDED` | Contribution exceeds remaining capacity |
| 10 | `ERROR_INVALID_PRICE_MULTIPLIER` | Price multiplier out of range |
| 11 | `ERROR_INVALID_LAUNCH_TIME` | Invalid time window |
| 12 | `ERROR_STAKE_INSUFFICIENT` | DEX operator stake too low |
| 13 | `ERROR_DEX_NOT_REGISTERED` | DEX not in registry |
| 14 | `ERROR_CLAIM_NOT_READY` | Launch not successful, can't claim |
| 15 | `ERROR_INVALID_MERKLE_PROOF` | Merkle proof verification failed |
| 16 | `ERROR_VAULT_NOT_INITIALIZED` | Fee vault not set up |
| 17 | `ERROR_FEE_DISTRIBUTION_FAILED` | No fees to distribute |

## File Structure

```
launchpad/
├── Cargo.toml
└── src/
    ├── main.rs    — Entry point, operation detection, validation logic
    ├── config.rs  — LaunchConfig struct (512 bytes), status codes
    ├── dcurve.rs  — DCurve bonding curve struct (256 bytes), pricing
    ├── vault.rs   — FeeVault struct (192 bytes), fee distribution
    ├── refund.rs  — RefundClaim struct (128 bytes), Merkle proof verification
    └── error.rs   — Error code definitions
```

## Relationship to Other Contracts

```
Factory ──creates──→ DEX ──registers──→ Registry ──grants──→ Launchpad
                                                        │
                                              ┌─────────┼─────────┐
                                              ▼         ▼         ▼
                                        Launch     DCurve    FeeVault
                                          │          │         │
                                          ▼          ▼         ▼
                                     Contributors  Trading   LP/Operator
                                                    │         Protocol
                                                    ▼
                                               RefundClaim
                                               (if failed)
```

- **Factory**: Creates DEX instances that can operate curves
- **DEX**: DEX operators create bonding curves for launches
- **Registry**: Provides launch access and fee configuration
- **Pool**: After successful launch, LP tokens represent pool shares
