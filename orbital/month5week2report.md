# Builder Track Weekly Report - Month 5 Week 2
> **Tracking progress in the CKB Academy Builder Program**

---

Name: Positive Vibes  
Week Ending: August 9, 2026  
Track: CKB Developer Builder  
Status: Month 5 Week 2 - Complete

---

## Executive Summary

This week focused on completing the worker-backed development loop around the Month 5 Week 1 runtime foundation. Orbkit now supports streamed preflight, debug and release builds, contract tests, reproducible build checks, deploy simulation, deploy preparation, deploy broadcast, devnet funding, and wallet balance refreshes. The UI can now reason about deploy cost, fee accounting, capacity requirements, selected wallet, signing pattern, latest deployment receipt, and multisig session progress before asking the user to authorize sensitive actions.

The second major focus was release hardening. Hosted backends can legitimately expire pending request waiters before local workers finish. Orbkit workers now tolerate stale `No pending request matches ...` responses for balance, structure, funding, and build/deploy progress events. This prevents completed local work from crashing the runtime. The package was bumped to `orbkit@0.1.11`, rebuilt into `dist/`, packed as `orbkit-0.1.11.tgz`, and prepared for npm publish and backend redeploy.

---

## Builder Progress

```txt
Progress: 100%
Build/Test/Reproduce -> Simulate Deploy -> Fund/Balance -> Multisig Sessions -> Release Hardening
```

| Status | Focus Area | Outcome |
|--------|------------|---------|
| Complete | Build/Test/Reproduce | Worker streams now cover preflight, builds, tests, and reproducible hashes |
| Complete | Deploy Simulation | UI can preview cost, fee, cells, capacity, and wallet readiness |
| Complete | Deploy Preparation | Unsigned transactions, signing entries, fee accounting, and script config are returned |
| Complete | Multisig Sessions | Mainnet-safe preparation and signature collection are supported |
| Complete | Devnet Funding | Funding requests stream progress through a local worker |
| Complete | Balance Runtime | Wallet balances include spendable, total, locked, and data-locked amounts |
| Complete | Runtime Crash Hardening | Stale pending-request responses no longer kill Orbkit workers |
| In Progress | Release Deployment | npm publish, hosted redeploy, and full hosted validation remain |

---

## Key Learnings

### Deploy UX Should Start With Simulation
> Deployment preparation contains many irreversible or security-sensitive decisions: deploy kind, create or upgrade mode, single or multisig signing, selected wallet, required capacity, fee source, and binary availability. Deploy simulation gives the UI a safe preview before passkey authorization or transaction preparation.

### Funding And Balance Are Runtime Features, Not Static Wallet Fields
> Hosted UI cannot directly inspect a user's local devnet or local CKB node. Funding and balances need worker-backed request streams so the UI can show progress, retries, tx hashes, spendable capacity, and refreshes through connected Orbkit services.

### Reproducibility Needs Product-Level Feedback
> A hash mismatch and a build-lock mismatch are different release risks. Orbkit now produces structured reproduce results so the UI can explain whether the artifact failed to match, the environment failed to match, or the run only proved artifact-level information.

### Worker Progress Must Survive Backend Timing Races
> A local worker can finish after a backend waiter expires. That should be treated as a stale response, not as a fatal runtime error. Orbkit now ignores stale pending-request errors only for progress/response events while keeping real publish failures visible.

---

## Practical Progress

### Project: **Orbital + Orbkit**
> **A CKB development workflow for building, testing, reproducing, simulating, funding, preparing, signing, broadcasting, and tracking contracts from the UI**

```txt
Preflight -> Build -> Test -> Reproduce -> Simulate -> Prepare -> Sign -> Broadcast -> Receipt
```

### Month 5 Week 2 Achievements

#### Build, Test, Deploy, And Simulation
- [x] Expanded the build/deploy worker command set to support `preflight`, `build`, `test`, `reproduce`, `deploy`, `simulate-deploy`, and `deploy-broadcast`
- [x] Added debug and release build profile support
- [x] Added contract test streaming with case-level results
- [x] Returned build artifact metadata including binary path, binary size, manifest path, hashes, status, and summary
- [x] Added deploy simulation endpoint and worker capability
- [x] Added deploy simulation output for required CKB, exact fee when available, cell counts, binary size, source size, deploy wallet, and deploy mode
- [x] Preserved Type ID/data deploy kind and create/upgrade deploy mode in deploy preparation
- [x] Returned unsigned transaction, signing entries, fee accounting, capacity accounting, deploy wallet, script config, type ID, and type script from deploy preparation
- [x] Added deploy broadcast endpoint and deployment receipt persistence
- [x] Added latest deployment lookup for network, contract, service, and wallet filters

