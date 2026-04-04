# Auto — Protocol Automation CLI

## Overview

The `auto/` directory contains **interactive CLI modules** that exercise the full ATHEON protocol on a running devnet. Think of it as the **user-facing layer** — where DEX operators create exchanges, contributors fund launches, and LPs claim their tokens.

Unlike the `build/` scripts (which set up infrastructure), the `auto/` modules **interact with deployed contracts** to perform real protocol operations.

## Quick Start

```bash
# Full protocol initialization: factory → DEX → registry → pool → launch → contribute → arbitrage
node auto/main.js

# Individual operations:
node auto/modules/launchpad.js    # Create a new token launch
node auto/modules/contribute.js   # Contribute CKB to a bonding curve
node auto/modules/claim.js        # Claim LP tokens after successful launch
node auto/modules/refund.js       # Claim refund for failed launch
node auto/modules/arb.js          # Track arbitrage opportunities
```

## Entry Point: `main.js`

The main orchestrator runs through the **complete protocol lifecycle**:

```
Step 1: Initialize Factory    → Sets up the DEX factory (if not already done)
Step 2: Create DEX Instance   → Creates a new DEX with name, fees, owner
Step 3: Register DEX          → Registers the DEX with the registry
Step 4: Create Pool           → Creates an AMM pool under the DEX
Step 5: Create Token Launch   → Creates a bonding curve token launch
Step 6: Contribute            → Contributes CKB to the bonding curve
Step 7: Track Arbitrage       → Scans for price differences across curves
```

Each step is **idempotent** — if something is already initialized, it skips it. Steps that fail are caught and reported without stopping the entire flow.

## Modules

### `modules/launchpad.js` — Token Launches

Creates and validates token launches with bonding curves.

**Operations:**
- **`createLaunch(options)`** — Creates a new launch on-chain with full config
- **`testSdkEncoding()`** — Tests SDK encoding/decoding roundtrips (launch config, curve data, refund claims, Merkle proofs, fee vaults)

**What it does:**
1. Gets the launchpad contract's type script hash from deployment info
2. Computes the creator's lock script hash using Molecule serialization
3. Generates a unique launch ID from creator hash + timestamp
4. Creates a launch config using the SDK (`createLaunchConfig`)
5. Encodes it for on-chain storage (`encodeLaunchConfig`)
6. Builds and sends a transaction with RBF retry
7. Waits for on-chain confirmation

**Usage:**
```javascript
const launchpad = require("./modules/launchpad");

const result = await launchpad.createLaunch({
  tokenName: "MyToken",
  tokenSymbol: "MTK",
  totalSupply: 1000000000000000n,
  targetCkb: 100000000000n,    // 1,000 CKB soft cap
  maxCkb: 200000000000n,       // 2,000 CKB hard cap
  priceMultiplierBps: 100,     // 1.0x baseline
});
// Returns: { launchId, txHash, config, creatorLockHash }
```

### `modules/contribute.js` — Bonding Curve Contributions

Contributes CKB to a bonding curve and creates a curve cell on-chain.

**What it does:**
1. Attempts to fetch existing curve data from chain
2. If not found, uses provided curve parameters
3. Calculates tokens to receive based on current curve price
4. Creates a curve cell with 256 bytes of encoded curve data
5. Sends the contribution transaction with RBF retry
6. Saves a contribution receipt for later LP claims

**Usage:**
```javascript
const contribute = require("./modules/contribute");

const result = await contribute.contributeToCurve({
  curveId: "0x...",
  launchId: "0x...",
  contributionCkb: 10000000000n,  // 100 CKB
});
// Returns: { txHash, tokensReceived, curveId, launchId }
```

### `modules/claim.js` — LP Token Claims

Claims LP tokens after a successful launch using Merkle proofs.

**What it does:**
1. Fetches launch status from on-chain (verifies launch was successful)
2. Finds contribution receipts for the user
3. Calculates total LP tokens to claim
4. Builds a claim transaction with the pool's type script
5. Sends with RBF retry and waits for confirmation

