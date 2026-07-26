# Builder Track Weekly Report - Month 4 Week 4
> **Tracking progress in the CKB Academy Builder Program**

---

Name: Positive Vibes  
Week Ending: July 26, 2026  
Track: CKB Developer Builder  
Status: Month 4 Week 4 - Complete

---

## Executive Summary

This week focused on deployment safety and the user-facing failures found during product testing. Orbital now exposes Type ID and data-hash deployment choices, supports Type ID creation and upgrade modes, prepares server-owned multisig sessions for signature collection, encodes wallet addresses from full CKB lock scripts, and reports authentication, Orbkit connectivity, and devnet availability as separate states. The wallet and hosted runtime flows were also aligned around canonical addresses and authenticated session handling.

---

## Builder Progress

```txt
Progress: 100%
Deployment Modes -> Type ID Upgrades -> Multisig Sessions -> Wallet and Runtime Reliability
```

| Status | Focus Area | Outcome |
|--------|------------|---------|
| Complete | Deployment References | Type ID and data-hash modes exposed and explained |
| Complete | Upgrade Preparation | Create, auto, and Type ID upgrade transaction paths |
| Complete | Address Correctness | Full lock-script encoding and server-side address validation |
| Complete | Runtime Diagnostics | Separate session, Orbkit, and devnet connection states |
| Complete | Multisig Phase 1 | Unsigned preparation, canonical sessions, and verified signature collection |
| In Progress | Mainnet Finalization | Explicit fully signed transaction confirmation and broadcast remain disabled |

---

## Key Learnings

### Deployment Reference Mode Is a Security Decision
> Type ID and data-hash deployments solve different problems. Type ID creates a stable reference and therefore introduces upgrade authority, while data hash binds consumers to one exact binary and makes future changes an explicit migration. The product must show that tradeoff before the transaction is prepared.

### Multisig Requires a Canonical Source of Truth
> Passing a full unsigned transaction between signers makes ownership and version checks harder. Orbital instead shares a small session pointer while the server retains the canonical transaction, policy, signing entries, package hash, and signature progress. This makes stale or altered packages easier to reject.

### Connectivity Errors Must Identify the Broken Boundary
> `Authentication required` is not useful when the actual issue may be an expired session, a disconnected Orbkit process, or an unreachable local node. Each boundary now returns a distinct state so the dashboard can direct the user to the correct recovery action.

---

## Practical Progress

### Project: **Orbital**
> **A CKB deployment workspace that makes reference mode, upgrade authority, signer policy, and runtime state explicit**

```txt
Choose Reference -> Choose Create/Upgrade -> Estimate -> Authorize -> Collect Signatures -> Confirm
```

### Month 4 Week 4 Achievements

#### Deployment Modes + Upgrades
- [x] Added Type ID and data-hash choices to the deployment panel
- [x] Added guidance covering reference stability, immutability, upgrade authority, and migration risk
- [x] Added `create`, `auto`, and `upgrade` deployment modes
- [x] Restricted in-place upgrades to Type ID deployments
- [x] Added previous-receipt lookup and upgrade metadata to estimates and deployment receipts
- [x] Preserved deploy kind and mode in dashboard summaries and backend events

#### Multisig Safety Boundary
- [x] Kept mainnet single-key broadcast disabled
- [x] Added unsigned deployment preparation for a supplied multisig address
- [x] Added canonical server-side storage for transaction, signing entries, policy, and package hash
- [x] Added downloadable session pointers that do not expose the canonical transaction payload
- [x] Added a dedicated multisig page for loading, syncing, authorizing, and recording signatures
- [x] Added duplicate-signer, signer-policy, session ID, and package-hash checks
- [x] Added signature progress and the `ready-to-broadcast` terminal collection state

#### Address + Wallet Fixes
- [x] Replaced address prefix concatenation with CCC encoding from the full lock script
- [x] Added valid devnet/testnet `ckt1...` and mainnet `ckb1...` address derivation
- [x] Added backend validation that rejects raw lock arguments presented as addresses
- [x] Normalized wallet records into per-network canonical address maps
- [x] Reworked authenticated wallet create and mnemonic-link operations
- [x] Added clearer wallet loading, duplicate, label, export, and deletion states