#### Multisig Deployment Flow
- [x] Added multisig deploy preparation through `deploySigningPattern: "multisig"`
- [x] Returned a small multisig session pointer instead of exposing the canonical transaction as the shared object
- [x] Persisted multisig deploy sessions on the backend
- [x] Added multisig session loading by `sessionId` and `packageHash`
- [x] Added multisig signing endpoint with passkey proof
- [x] Tracked required and collected signatures
- [x] Kept multisig preparation separate from broadcast
- [x] Preserved the mainnet single-key safety boundary by preventing direct single-sig mainnet broadcast

#### Devnet Funding + Wallet Balances
- [x] Added `devnet-fund-wallet` as a runtime worker capability
- [x] Added worker-backed devnet funding requests over `devnet-fund-wallet-request`
- [x] Streamed funding phases including accepted, funding-ready, transfer-attempt, retrying, transferring, completed, and failed
- [x] Added retry behavior for transient OffCKB transfer failures
- [x] Published devnet balance updates after successful funding
- [x] Added `wallet-balance` as a runtime worker capability
- [x] Added wallet balance requests and responses over service events
- [x] Returned spendable, total, locked, and data-locked balance fields
- [x] Updated account info and wallet UI helpers to consume richer balance data
- [x] Added authenticated `/networks/devnet/status` behavior that checks devnet through connected Orbkit

#### Project Bundle Export + Deployment Receipts
- [x] Added project bundle export as a downloadable `.orb` artifact
- [x] Returned `application/vnd.orbital.bundle` responses
- [x] Added project hash and archive hash headers
- [x] Added contract/network-aware export filenames
- [x] Added frontend helper support for bundle export
- [x] Persisted deployment receipts from completed deploy broadcast events
- [x] Added latest deployment summaries for UI receipt panels

#### Account, Session, Wallet, And Helper API Keys
- [x] Continued aligning server actions around authenticated wallet access
- [x] Surfaced refreshed sessions through response headers
- [x] Ensured deploy, funding, wallet export, and wallet mutation actions resolve the authenticated user
- [x] Preserved wallet create, mnemonic link, label update, delete, and mnemonic export flows
- [x] Added helper API key support for Orbkit devnet wallet recovery
- [x] Added `/orbkit/wallets/devnet` for authenticated local runtime wallet recovery
- [x] Added SQLite-backed persistence alongside existing runtime storage paths

#### Runtime Reliability + Release Packaging
- [x] Fixed worker crashes caused by stale `No pending request matches ...` backend responses
- [x] Added stale pending-request guards for balance responses
- [x] Added stale pending-request guards for structure progress
- [x] Added stale pending-request guards for funding progress
- [x] Added stale pending-request guards for build/deploy progress
- [x] Kept non-stale publish errors visible so real failures still surface
- [x] Rebuilt Orbkit production `dist/` output
- [x] Bumped package version to `0.1.11`
- [x] Packed `orbkit-0.1.11.tgz`
- [x] Wrote publish and redeploy checklist for npm consumers and hosted backend

#### UI Capability Documentation
- [x] Created a detailed Orbkit UI capability guide for redesign planning
- [x] Mapped runtime capabilities to UI actions and backend endpoints
- [x] Documented recommended UI states for runtime status, deploy simulation, deploy preparation, multisig, funding, balances, streams, and project export
- [x] Proposed an operational information architecture for Runtime, Project, Build, Deploy, Wallets, and Activity sections

---

## Backend + API Surface Completed

| Area | Endpoint or Channel | Purpose |
|------|---------------------|---------|
| Preflight | `POST /contracts/preflight` | Stream local toolchain diagnostics |
| Build | `POST /contracts/build` | Stream debug/release contract builds |
| Tests | `POST /contracts/test` | Stream contract test results |
| Reproduce | `POST /contracts/reproduce` | Verify release build lock and artifact hash |
| Deploy Prep | `POST /contracts/deploy` | Prepare unsigned deployment transaction or multisig package |
| Deploy Simulation | `POST /contracts/deploy/simulate` | Estimate capacity, fees, cells, and wallet readiness |
| Deploy Broadcast | `POST /contracts/deploy/broadcast` | Broadcast signed transaction and persist receipt |
| Multisig Session | `POST /contracts/deploy/multisig/session` | Load canonical multisig deploy session |
| Multisig Sign | `POST /contracts/deploy/multisig/sign` | Submit signer authorization and signature |
| Latest Deployment | `GET /contracts/deployments/latest` | Fetch latest receipt by network/contract/service/wallet |
| Devnet Funding | `POST /wallets/devnet/fund` | Stream worker-backed devnet funding |
| Devnet Status | `GET /networks/devnet/status` | Check devnet through connected Orbkit |
| Project Export | `GET /projects/export` | Download `.orb` project bundle |
| Balance Requests | `wallet-balance-request` / `wallet-balance-response` | Refresh spendable, total, locked, and data-locked balances |
| Progress Channels | build/deploy, funding, structure progress | Stream worker activity back to UI |