**On-chain verification:** Before claiming, the module fetches the launch config from chain and verifies `status == STATUS_SUCCESS`. If the launch failed or expired, the claim is rejected.

### `modules/refund.js` — Refund Claims

Claims refunds for failed (expired/cancelled) launches.

**What it does:**
1. Fetches launch status from on-chain (verifies launch failed)
2. Checks for on-chain refund claim and its status
3. Finds contribution receipts for the user
4. Generates Merkle proofs for each receipt
5. Builds refund transaction with proper SDK encoding
6. Sends with RBF retry and waits for confirmation

**On-chain verification:** Verifies the launch is `STATUS_EXPIRED` or `STATUS_CANCELLED` before allowing refunds. Also checks if the refund claim on-chain is active and has remaining claims to process.

### `modules/arb.js` — Arbitrage Tracker

Scans on-chain cells for active bonding curves and identifies price differences.

**What it does:**
1. Scans the contributor's address for cells with 256-byte data
2. Decodes each cell as potential curve data
3. Filters curves by launch ID and active status
4. Calculates current prices for each curve
5. Compares all curve pairs for arbitrage opportunities
6. Reports opportunities with >0.5% profit (after fees)

**Search strategy:** Uses address-based scanning — it reads the genesis wallet's pubKeyHash and searches all cells owned by that address, filtering by data size (256 bytes = curve cell format).

### `modules/factory.js` — Factory Initialization

Initializes the DEX factory contract with owner, fee settings, and creation fee.

**Features:**
- Checks if factory is already initialized (skips if done)
- Verifies initialization by querying on-chain cells
- Uses RBF-aware fee estimation and retry logic

### `modules/dex.js` — DEX Creation

Creates a new DEX instance under the factory.

**Features:**
- Generates unique DEX ID from factory hash + owner hash + bump
- Computes description hash via blake2b of DEX name
- Validates DEX script exists before creation
- Saves DEX info to `deployments/dex-<id>.json`

### `modules/pool.js` — Pool Initialization

Creates an AMM pool under the factory.

**Features:**
- Finds the factory cell on-chain
- Generates unique pool ID from factory hash + owner hash + bump
- Uses RBF-aware fee estimation
- Waits for on-chain confirmation

### `modules/registry.js` — Registry Initialization

Initializes the DEX registry with fee settings and activity requirements.

**Features:**
- Checks if already initialized (skips if done)
- Configures creation fee, reservation fee, launch fees
- Sets activity check periods and minimum trade requirements

### `modules/fhash.js` — Factory Hash Utility

Simple utility to display the factory contract's script hash.

```bash
node auto/modules/fhash.js
```

## Utilities

### `utils/cli-helpers.js` — Shared CLI Utilities

Centralized utilities used across all auto modules:

```javascript
const {
  colors,                    // ANSI color codes
  log,                       // Colored logging
  rpcRequest,                // Raw JSON-RPC calls to CKB node
  getDeploymentInfo,         // Load deployments JSON
  getContractInfo,           // Get specific contract deployment info
  getFactoryScriptHash,      // Get factory type script hash
  displayFactoryHash,        // Formatted factory hash display
  findContributionReceipts,  // Find receipt files for a user/launch
  saveContributionReceipt,   // Save a contribution receipt
  getSecpCellDepTxHash,      // Get secp cell dep tx hash for network
  getSecpCodeHash,           // Get secp code hash for network
  getSecpHashType,           // Get secp hash type for network
  getSecpTxOptions,          // Full secp config for SimpleTxBuilder
} = require("./utils/cli-helpers");
```

### `utils/pending.js` — Pending Transaction Checker

Displays transactions in the mempool that might cause RBF conflicts:

```bash
node auto/utils/pending.js
```

Shows:
- Number of pending transactions
- Each pending tx's hash, fee, size, fee rate
- Input/output details
- RBF warning with minimum required fee rate

## Diagnosis Tools

The `diagnosis/` directory contains debugging utilities:

