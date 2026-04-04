# Build Scripts

## Overview

The `build/` directory contains **infrastructure scripts** for setting up the local CKB devnet, deploying contracts, and managing wallets. These scripts are the **foundation layer** that everything else depends on — without them, there's no running chain to interact with.

## Quick Start

```bash
# Full setup: start devnet + create wallets + fund + deploy all contracts
node build/main.js

# Just start devnet + wallets + funding (no contract deployment)
node build/setup.js

# Just deploy contracts (assumes devnet is already running)
node build/deploy.js
```

## Scripts

### `main.js` — Full Devnet Setup

The **one-command setup**. Performs all steps in sequence:

1. **Stops** any existing devnet processes
2. **Starts** a fresh CKB devnet using `offckb`
3. **Waits** for RPC to become available (up to 30 seconds)
4. **Creates** 4 deterministic wallets (genesis, alice, bob, charlie)
5. **Funds** each wallet with the configured amount (default: 10,000 CKB)
6. **Deploys** all 5 contracts (factory, pool, registry, dex, launchpad)
7. **Saves** deployment info to `deployments/devnet-deployments.json`
8. **Keeps running** — press Ctrl+C to stop

This is the script you run when you want a **fresh environment from scratch**.

### `setup.js` — Devnet + Wallets Only

Sets up the devnet and wallets **without deploying contracts**:

1. Stops existing devnet
2. Starts fresh devnet
3. Creates 4 wallets
4. Funds wallets
5. Keeps running

Use this when you want to **manually deploy contracts later** or test the devnet/wallet setup independently.

### `deploy.js` — Contract Deployment Only

Deploys all contracts to an **already-running devnet**:

1. Checks if devnet is running (starts it if not)
2. Loads existing wallets
3. Checks wallet balances (funds if needed)
4. Deploys all 5 contracts using the genesis wallet
5. Saves deployment info and exits

Use this when the devnet is already running but contracts need to be (re)deployed.

### `deploy-registry.js` — Registry Contract Only

Standalone script to deploy **only the registry contract**. Used when:
- The registry contract was updated and needs redeployment
- Other contracts are already deployed but registry is missing
- Testing registry-specific functionality

### `devnet.js` — Devnet Management Utilities

Helper module used by the scripts above. Provides:

```javascript
const devnet = require("./modules/devnet");

// Start the devnet (spawns offckb process)
await devnet.start();

// Stop the devnet (kills process)
devnet.stop();

// Wait for RPC to become available (returns true/false)
const ready = await devnet.waitForRPC(30); // 30 second timeout

// Get the RPC URL
const url = devnet.getRPCUrl(); // "http://127.0.0.1:8114"

// Check if RPC is responding
const running = await devnet.checkRPC();

// Sleep utility
await devnet.sleep(2000); // 2 seconds
```

### `modules/wallets.js` — Wallet Management

Creates and manages deterministic wallets for the devnet:

```javascript
const wallets = require("./modules/wallets");

// Get or create 4 wallets (deterministic from seed)
const allWallets = wallets.getOrCreateWallets(4);
// Returns: [{ label, address, privateKey, argsHash }, ...]

// Wallet labels: "genesis", "alice", "bob", "charlie"
// Funding amount: 10,000 CKB per wallet (configurable)
```

Wallets are stored in `deployments/devnet-wallets/wallets.json` and reused across runs.

### `modules/faucet.js` — Wallet Funding

Funds wallets using the genesis account:

```javascript
const faucet = require("./modules/faucet");

// Fund multiple wallets
const results = await faucet.fundWallets(wallets, BigInt(10000 * 1e8));
// Returns: [{ label, success, balance, error? }, ...]

// Check if wallets have sufficient balance
const status = await faucet.checkWalletsFunded(wallets);
// Returns: [{ label, balance, isFunded }, ...]
```

The faucet uses the **genesis wallet** (the one that mines blocks) to send CKB to other wallets.

### `modules/deployer.js` — Contract Deployment

Deploys contract binaries to the devnet:

