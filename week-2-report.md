# 📊 Builder Track Weekly Report — Week 2

> **Tracking progress in the CKB Academy Builder Program**

---

<table>
  <tr>
    <td>👤 <b>Name:</b></td>
    <td>Positive Vibes</td>
  </tr>
  <tr>
    <td>📅 <b>Week Ending:</b></td>
    <td>April 12, 2026</td>
  </tr>
  <tr>
    <td>🎯 <b>Track:</b></td>
    <td>CKB Developer Builder</td>
  </tr>
  <tr>
    <td>📌 <b>Status:</b></td>
    <td>Week 2 — Complete ✅</td>
  </tr>
</table>

---

## 📚 Courses Completed

```
Progress: ████████████████████ 100%
          Summary 1 ✅  →  Summary 2 ✅
```

| Status | Module | Topics |
|--------|--------|--------|
| ✅ | **Summary 1** | CKB architecture, cell model, transaction structure |
| ✅ | **Summary 2** | Lock scripts, type scripts, xUDT, contract development |

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

### Project: Ohrex Protocol

> **A decentralized token launchpad with automatic DEX deployment on Nervos CKB**

```
┌─────────────────────────────────────────────────────────────┐
│  🚀 Launchpad → 💰 Bonding Curve → 🤖 Auto-Deploy → 📈 DEX │
└─────────────────────────────────────────────────────────────┘
```

### ✅ Week 2 Achievements

#### Documentation
- [x] Rewrote root README as aggregate of all component READMEs
- [x] Added "How Everyone Profits" section showing value for all stakeholders
- [x] Individual READMEs in place for contracts/, sdk/, build/, auto/

#### Vault Contract — Type Script Execution Debugging
- [x] Built vault binary with page-aligned sections (4KB boundaries)
- [x] Configured CKB2023 hardfork on devnet (CKB-VM v2)
- [x] Discovered other contracts (factory, pool, dex, launchpad, registry) work because they are **data-only cells** — no type script execution
- [x] Vault is the **first contract designed to execute as a type script** on-chain
- [x] Identified root cause: `.rodata` section has `W` (writable) flag in compiled `ckb-std 1.1.0` binaries, triggering `MemWriteOnExecutablePage` on CKB-VM v2
- [x] Confirmed minimal contracts (no `ckb-std`) execute successfully
- [x] Filed GitHub issue on [nervosnetwork/ckb-std](https://github.com/nervosnetwork/ckb-std)

## 🎯 What's Left

```
Remaining:
┌─────────────────────────────────────────────────────────────┐
│  1. ⏳ Await ckb-std fix for .rodata W flag issue          │
│     → Frontend is built, only contract integration blocked │
└─────────────────────────────────────────────────────────────┘
```

| # | Goal | Priority | Status |
|---|------|----------|--------|
| 1 | ckb-std fix for type script execution | 🔴 High | ⏳ Awaiting response from Nervos team |

---

## 📈 Progress Summary

| Category | Completion |
|----------|------------|
| Coursework | 100% |
| Project Setup | 100% |
| Contract Dev | 100% |
| SDK Development | 100% |
| Testing | 100% |
| Documentation | 100% |
| UI / Frontend | 100% |
| Type Script Integration | ⚠️ Blocked by ckb-std issue |

**Overall Week 2: ✅ Everything Complete — Coursework done, frontend built, backend fully operational. Only blocker is upstream `ckb-std` bug preventing on-chain type script execution.**

---

## 🐛 GitHub Issue Filed

**Issue:** `.rodata` section has writable (`W`) flag causing `MemWriteOnExecutablePage` on CKB2023 (CKB-VM v2)

**Repository:** [nervosnetwork/ckb-std](https://github.com/nervosnetwork/ckb-std)

**Summary:** Contracts built with `ckb-std 1.1.0` + `default_alloc!()` produce ELF binaries where the `.rodata` section header has `WAM` (Write+Alloc+Merge) flags. CKB-VM v2 rejects these as W^X violations, even though program headers show proper page-aligned separation. Minimal contracts without `ckb-std` execute successfully.

**Impact:** The entire protocol is built — contracts, SDK, devnet, CLI, and **frontend UI is complete**. The only remaining piece is connecting the frontend to on-chain contract execution, which is blocked by this `ckb-std` issue. Without type script execution, the protocol works with data-only cells on devnet (off-chain SDK validation) but cannot achieve trustless on-chain validation on mainnet.

**Workaround:** Create state cells without type scripts (data-only). Off-chain SDK handles validation. On mainnet, type scripts will work once `ckb-std` fixes the section flags.

---

*Report generated for CKB Academy Builder Track*
