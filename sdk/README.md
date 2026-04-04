# ATHEON SDK

## Overview

The **ATHEON SDK** is a JavaScript/Node.js library that provides the **off-chain counterpart** to the on-chain CKB contracts. It handles transaction building, data encoding/decoding, fee estimation, cryptographic proofs, and bonding curve calculations — everything needed to interact with the ATHEON protocol from a client, CLI, or indexer.

## Installation

```bash
npm install
```

The SDK depends on:
- **`@ckb-ccc/core`** — CKB client library for transaction construction, signing, and RPC
- **`@noble/hashes`** — Blake2b hashing for Merkle proofs

## Quick Start

```javascript
const {
  SimpleTxBuilder,
  FeeEstimator,
  createLaunchConfig,
  encodeLaunchConfig,
  calculateTokensForCkb,
  generateBatchProofs,
} = require("./sdk");

// Connect to CKB
const txBuilder = new SimpleTxBuilder("http://127.0.0.1:8114", {
  secpCellDepTxHash: "0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293",
  secpCodeHash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
  secpHashType: "type",
});

// Estimate fees
const estimator = new FeeEstimator("http://127.0.0.1:8114");
const estimation = await estimator.estimateFee(inputs, outputs, 3000);

// Build and send a transaction
const { txHash } = await txBuilder.buildAndSendWithRbfRetry(
  outputs,
  outputsData,
  privateKey,
  3000
);
```

## Architecture

The SDK mirrors the **on-chain contract structure** with matching modules:

```
SDK Module          ↔  On-Chain Contract    Purpose
──────────────────     ──────────────────    ───────────────────────────────
sdk/factory.js      ↔  contracts/factory    DEX creation, fee calculation
sdk/pool.js         ↔  contracts/pool       AMM math, LP tokens, fee vault
sdk/curve.js        ↔  contracts/launchpad  Bonding curve pricing
sdk/launchpad.js    ↔  contracts/launchpad  Launch config, tx building
sdk/refund.js       ↔  contracts/launchpad  Refund claims, Merkle proofs
sdk/modules/merkle.js ↔ contracts/launchpad Merkle tree generation/verification
sdk/modules/crypto.js  (utility)            ID generation, hashing
sdk/fee.js          (off-chain only)        RBF-aware fee estimation
sdk/txbuilder.js    (off-chain only)        Transaction construction + signing
```

### Key Design Principle

**The SDK and contracts share the same data layouts.** Every struct encoded by the SDK can be decoded by the on-chain contract, and vice versa:

| SDK Function | Contract Struct | Size |
|-------------|----------------|------|
| `encodeFactoryData()` | `FactoryData` | 256 bytes |
| `encodeDexData()` | `DexData` | 256 bytes |
| `encodePoolData()` | `PoolData` | 152 bytes |
| `encodeLaunchConfig()` | `LaunchConfig` | 512 bytes |
| `encodeCurveData()` | `DCurve` | 256 bytes |
| `encodeVaultData()` | `FeeVault` | 192 bytes |
| `encodeRefundClaim()` | `RefundClaim` | 162 bytes |

This ensures **byte-level compatibility** between off-chain preparation and on-chain validation.

## API Reference

### Core — Transaction Building

#### `SimpleTxBuilder`

Constructs, signs, and sends CKB transactions with automatic fee estimation and RBF retry.

```javascript
const txBuilder = new SimpleTxBuilder(rpcUrl, {
  secpCellDepTxHash, secpCodeHash, secpHashType,
  feeRate: 3000, maxFeeRate: 10000,
});

// Get lock script for an address
const lockScript = await txBuilder.getLockScript(privateKey);

// Get address
const address = await txBuilder.getAddress(privateKey);

// Build and send with automatic RBF retry
const { txHash } = await txBuilder.buildAndSendWithRbfRetry(
  outputs,       // [{ lock, capacity, type? }]
  outputsData,   // ["0x...", "0x..."]
  privateKey,    // "0x..."
  feeRate,       // 3000 (shannons/KB)
  cellDeps,      // optional custom cell deps
  maxRetries     // 3 (default)
);

// Wait for on-chain confirmation
await txBuilder.waitForTransaction(txHash, {
  timeoutMs: 60000,
  pollIntervalMs: 2000,
});
```