| Script | Purpose |
|--------|---------|
| `diagnose-curves.js` | Scans on-chain cells for curve data, decodes and displays curve state |
| `trace-rbf.js` | Traces RBF detection logic, shows why fee increases are triggered |
| `debug-tx.js` | Tests transaction building with snake_case format verification |
| `debug-utxo.js` | Debugs UTXO discovery with multiple script format variations |

## Architecture

```
auto/
├── main.js                 — Full protocol lifecycle orchestrator
├── modules/
│   ├── launchpad.js        — Token launch creation + SDK encoding tests
│   ├── contribute.js       — Bonding curve contributions
│   ├── claim.js            — LP token claims (with on-chain status check)
│   ├── refund.js           — Refund claims (with on-chain status check)
│   ├── arb.js              — Arbitrage opportunity detection
│   ├── factory.js          — Factory initialization
│   ├── dex.js              — DEX instance creation
│   ├── pool.js             — Pool initialization
│   ├── registry.js         — Registry initialization
│   └── fhash.js            — Factory hash display
├── utils/
│   ├── cli-helpers.js      — Shared CLI utilities
│   └── pending.js          — Pending transaction checker
└── diagnosis/
    ├── diagnose-curves.js  — Curve cell scanner
    ├── trace-rbf.js        — RBF detection tracer
    ├── debug-tx.js         — Transaction format debugger
    └── debug-utxo.js       — UTXO discovery debugger
```

## Data Flow

```
User runs: node auto/main.js
    │
    ├── main.js orchestrates steps
    │
    ├── Each module (launchpad.js, contribute.js, etc.)
    │   ├── Uses SDK to build transactions (encode, calculate, build)
    │   ├── Uses SimpleTxBuilder to sign and send
    │   ├── Uses waitForTransaction to confirm on-chain
    │   └── Saves results to deployments/ directory
    │
    ├── cli-helpers.js provides
    │   ├── RPC communication with devnet
    │   ├── Deployment info loading
    │   └── Receipt file management
    │
    └── On-chain contracts validate
        ├── Data format (byte size, field values)
        ├── State transitions (PENDING → ACTIVE → SUCCESS)
        ├── Authorization (signature verification)
        └── Cryptographic proofs (Merkle proofs for claims/refunds)
```

## Key Design Decisions

### 1. Confirmation Waiting

All modules use `txBuilder.waitForTransaction(txHash)` instead of fixed delays. This polls the `get_transaction` RPC until the transaction status is `committed`, ensuring each step completes before the next begins — preventing RBF conflicts.

### 2. On-Chain Status Verification

The `claim.js` and `refund.js` modules fetch launch/refund state from on-chain cells before proceeding. This prevents invalid operations (claiming LP tokens for a failed launch, or refunding a successful one).

### 3. Address-Based Curve Scanning

The arbitrage tracker scans cells by contributor address rather than by type script. This works because curve cells use the contributor's lock script (not a special curve type script), and are identified by their 256-byte data format.

### 4. Receipt File System

Contribution receipts are saved as JSON files in `deployments/contribution-<txHash>.json`. These are used later by `claim.js` and `refund.js` to find a user's contributions and generate Merkle proofs.

## Environment Variables

Required in `.env`:

```
CKB_RPC_URL=http://127.0.0.1:8114
CKB_GENESIS_PRIVKEY_0=0x...    # Genesis wallet private key
DEX_NAME=MyDEX                  # Name for the DEX instance (optional, default: MyDEX)
```

## Typical Workflow

```bash
# 1. Set up devnet and deploy contracts
node build/main.js

# 2. Run full protocol initialization
node auto/main.js

# 3. Create another launch
node auto/modules/launchpad.js

# 4. Contribute to it
node auto/modules/contribute.js

# 5. After launch succeeds, claim LP tokens
node auto/modules/claim.js

# 6. Check for arbitrage
node auto/modules/arb.js

# 7. If launch fails, claim refund
node auto/modules/refund.js
```
