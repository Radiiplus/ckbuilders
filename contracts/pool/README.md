# Pool Contract

## Overview

The **Pool** contract implements a **Constant Product Automated Market Maker (AMM)** — the core trading engine of the Ohrex DEX ecosystem. Each pool represents a trading pair between two tokens (or CKB and a token) and maintains reserves, LP shares, and the invariant `k = reserve_a × reserve_b`.

## Architecture

### Cell Structure

The Pool stores its state in a **152-byte cell data** layout:

```
Offset  Size  Field
------  ----  -----
0       32    pool_id             — Unique pool identifier
32      32    token_a_type_hash   — Token A type script hash
64      32    token_b_type_hash   — Token B type script hash
96      8     reserve_a           — Token A reserve balance
104     8     reserve_b           — Token B reserve balance
112     8     fee_bps             — Trading fee in basis points
120     8     lp_supply           — Total LP tokens in circulation
128     8     k_last              — Last recorded k value (for fee-on-transfer)
136     8     bump                — Unique ID counter
144     8     created_at          — Pool creation timestamp
```

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `POOL_DATA_SIZE` | 152 bytes | Fixed cell data size |
| `MINIMUM_LIQUIDITY` | 1,000 | Minimum LP tokens locked at initialization (prevents dust attacks) |
| `MAX_FEE_BPS` | 1,000 | Maximum fee: 10% |
| `DEFAULT_FEE_BPS` | 30 | Default fee: 0.3% |

## Operations

### 1. Initialize

Creates a new pool with initial liquidity. Validates:
- **Not already initialized** — `reserve_a > 0 && reserve_b > 0` means pool exists
- **Fee is valid** — `0 < fee_bps ≤ MAX_FEE_BPS`
- **Tokens are different** — `token_a_type_hash ≠ token_b_type_hash`

On first liquidity provision, `MINIMUM_LIQUIDITY` (1,000) LP tokens are permanently locked to prevent first-depositor manipulation.

### 2. Add Liquidity

Adds tokens to the pool and mints LP tokens. Validates:
- **Pool is initialized** — Both reserves must be non-zero
- **K invariant maintained** — The product `reserve_a × reserve_b` must not decrease

LP tokens minted are proportional to the depositor's contribution relative to existing reserves:
```
If first deposit:  lp_tokens = sqrt(amount_a × amount_b) - MINIMUM_LIQUIDITY
If existing pool:  lp_tokens = min(amount_a × lp_supply / reserve_a, amount_b × lp_supply / reserve_b)
```

### 3. Remove Liquidity

Burns LP tokens and returns underlying tokens. Validates:
- **Pool is initialized**
- **Sufficient LP tokens** — User must have enough LP tokens to burn

Tokens returned are proportional to LP share:
```
amount_a = lp_burned × reserve_a / lp_supply
amount_b = lp_burned × reserve_b / lp_supply
```

### 4. Swap

Executes a token swap using the constant product formula. Validates:
- **Pool is initialized**

The swap output is calculated as:
```
amount_in_with_fee = amount_in × (10000 - fee_bps)
amount_out = (amount_in_with_fee × reserve_out) / (reserve_in × 10000 + amount_in_with_fee)
```

The fee is deducted from the input amount before the swap calculation, ensuring LPs earn fees on every trade.

## K Invariant

The pool maintains the **constant product invariant**: `k = reserve_a × reserve_b`

After every operation, the new `k` must be **greater than or equal to** the previous `k`. This ensures:
- LPs always receive fair value
- No value can be extracted without providing equivalent value
- Fees accumulate into the reserves, increasing LP share value over time

## Fee Model

Trading fees are **embedded in the swap calculation**:

```
Input:  100 CKB, Fee: 30 bps (0.3%)
Fee:    100 × 30 / 10000 = 0.3 CKB
Net:    99.7 CKB used for swap
```

The fee stays in the pool reserves, automatically increasing the value of each LP token. No separate fee collection transaction is needed.

## Security Model

- **Initialization guard**: Pool cannot be re-initialized once reserves are set
- **K invariant check**: Prevents value extraction through reserve manipulation
- **Token uniqueness**: Prevents same-token pools (which would be meaningless)
- **Fee bounds**: Maximum 10% fee prevents excessive charges
- **Minimum liquidity**: 1,000 LP tokens locked at creation prevents first-depositor price manipulation

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 0 | `SUCCESS` | Operation succeeded |
| 1 | `ERROR_INVALID_ARGUMENT` | Invalid argument |
| 2 | `ERROR_INVALID_DATA_LENGTH` | Cell data length mismatch |
| 9 | `ERROR_INVALID_FEE` | Fee out of bounds (0 or > 1000) |
| 12 | `ERROR_TOKEN_MISMATCH` | Token A and B are the same |
| 21 | `ERROR_POOL_NOT_INITIALIZED` | Pool has no reserves |
| 22 | `ERROR_POOL_ALREADY_INITIALIZED` | Pool already exists |
| 34 | `ERROR_INVALID_OPERATION` | Unknown operation |

## File Structure

```
pool/
├── Cargo.toml
└── src/
    ├── main.rs   — Entry point, operation dispatch
    ├── pool.rs   — PoolData struct, serialization, K invariant
    ├── error.rs  — Error code definitions
    └── util.rs   — Authorization loading
```

## Relationship to Other Contracts

```
DEX ──creates──→ Pool (trading pair)
                  │
                  ├── swap (AMM)
                  ├── add_liquidity (mint LP)
                  └── remove_liquidity (burn LP)
```

- **DEX**: Creates and governs the pool, sets the fee rate
- **Factory**: Indirectly governs through DEX fee bounds
- **Launchpad**: After a successful token launch, LP tokens are distributed to contributors