#### `FeeEstimator`

RBF-aware fee estimation that detects pending transactions and adjusts fees accordingly.

```javascript
const estimator = new FeeEstimator(rpcUrl, {
  defaultFeeRate: 3000,
  minFeeRate: 1000,
  rbfMultiplier: 1.5,
});

// Estimate fee for a transaction
const estimation = await estimator.estimateFee(inputs, outputs, 3000);
// Returns: { fee, feeRate, size, rbfInfo, breakdown }

// Dry run (no signing)
const dryRun = await estimator.dryRun(outputs, outputsData, estimatedInputs);
// Returns: { ...estimation, summary: { outputCapacity, estimatedFee, totalNeeded } }
```

#### `calculateMinimumCapacity(lockScript, typeScript, dataHex)`

Calculates the exact CKB capacity needed for a cell based on its byte size.

```javascript
const capacity = calculateMinimumCapacity(lockScript, null, curveDataHex);
// Returns: bigint (in shannons, 1 CKB = 100,000,000 shannons)
```

### Factory + DEX

```javascript
const {
  // Constants
  FACTORY_DATA_SIZE,        // 256 bytes
  DEX_INSTANCE_SIZE,        // 192 bytes
  DEX_DATA_SIZE,            // 256 bytes
  DEFAULT_FACTORY_CONFIG,   // { factoryFeeBps: 500, minDexFeeBps: 10, ... }
  DEFAULT_DEX_FEE_BPS,      // 30 (0.3%)
  DEX_STATUS_ACTIVE,        // 0
  DEX_STATUS_SUSPENDED,     // 1
  DEX_STATUS_DELISTED,      // 2

  // Factory
  createFactoryConfig,      // (options?) → FactoryConfig
  encodeFactoryData,        // (data) → Uint8Array(256)
  decodeFactoryData,        // (bytes) → FactoryData

  // DEX
  encodeDexInstanceData,    // (data) → Uint8Array(192)
  decodeDexInstanceData,    // (bytes) → DexInstanceData
  encodeDexData,            // (data) → Uint8Array(256)
  decodeDexData,            // (bytes) → DexData

  // Fee calculations
  calculateFeeBreakdown,    // (dexFeeBps, factoryFeeBps, creatorFeeBps) → { factoryCut, creatorCut, lpCut }
  calculateSwapFees,        // (volume, dexFeeBps, factoryFeeBps) → [factoryFee, lpFee]
  calculateInitialLP,       // (reserveA, reserveB) → initialLPTokens

  // Utilities
  hashDexName,              // (name) → "0x..." (SHA256)
  generateDexId,            // (factoryHash, ownerHash, bump) → "0x..."
  validateDexName,          // (name) → boolean
  checkActivityRequirements, // (tradeCount, volume, lastTradeAt, now) → { isActive, reason }
} = require("./sdk");
```

### Pool + Vault

```javascript
const {
  // Constants
  MINIMUM_LIQUIDITY,        // 1,000 (locked at initialization)
  MAX_FEE_BPS,              // 1,000 (10%)
  DEFAULT_FEE_BPS,          // 30 (0.3%)
  POOL_DATA_SIZE,           // 152 bytes
  VAULT_DATA_SIZE,          // 192 bytes

  // Fee split defaults
  DEFAULT_LP_FEE_BPS,       // 7,000 (70%)
  DEFAULT_OPERATOR_FEE_BPS, // 2,000 (20%)
  DEFAULT_PROTOCOL_FEE_BPS, // 1,000 (10%)

  // AMM calculations
  calculateSwapOutput,      // (reserveIn, reserveOut, amountIn, feeBps) → { amountOut, fee, priceImpact }
  calculateLiquidityMint,   // (reserveA, reserveB, lpSupply, amountA, amountB) → { lpTokens, shareOfPool }
  calculateLiquidityRemove, // (reserveA, reserveB, lpSupply, lpAmount) → { amountA, amountB }
  calculateK,               // (reserveA, reserveB) → k
  validateKInvariant,       // (reserveA, reserveB, newReserveA, newReserveB) → boolean

  // Vault management
  createVault,              // (vaultId, launchId, options?) → FeeVault
  addFees,                  // (vault, feeAmount) → updatedVault
  calculateLpShare,         // (vault, lpShares) → feeAmount
  calculateOperatorShare,   // (vault) → feeAmount
  calculateProtocolShare,   // (vault) → feeAmount
  recordDistribution,       // (vault, amount, currentTime) → updatedVault
  getDistributableFees,     // (vault) → availableFees
  hasFeesToDistribute,      // (vault) → boolean
  encodeVaultData,          // (vault) → Uint8Array(192)
  decodeVaultData,          // (bytes) → FeeVault
} = require("./sdk");
```

