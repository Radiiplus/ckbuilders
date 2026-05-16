# 📊 Builder Track Weekly Report — Week 1

> **Tracking progress in the CKB Academy Builder Program**

---

<table>
  <tr>
    <td>👤 <b>Name:</b></td>
    <td>Positive Vibes</td>
  </tr>
  <tr>
    <td>📅 <b>Week Ending:</b></td>
    <td>April 1, 2026</td>
  </tr>
  <tr>
    <td>🎯 <b>Track:</b></td>
    <td>CKB Developer Builder</td>
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
| 🔄 | **Summary 2** | _In Progress_ |

### Key Topics Covered
- 🧱 Nervos CKB architecture and cell model
- 📦 Transaction structure and validation
- 🔐 Lock scripts and type scripts
- 🪙 xUDT token standard

---

## 💡 Key Learnings

<details>
<summary><b>📖 Cell Model</b> — Click to expand</summary>

> Understanding how CKB's cell-based storage differs from account-based models like Ethereum. Cells are the fundamental storage unit, similar to UTXOs but more flexible.
</details>

<details>
<summary><b>🔄 Transaction Flow</b> — Click to expand</summary>

> How inputs, outputs, and witnesses work together in CKB transactions. The separation of lock and type scripts enables powerful validation logic.
</details>

<details>
<summary><b>🔧 Script System</b> — Click to expand</summary>

> The role of lock scripts (ownership) vs type scripts (validation logic). This separation is key to CKB's flexibility.
</details>

<details>
<summary><b>⚙️ Development Workflow</b> — Click to expand</summary>

> How to set up devnet, deploy contracts, and interact with the chain using CLI tools and SDKs.
</details>

---

## 🛠️ Practical Progress

### Project: Ohrex Protocol

> **A decentralized token launchpad with automatic DEX deployment on Nervos CKB**

```
┌─────────────────────────────────────────────────────────────┐
│  🚀 Launchpad → 💰 Bonding Curve → 🤖 Auto-Deploy → 📈 DEX │
└─────────────────────────────────────────────────────────────┘
```

#### ✅ Devnet Infrastructure
- [x] Automated devnet setup scripts
- [x] Multi-wallet management system  
- [x] Faucet for funding test accounts

#### 📁 Smart Contract Structure
```
contracts/
├── factory/    🏭 DEX Factory
├── pool/       🔄 DEX Pool (x*y=k AMM)
└── registry/   📋 DEX Registry
```
- [x] Rust project structure for RISC-V compilation
- [ ] Contract implementation (in progress)

#### 💻 TypeScript SDK
| File | Purpose |
|------|---------|
| `sdk/dex.ts` | Pool utilities (swap calc, LP math) |
| `sdk/factory.ts` | Factory client with tx building |

#### 📚 Documentation
- [x] Protocol specifications (3 components)
- [x] Architecture diagrams
- [x] Project README

#### 🌐 Repository
- ✅ **Live on GitHub:** https://github.com/Radiiplus/ckbuilders

---

## 🖥️ Environment Setup

| Tool | Status | Notes |
|------|--------|-------|
| **CKB Devnet** | 🟢 Running | Local node with automated scripts |
| **Rust & Cargo** | 🟢 Installed | Configured for RISC-V target |
| **Node.js** | 🟢 Installed | Development environment ready |
| **CLI Tools** | 🟢 Integrated | offckb, CCC SDK in build scripts |

---

## 🎯 Next Week Goals

```
Priority Queue:
┌─────────────────────────────────────────────────────────────┐
│  1. 📚 Complete Summary 2 (CKB Academy)                    │
│  2. 🦀 Implement DEX Pool contract (x*y=k AMM)             │
│  3. ✅ Write unit tests for pool operations                │
│  4. 🏗️ Begin DEX Registry contract structure               │
└─────────────────────────────────────────────────────────────┘
```

| # | Goal | Priority | Status |
|---|------|----------|--------|
| 1 | Complete Summary 2 | 🔴 High | ⏳ Pending |
| 2 | DEX Pool contract | 🔴 High | ⏳ Pending |
| 3 | Unit tests | 🟡 Medium | ⏳ Pending |
| 4 | DEX Registry start | 🟡 Medium | ⏳ Pending |

---

## 📈 Progress Summary

| Category | Completion |
|----------|------------|
| Coursework | 40% |
| Project Setup | 80% |
| Contract Dev | 20% |
| Documentation | 100% |

**Overall Week 1: 🎯 On Track**

---

*Report generated for CKB Academy Builder Track*