#### Authentication + Runtime Status
- [x] Added shared bearer-token parsing and refreshed-session response headers
- [x] Distinguished missing auth from an invalid or expired session
- [x] Distinguished a disconnected Orbkit runtime from a direct devnet RPC failure
- [x] Added explicit local and production profiles for the frontend, server, and Orbkit runtime
- [x] Added clearer dashboard messages when a required Orbkit worker capability is offline
- [x] Kept hosted Supabase endpoints aligned with the local server contract

#### Documentation + Coverage
- [x] Added the deployment-mode guide to the product manual
- [x] Documented preflight, contract tests, reproducible hashes, and runtime troubleshooting
- [x] Added server coverage for address validation, deployment modes, upgrade preparation, and multisig session creation
- [x] Added an implementation explanation mapping each feedback item to its fix and remaining work
- [x] Verified all 26 Orbkit tests, the server integration suite, and the production frontend build

---

## Blockers & Resolutions

| Blocker | Impact | Resolution |
|---------|--------|------------|
| Wallet addresses were generated by prefixing a lock argument | Display, balance, funding, and deployment could use invalid addresses | Encode the complete lock script through CCC and validate every submitted address |
| Devnet status collapsed different failures into one auth message | Users could not tell whether to sign in, start Orbkit, or repair devnet | Return separate missing-session, expired-session, runtime-offline, and RPC-unreachable states |
| Deployment mode was implicit | Users could not evaluate upgradeability or migration requirements | Added Type ID/data-hash selection with use cases and security notes |
| Mainnet deployment risked becoming a single-key path | One credential could control deployment or upgrade authority | Disabled single-signature mainnet broadcast and added canonical multisig preparation/signature collection |
| Sharing transaction payloads between signers could create stale package copies | Signers might authorize different transaction state | Share a pointer and keep the canonical transaction and package hash on the Orbital server |

---

## What's Left

```txt
Remaining:
1. Add explicit final confirmation and broadcast for fully signed multisig sessions
2. Validate wallet creation and devnet switching against the deployed hosted backend
3. Exercise Type ID creation and upgrade on a live CKB network
4. Publish pinned-toolchain reproducible build hashes for production contracts
5. Expand end-to-end coverage across browser, hosted backend, Orbkit, and CKB node
```

| # | Goal | Priority | Status |
|---|------|----------|--------|
| 1 | Multisig final confirmation and broadcast | High | Pending |
| 2 | Hosted wallet/devnet end-to-end validation | High | In Progress |
| 3 | Live Type ID upgrade validation | High | Pending |
| 4 | Production reproducibility publication | Medium | Pending |
| 5 | Full browser-to-chain automated test | Medium | Pending |
| 6 | Documentation consistency and release notes | Medium | In Progress |

---

## Progress Summary

| Category | Completion | Notes |
|----------|------------|-------|
| Deployment Mode UX | 100% | Type ID and data-hash tradeoffs exposed |
| Type ID Upgrade Preparation | 95% | Implementation complete; live-network validation remains |
| CKB Address Correctness | 100% | Full-script encoding and parsing added |
| Wallet Flow | 90% | Local contracts aligned; hosted validation remains |
| Session + Runtime Diagnostics | 95% | Boundaries now return distinct states |
| Multisig Preparation | 100% | Canonical session and pointer workflow implemented |
| Multisig Signature Collection | 90% | Verified collection implemented; broader signer testing remains |
| Mainnet Final Broadcast | 0% | Intentionally disabled pending explicit confirmation design |
| End-to-End Integration | 88% | Core paths wired; live hosted and chain validation remain |

**Overall Month 4 Week 4:** Orbital now makes the important CKB deployment decisions visible: how code is referenced, whether it can be upgraded, who has authority, how signatures are collected, and which runtime boundary is unavailable when a request fails. Mainnet single-key broadcast remains blocked, while the safer multisig preparation and signature-collection phase is in place for further validation.

---

*Report generated for CKB Academy Builder Track*