### Bonding Curve

```javascript
const {
  // Constants
  DCURVE_DATA_SIZE,         // 256 bytes
  PRICE_MULTIPLIER_DISCOUNT, // 95 (0.95x)
  PRICE_MULTIPLIER_BASELINE, // 100 (1.0x)
  PRICE_MULTIPLIER_PREMIUM,  // 105 (1.05x)
  CURVE_STATUS_PENDING,      // 0
  CURVE_STATUS_ACTIVE,       // 1
  CURVE_STATUS_FILLED,       // 2
  CURVE_STATUS_SUCCESS,      // 3
  CURVE_STATUS_EXPIRED,      // 4
  CURVE_STATUS_REFUNDED,     // 5

  // Curve pricing
  calculateCurvePrice,       // (curve) → priceScaled (×1e12)
  calculateTokensForCkb,     // (ckbAmount, curve) → tokens
  calculateCkbForTokens,     // (tokenAmount, curve) → ckbAmount
  calculatePriceImpact,      // (ckbAmount, curve) → { priceBefore, priceAfter, impactPercent, tokensReceived }
  calculateArbitrageOpportunity, // (curveA, curveB) → { profitBps, direction, buyCurve, sellCurve }
  formatPrice,               // (priceScaled) → "0.100000"

  // Curve lifecycle
  createCurveConfig,         // (params) → DCurve
  encodeCurveData,           // (curve) → Uint8Array(256)
  decodeCurveData,           // (bytes) → DCurve
  determineCurveStatus,      // (curve, currentTime) → status
  isCurveActive,             // (curve) → boolean
  isCurveFilled,             // (curve) → boolean
  isCurveExpired,            // (curve, currentTime) → boolean
  isWithinContributionWindow, // (curve, currentTime) → boolean
} = require("./sdk");
```

### Launchpad

```javascript
const {
  // Constants
  LAUNCH_DATA_SIZE,          // 512 bytes
  STATUS_PENDING,            // 0
  STATUS_ACTIVE,             // 1
  STATUS_SUCCESS,            // 2
  STATUS_EXPIRED,            // 3
  STATUS_CANCELLED,          // 4

  // Launch config
  createLaunchConfig,        // (params, options) → LaunchConfig
  encodeLaunchConfig,        // (config) → Uint8Array(512)
  decodeLaunchConfig,        // (bytes) → LaunchConfig
  determineStatus,           // (config, currentTime) → status
  isValidTransition,         // (from, to) → boolean
  generateLaunchId,          // (creatorLockHash, bump) → "0x..."

  // Transaction builders (return unsigned tx objects)
  buildCreateLaunchTx,       // (params, options) → { outputs, outputsData, cellDeps }
  buildContributeTx,         // (curve, ckbAmount, options) → { outputs, outputsData, estimatedInputCkb, estimatedOutputTokens }
  buildFinalizeTx,           // (launchConfig, options) → { outputs, outputsData, cellDeps }
  buildClaimLpTx,            // (launchConfig, claimParams, options) → { outputs, outputsData, witnesses, cellDeps }
  buildRefundTx,             // (refundClaim, claimParams, options) → { outputs, outputsData, witnesses, cellDeps }
  buildDistributeFeesTx,     // (vault, options) → { outputs, outputsData, breakdown }
} = require("./sdk");
```

### Refund + Merkle Proofs

