# Builder Track Weekly Report - Month 4 Week 3
> **Tracking progress in the CKB Academy Builder Program**

---

Name: Positive Vibes  
Week Ending: July 19, 2026  
Track: CKB Developer Builder  
Status: Month 4 Week 3 - Complete

---

## Executive Summary

This week focused on strengthening Orbital before deployment begins. The active CKB integration was migrated from Lumos to CCC, contract builds were separated into debug and release profiles, and the deployment pipeline gained preflight checks, positive and negative contract tests, reproducible artifact hashing, and deterministic project bundles. These changes turn the previous build-and-deploy path into a reviewable sequence with explicit quality gates.

---

## Builder Progress

```txt
Progress: 100%
CCC Migration -> Local Preflight -> Contract Tests -> Reproducible Release Artifacts
```

| Status | Focus Area | Topics |
|--------|------------|--------|
| Complete | CKB SDK Modernization | CCC address, script, transaction, signer, hashing, and Type ID helpers |
| Complete | Build Profiles | Separate debug and release contract builds |
| Complete | Pre-Deployment Testing | Positive and expected-failure contract test cases |
| Complete | Dependency Preflight | Rust, RISC-V, clang/LLVM, Node, OffCKB, and WSL checks |
| Complete | Reproducibility | Multi-hash artifact reports and deterministic project bundles |
| In Progress | Contract Coverage | Adding project-specific positive and negative cases for every production contract |

---

## Key Learnings

### SDK Choice Shapes the Entire Developer Experience
> Moving to CCC was more than a dependency replacement. Address encoding, transaction preparation, cell collection, signing abstractions, frontend parsing, and Type ID construction all need to follow one consistent SDK model. A shared CCC layer reduces mismatches between the browser, backend, and local Orbkit runtime.

### Deployment Should Be the Last Step, Not the First Check
> A compile command succeeding does not prove that a contract is ready for deployment. Developers need dependency checks, a debug artifact for inspection, positive and negative behavior tests, a release build, and a reproducibility record before preparing an on-chain transaction.

### Reproducibility Needs Both Inputs and Outputs
> Hashing a binary is useful, but verification is stronger when the project source, configuration, and release result can be moved and checked together. Deterministic Orbital bundles complement the artifact hash report by preserving the inputs needed for independent review.

---

## Practical Progress

### Project: **Orbital**
> **A local-first CKB contract workspace with explicit build quality gates, reproducible artifacts, and coordinated deployment tooling**

```txt
Preflight -> Debug Build -> Contract Tests -> Release Build -> Reproduce -> Prepare Deploy
```

### Month 4 Week 3 Achievements

#### CCC Migration
- [x] Removed active Lumos dependencies from the root, Orbkit, frontend, and server packages
- [x] Added `@ckb-ccc/core` across the CKB interaction layers
- [x] Created a shared CCC adapter for scripts, addresses, cells, hashes, transactions, and signing entries
- [x] Updated Orbkit workspace scaffolding so newly initialized projects use CCC by default
- [x] Moved frontend address parsing and balance script resolution to CCC

#### Contract Build + Test Workflow
- [x] Added explicit debug and release build commands
- [x] Added a contract test runner that discovers Rust tests or an `orbital.tests.json` manifest
- [x] Added manifest cases that can expect success or intentional failure
- [x] Added build, test, and failure summaries to the Orbkit event stream
- [x] Added dashboard actions and readiness indicators for debug, tests, release, and reproducibility

#### Dependency Preflight
- [x] Added checks for Cargo, rustup, the CKB RISC-V target, clang, and `llvm-ar`
- [x] Added npx and optional OffCKB availability checks
- [x] Added Windows host and WSL build-environment handling
- [x] Added focused installation guidance for every missing dependency
- [x] Connected preflight to CLI startup, workers, backend routes, and the dashboard

#### Reproducible Outputs
- [x] Added SHA-256, Blake2b-512, and MD5 hashing for release binaries
- [x] Added expected-hash comparison and offline `--no-build` verification
- [x] Added `reproduce.json` reports beside deployment artifacts
- [x] Added deterministic `.orb` project export, verification, and extraction
- [x] Added generated workspace commands and documentation for the full quality workflow

---

## Blockers & Resolutions

| Blocker | Impact | Resolution |
|---------|--------|------------|
| Missing clang only appeared after Cargo had started compiling `ckb-std` | Developers received a long build failure with no direct recovery step | Added preflight checks with clang/LLVM installation instructions before build work starts |
| Debug and release artifacts shared an unclear workflow | Developers could accidentally treat an inspection build as the deployable binary | Added explicit build profiles and made release output the deployment artifact path |
| No standard way to express failure cases | Reject behavior could remain untested before deployment | Added test manifests with `expect: "fail"` alongside normal passing cases |
| A binary hash did not preserve the project inputs used to create it | Independent review and transfer were incomplete | Added deterministic project bundles plus machine-readable reproduction reports |

---

## What's Left

```txt
Remaining:
1. Add production-specific positive and negative cases for every contract
2. Expose and explain Type ID and data-hash deployment choices
3. Add an explicit Type ID upgrade workflow
4. Design a multisig preparation and signature-collection boundary for mainnet
5. Correct wallet address encoding and improve runtime/auth failure messages
```

| # | Goal | Priority | Status |
|---|------|----------|--------|
| 1 | Project-specific contract test coverage | High | In Progress |
| 2 | Type ID and data-hash deployment modes | High | In Progress |
| 3 | Type ID contract upgrades | High | In Progress |
| 4 | Mainnet multisig session flow | High | In Progress |
| 5 | Wallet/address and devnet status fixes | High | In Progress |
| 6 | Hosted end-to-end validation | Medium | Pending |

---

## Progress Summary

| Category | Completion | Notes |
|----------|------------|-------|
| CCC Migration | 100% | Active packages and generated workspaces now use CCC |
| Build Profiles | 100% | Debug and release paths are explicit |
| Dependency Preflight | 100% | Host/WSL checks and install guidance added |
| Contract Test Runner | 95% | Runner complete; production cases still being expanded |
| Reproducible Artifacts | 100% | Hash reports and deterministic bundles implemented |
| Dashboard Quality Gates | 90% | Actions and status states wired; full hosted validation remains |
| Deployment Safety | 75% | Quality gates complete; mode and multisig work continues |

**Overall Month 4 Week 3:** Orbital now uses CCC as its active CKB SDK and provides a structured pre-deployment workflow: check the local toolchain, build for debugging, run positive and negative tests, create a release artifact, and verify its hashes. The next phase focuses on how that reviewed artifact is referenced, upgraded, authorized, and deployed safely.

---

*Report generated for CKB Academy Builder Track*