```javascript
const deployer = require("./modules/deployer");

// Deploy all contracts
const results = await deployer.deployAllContracts(genesisWallet);
// Returns: [{ contractName, success, binaryHash, txHash, error? }, ...]

// Save deployment info
const info = deployer.saveDeploymentInfo(results, "devnet");
// Saves to: deployments/devnet-deployments.json

// Load deployment info
const info = deployer.loadDeploymentInfo("devnet");
// Returns: { network, deployedAt, contracts: { factory, pool, ... } }
```

### `devnet.js` (root) — Block Assembler Configuration

Configures the devnet's block assembler to use the genesis wallet's key, ensuring that mined blocks go to the correct account:

```javascript
const { configureBlockAssembler } = require("./devnet");
const result = configureBlockAssembler();
// Updates ~/.ckb-devnet/ckb.toml with the correct args hash
```

## Module Structure

```
build/
├── main.js              — Full setup (devnet + wallets + fund + deploy)
├── setup.js             — Devnet + wallets + funding (no deploy)
├── deploy.js            — Contract deployment only
├── deploy-registry.js   — Registry contract only
├── devnet.js            — Block assembler configuration
└── modules/
    ├── devnet.js        — Devnet lifecycle (start/stop/wait)
    ├── wallets.js       — Wallet creation and management
    ├── faucet.js        — Wallet funding from genesis account
    └── deployer.js      — Contract binary deployment
```

## Deployment Output

After successful deployment, `deployments/devnet-deployments.json` contains:

```json
{
  "network": "devnet",
  "deployedAt": "2026-04-02T19:26:04.941Z",
  "systemScripts": {
    "secp256k1CodeHash": "0x9bd7e06f...",
    "anyoneCanPayCodeHash": "0x3419a1c0...",
    "nervosDaoCodeHash": "0x82d76d1b...",
    "depGroupTxHash": "0x4d804f14..."
  },
  "contracts": {
    "factory": {
      "binaryHash": "0x4c83312e...",
      "deploymentTxHash": "0xd98e84f0...",
      "typeScript": { "codeHash": "0x4c83312e...", "hashType": "type" }
    },
    "pool": { ... },
    "registry": { ... },
    "dex": { ... },
    "launchpad": { ... }
  }
}
```

This file is **read by the SDK** (`getDeploymentInfo()`) and the **auto modules** (`getContractInfo()`) to get contract addresses and type scripts.

## Contract Build Process

Before deployment, contracts must be compiled to RISC-V binaries:

```bash
# Build all contracts
cd contracts/factory && cargo build --release --target riscv64imac-unknown-none-elf
cd contracts/dex && cargo build --release --target riscv64imac-unknown-none-elf
cd contracts/pool && cargo build --release --target riscv64imac-unknown-none-elf
cd contracts/registry && cargo build --release --target riscv64imac-unknown-none-elf
cd contracts/launchpad && cargo build --release --target riscv64imac-unknown-none-elf
```

The deployer looks for binaries at:
```
contracts/<name>/target/riscv64imac-unknown-none-elf/release/<binary-name>
```

## Dependencies

| Tool | Purpose |
|------|---------|
| `offckb` | CKB devnet manager (starts/stops the local chain) |
| `@ckb-ccc/core` | Transaction construction and signing |
| `dotenv` | Environment variable loading from `.env` |

## Environment Variables

Required in `.env`:

```
CKB_RPC_URL=http://127.0.0.1:8114
CKB_GENESIS_PRIVKEY_0=0x...    # Genesis wallet private key
```

## Typical Workflow

```
1. First time setup:
   node build/main.js          # Everything from scratch

2. After contract code changes:
   cd contracts/factory && cargo build --release ...
   node build/deploy.js        # Redeploy contracts

3. After restarting machine:
   node build/setup.js         # Just restart devnet

4. Check status:
   curl -X POST http://127.0.0.1:8114 -H "Content-Type: application/json" \
     -d '{"id":1,"jsonrpc":"2.0","method":"get_tip_block_number","params":[]}'
```