```javascript
const {
  // Constants
  REFUND_DATA_SIZE,          // 162 bytes
  HASH_SIZE,                 // 32 bytes
  REFUND_STATUS_PENDING,     // 0
  REFUND_STATUS_ACTIVE,      // 1
  REFUND_STATUS_COMPLETED,   // 2
  MAX_PROOF_DEPTH,           // 16 (supports 2^16 = 65,536 leaves)

  // Refund claims
  createRefundClaim,         // (params) → RefundClaim
  encodeRefundClaim,         // (claim) → Uint8Array(162)
  decodeRefundClaim,         // (bytes) → RefundClaim
  buildWitnessData,          // (leafHash, proof) → Uint8Array (witness for tx)
  determineRefundStatus,     // (claim, currentTime) → status
  isRefundActive,            // (claim, currentTime) → boolean

  // Merkle tree
  hashPair,                  // (left, right) → Uint8Array(32)
  generateMerkleRoot,        // (leaves) → Uint8Array(32)
  generateMerkleProof,       // (leaves, index) → { proof, root, index }
  verifyMerkleProof,         // (leaf, proof) → boolean
  createClaimLeaf,           // ({ address, amount, launchId }) → Uint8Array(32)
  generateBatchProofs,       // (claims) → [{ claim, proof, leaf }, ...]

  // Proof encoding (for on-chain storage)
  encodeProof,               // (proof) → Uint8Array
  decodeProof,               // (bytes) → proof object
  formatProof,               // (proof) → { root, index, proof: [{ hash, position }] }
} = require("./sdk");
```

## SDK ↔ Contract Relationship

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         OFF-CHAIN (SDK)                         │
│                                                                 │
│  1. Create config objects (LaunchConfig, DCurve, etc.)          │
│  2. Encode to bytes (encodeLaunchConfig, encodeCurveData)       │
│  3. Build transactions (buildCreateLaunchTx, buildContributeTx) │
│  4. Estimate fees (FeeEstimator)                                │
│  5. Sign and send (SimpleTxBuilder.buildAndSendWithRbfRetry)    │
│  6. Wait for confirmation (waitForTransaction)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Transaction with encoded cell data
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         ON-CHAIN (Contracts)                     │
│                                                                 │
│  1. Load cell data from output (load_cell_data)                 │
│  2. Decode bytes (LaunchConfig::from_bytes, DCurve::from_bytes) │
│  3. Validate fields (status, amounts, authorization)            │
│  4. Verify Merkle proofs (Blake2b-256)                          │
│  5. Check state transitions (PENDING → ACTIVE → SUCCESS)        │
│  6. Return SUCCESS or error code                                │
└─────────────────────────────────────────────────────────────────┘
```

### Encoding Parity

Every SDK encoding function produces bytes that the on-chain contract can decode:

```javascript
// SDK (JavaScript)
const config = createLaunchConfig({ launchId, creatorLockHash, ... });
const bytes = encodeLaunchConfig(config);  // → Uint8Array(512)

// Contract (Rust)
let data = load_cell_data(0, Source::GroupOutput);
let config = LaunchConfig::from_bytes(&data);  // ← Same 512 bytes
```

The byte layouts are **identical** — same offsets, same field sizes, same endianness (little-endian for integers).

### What the SDK Does That Contracts Don't

| SDK Feature | Why Not On-Chain |
|-------------|-----------------|
| **Fee estimation** | Requires network state, not available in scripts |
| **RBF retry logic** | Requires mempool visibility, not available in scripts |
| **Transaction building** | Contracts validate, they don't construct transactions |
| **Merkle tree generation** | Contracts only verify proofs; SDK builds the trees |
| **Bonding curve pricing** | Contracts validate state; SDK calculates prices for UI |
| **Arbitrage detection** | Off-chain analysis comparing multiple curves |
| **UTXO selection** | Requires wallet state, not available in scripts |

### What the Contracts Do That SDK Doesn't

| Contract Feature | Why Not SDK |
|-----------------|-------------|
| **Signature verification** | CKB lock scripts handle this at the VM level |
| **State transition enforcement** | Only the contract can reject invalid transitions |
| **Capacity constraints** | Only the contract can verify on-chain reserves |
| **Merkle proof verification** | Contract verifies; SDK generates |
| **Fee collection** | Contract enforces fee splits; SDK calculates them |

## Module Structure

```
sdk/
├── index.js              — Main entry point, re-exports all modules
├── fee.js                — FeeEstimator (RBF-aware)
├── txbuilder.js          — SimpleTxBuilder, SimpleClient, capacity calculation
├── factory.js            — Factory + DEX encoding/decoding, fee calculations
├── pool.js               — AMM math + FeeVault management
├── curve.js              — Bonding curve pricing + lifecycle
├── launchpad.js          — Launch config + transaction builders
├── refund.js             — Refund claims + Merkle proof witnesses
├── proof.js              — Backward-compat re-export of merkle.js
├── modules/
│   ├── crypto.js         — SHA256 hashing, ID generation (launchId, dexId, curveId)
│   └── merkle.js         — Blake2b Merkle trees (single source of truth)
└── tests/
    ├── test.js           — FeeEstimator + SimpleTxBuilder tests
    └── test-capacity-calculation.js — Cell capacity calculation tests