---

## Blockers & Resolutions

| Blocker | Impact | Resolution |
|---------|--------|------------|
| Hosted backend could reject late worker responses with `No pending request matches ...` | Local Orbkit crashed after completed balance, structure, funding, or deploy work | Added stale pending-request guards in all worker progress publishers |
| Deploy cost and readiness were only visible late in the flow | Users could reach signing before understanding balance, fee, binary, or mode constraints | Added deploy simulation with capacity, fee, cells, wallet, and binary/source details |
| Devnet funding and balance checks were too tightly coupled to local assumptions | Hosted UI needed a worker-backed path through Orbkit | Added funding and balance workers with service-event streams and richer balance fields |
| Reproduce failures could be hard to interpret | Artifact mismatch and environment mismatch looked similar | Added build-lock verification and structured reproduce metadata |
| Mainnet deploy path needed a safer signing boundary | Direct single-key mainnet broadcast is too risky | Preserved mainnet single-sig block and expanded multisig session flow |
| Package consumers could keep running older `dist` files | Source fixes would not affect installed workspaces | Bumped, rebuilt, packed, and documented `orbkit@0.1.11` release steps |

---

## What's Left

```txt
Remaining:
1. Publish orbkit@0.1.11 to npm
2. Redeploy the hosted Supabase backend function
3. Update generated and existing contract workspaces to orbkit@^0.1.11
4. Run full long-duration server and orbkit test suites outside short command timeouts
5. Validate hosted browser-to-Orbkit-to-CKB flows end to end
6. Redesign the UI around runtime capabilities, deploy readiness, and project inspection
```

| # | Goal | Priority | Status |
|---|------|----------|--------|
| 1 | Publish `orbkit@0.1.11` | High | Pending |
| 2 | Redeploy hosted Supabase function | High | Pending |
| 3 | Update consuming workspaces | High | Pending |
| 4 | Full server and Orbkit test run | High | Pending |
| 5 | Hosted runtime end-to-end validation | High | In Progress |
| 6 | UI redesign using capability guide | Medium | Ready to Start |
| 7 | Review large package-lock refresh before commit | Medium | Pending |
| 8 | Add final multisig broadcast confirmation design | Medium | Pending |

---

## Progress Summary

| Category | Completion | Notes |
|----------|------------|-------|
| Build/Test/Reproduce | 92% | Core workflows stream results; long test pass still needed |
| Deploy Simulation | 95% | Cost and capacity estimates wired |
| Deploy Preparation | 92% | Single and multisig preparation implemented; mainnet broadcast remains intentionally gated |
| Multisig Session Flow | 90% | Session and signing endpoints implemented; final broadcast UX remains |
| Devnet Funding | 95% | Worker-backed stream and retry behavior implemented |
| Wallet Balance Model | 95% | Spendable/total/locked/data-locked fields wired |
| Project Bundle Export | 95% | Bundle response and hashes implemented |
| Runtime Crash Hardening | 100% | Stale pending-request responses no longer kill local workers |
| Package Release Prep | 95% | `0.1.11` built and packed; npm publish remains |
| Hosted Backend Parity | 85% | Function source updated; redeploy and validation remain |
| UI Redesign Readiness | 90% | Capability guide now maps actions, states, and endpoints |

**Overall Month 5 Week 2:** Orbkit now supports a fuller CKB development loop from the UI: preflight, build, test, reproduce, simulate, prepare, multisig-sign, broadcast, fund, balance-refresh, receipt lookup, and project export. The runtime is also more resilient because stale hosted responses no longer crash worker processes. The next step is to publish `orbkit@0.1.11`, redeploy the hosted backend, and validate the full browser-to-Orbkit-to-CKB workflow against production infrastructure.

---

*Report generated for CKB Academy Builder Track*

