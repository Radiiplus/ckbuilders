# 📊 Builder Track Weekly Report — Week 2 (In Progress)

> **Tracking progress in the CKB Academy Builder Program**

---

<table>
  <tr>
    <td>👤 <b>Name:</b></td>
    <td>Positive Vibes</td>
  </tr>
  <tr>
    <td>📅 <b>Week Ending:</b></td>
    <td>April 4, 2026</td>
  </tr>
  <tr>
    <td>🎯 <b>Track:</b></td>
    <td>CKB Developer Builder</td>
  </tr>
  <tr>
    <td>📌 <b>Status:</b></td>
    <td>Week 2 — Halfway Through</td>
  </tr>
</table>

---

## 📚 Courses Completed

```
Progress: ████████░░░░░░░░░░░░ 40%
          Summary 1 ✅  →  Summary 2 🔄
```

| Status | Module | Topics |
|--------|--------|--------|
| ✅ | **Summary 1** | CKB architecture, cell model, transaction structure |
| 🔄 | **Summary 2** | _Still In Progress_ |

### Key Topics Covered
- 🧱 Nervos CKB architecture and cell model
- 📦 Transaction structure and validation
- 🔐 Lock scripts and type scripts
- 🪙 xUDT token standard

---

## 💡 Key Learnings

<details>
<summary><b>🔗 SDK ↔ Contract Parity</b> — Click to expand</summary>

> Every struct encoded by the off-chain SDK must match the on-chain contract's byte layout exactly — same offsets, same field sizes, same endianness. This ensures that data prepared off-chain can be decoded and validated on-chain without ambiguity.
</details>

<details>
<summary><b>🌊 RBF Fee Replacement</b> — Click to expand</summary>

> CKB supports Replace-By-Fee (RBF) for stuck transactions. The SDK's FeeEstimator detects pending transactions and automatically increases the fee rate (default 1.5x multiplier) to ensure confirmation. This is critical for reliable protocol operations.
</details>

<details>
<summary><b>🔐 Merkle Proof Refunds</b> — Click to expand</summary>

> Failed launches use Merkle trees for refund claims. The SDK generates the tree and proofs off-chain; the contract verifies proofs on-chain. This design keeps refund data compact on-chain while supporting up to 65,536 contributors (2^16 leaves).
</details>

---

## 🛠️ Practical Progress

### Project: ATHEON Protocol

> **A decentralized token launchpad with automatic DEX deployment on Nervos CKB**

```
┌─────────────────────────────────────────────────────────────┐
│  🚀 Launchpad → 💰 Bonding Curve → 🤖 Auto-Deploy → 📈 DEX │
└─────────────────────────────────────────────────────────────┘
```

### ✅ Week 2 Achievements (So Far)

#### Documentation
- [x] Rewrote root README as aggregate of all component READMEs
- [x] Added "How Everyone Profits" section showing value for all stakeholders
- [x] Individual READMEs in place for contracts/, sdk/, build/, auto/

#### Code Cleanup
- [x] Removed all comments from 61 source files (39 JS + 22 Rust)
- [x] Pruned 13 unused npm dependencies from package.json
- [x] Cleaned .env.example — removed all comment lines
- [x] Added local clone directories to `.gitignore` (lumos, offckb, ccc-repo, ckb-testtool)

### 📦 Complete Project State

#### ✅ Smart Contracts — All 5 Complete
```
contracts/
├── factory/    🏭 DEX Factory
├── pool/       🔄 DEX Pool (x*y=k AMM)
├── registry/   📋 DEX Registry
├── dex/        🏪 DEX Instance
└── launchpad/  🚀 Token Launchpad (bonding curve + refunds)
```

#### ✅ JavaScript SDK — Full Protocol Library
| Module | Purpose |
|--------|---------|
| `sdk/factory.js` | Factory + DEX encoding/decoding, fee calculations |
| `sdk/pool.js` | AMM math, LP token minting/burning, fee vault |
| `sdk/curve.js` | Bonding curve pricing, status lifecycle |
| `sdk/launchpad.js` | Launch config creation, transaction builders |
| `sdk/refund.js` | Refund claims, Merkle proof witnesses |
| `sdk/fee.js` | RBF-aware fee estimation |
| `sdk/txbuilder.js` | Transaction construction + signing |
| `sdk/modules/merkle.js` | Blake2b Merkle tree generation/verification |
| `sdk/modules/crypto.js` | SHA256 hashing, ID generation |

#### ✅ Devnet Infrastructure
- [x] Automated devnet setup (`build/main.js`)
- [x] Multi-wallet management (genesis, alice, bob, charlie)
- [x] Faucet for funding test accounts
- [x] Contract deployment pipeline (`build/deploy.js`)

#### ✅ Protocol Automation CLI — Tested & Working
- [x] Full lifecycle orchestrator (`auto/main.js`)
- [x] Token launch creation, contributions, LP claims, refunds
- [x] Arbitrage opportunity tracker
- [x] Diagnosis tools (curve scanner, RBF tracer, UTXO debugger)

#### 🌐 Repository
- ✅ **Live on GitHub:** https://github.com/Radiiplus/ckbuilders

---

## 🖥️ Environment Setup

| Tool | Status | Notes |
|------|--------|-------|
| **CKB Devnet** | 🟢 Running | Automated via `offckb` |
| **Rust & Cargo** | 🟢 Installed | RISC-V target configured |
| **Node.js** | 🟢 Installed | 3 dependencies only (cleaned) |
| **CLI Tools** | 🟢 Integrated | offckb, CCC SDK, ckb-testtool |

---

## 🎯 What's Left

```
Remaining:
┌─────────────────────────────────────────────────────────────┐
│  1. 🎨 Build the UI for the ATHEON protocol                │
│  2. 📚 Complete Summary 2 (CKB Academy)                    │
└─────────────────────────────────────────────────────────────┘
```

| # | Goal | Priority | Status |
|---|------|----------|--------|
| 1 | Build UI | 🔴 High | ⏳ Next |
| 2 | Complete Summary 2 | 🟡 Medium | ⏳ Pending |

**Everything backend is done — contracts, SDK, devnet, CLI, testing. The UI is the last piece.**

---

## 📈 Progress Summary

| Category | Completion |
|----------|------------|
| Coursework | 40% |
| Project Setup | 100% |
| Contract Dev | 100% |
| SDK Development | 100% |
| Testing | 100% |
| Documentation | 100% |
| UI / Frontend | 0% |

**Overall Week 2 (Halfway): ✅ Backend Complete — UI is the last piece**

---

*Report generated for CKB Academy Builder Track*