```

## Usage Patterns

### 1. Create a Token Launch

```javascript
const { createLaunchConfig, encodeLaunchConfig, buildCreateLaunchTx, SimpleTxBuilder } = require("./sdk");

// 1. Create config
const config = createLaunchConfig({
  launchId: "0x...",
  creatorLockHash: "0x...",
  tokenTypeHash: "0x...",
  tokenName: "MyToken",
  tokenSymbol: "MTK",
  totalSupply: 1000000000000000n,
  targetCkb: 100000000000n,    // 1,000 CKB
  maxCkb: 200000000000n,       // 2,000 CKB
  startTime: BigInt(now + 60),
  endTime: BigInt(now + 3600),
  dexScriptHash: "0x...",
}, {
  registryEntryHash: "0x...",
  stakeCkb: 10000000000n,
  feeBps: 30,
});

// 2. Encode for on-chain
const dataHex = ccc.hexFrom(encodeLaunchConfig(config));

// 3. Build and send
const txBuilder = new SimpleTxBuilder(rpcUrl, secpOpts);
const { txHash } = await txBuilder.buildAndSendWithRbfRetry(
  [{ lock: lockScript, capacity: cellCapacity }],
  [dataHex],
  privateKey,
  3000
);

// 4. Wait for confirmation
await txBuilder.waitForTransaction(txHash);
```

### 2. Contribute to a Bonding Curve

```javascript
const { calculateTokensForCkb, encodeCurveData, buildContributeTx } = require("./sdk");

// 1. Calculate tokens to receive
const tokens = calculateTokensForCkb(contributionCkb, curve);

// 2. Build contribution transaction
const tx = buildContributeTx(curve, contributionCkb, {
  lockScriptHash: "0x...",
  cellDeps: [],
});

// 3. Send
const { txHash } = await txBuilder.buildAndSendWithRbfRetry(
  tx.outputs, tx.outputsData, privateKey, 3000
);
```

### 3. Generate Merkle Proofs for LP Claims

```javascript
const { generateBatchProofs, createClaimLeaf } = require("./sdk");

// 1. Build claims from contribution receipts
const claims = receipts.map(r => ({
  address: r.contributor,
  amount: BigInt(r.contributedCkb),
  launchId: r.launchId,
}));

// 2. Generate proofs for all claimants
const batchProofs = generateBatchProofs(claims);

// 3. Each claimant gets their proof
for (const { claim, proof, leaf } of batchProofs) {
  // proof can be used to build witness data for claim transaction
}
```

### 4. Track Arbitrage Opportunities

```javascript
const { calculateArbitrageOpportunity, formatPrice } = require("./sdk");

// Compare two curves
const opp = calculateArbitrageOpportunity(curveA, curveB);

if (opp.profitBps > 50n) { // > 0.5% profit
  console.log(`Arbitrage: ${opp.direction} at ${Number(opp.profitBps)/100}% profit`);
  console.log(`Buy on: ${opp.direction.includes("A") ? "Curve A" : "Curve B"}`);
  console.log(`Sell on: ${opp.direction.includes("A") ? "Curve B" : "Curve A"}`);
}
```

## Testing

```bash
# Test fee estimator and tx builder
node sdk/tests/test.js

# Test capacity calculation
node sdk/tests/test-capacity-calculation.js
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@ckb-ccc/core` | — | CKB client, signing, serialization |
| `@noble/hashes` | — | Blake2b for Merkle proofs |
| `crypto` (Node.js) | built-in | SHA256 for ID generation |
