# Builder Track Weekly Report - Month 5 Week 1
> **Tracking progress in the CKB Academy Builder Program**

---

Name: Positive Vibes  
Week Ending: August 2, 2026  
Track: CKB Developer Builder  
Status: Month 5 Week 1 - Complete

---

## Executive Summary

This week focused on turning Orbkit into a capability-aware local runtime that the Orbital UI can trust. Instead of treating Orbkit as one opaque local process, the runtime now registers discrete worker capabilities with the backend, heartbeats its connected state, exposes workspace metadata, and receives command streams from the hosted UI through service events. The backend can now detect which local features are available, route commands to the right worker, and report capability-specific runtime status to the frontend.

The work also established the foundation for project inspection. Orbkit can now discover local contract config, publish workspace and contract metadata, generate project-structure snapshots, stream structure progress, and support live sync for contract file changes. This gives the UI a path to become more than a deploy dashboard: it can inspect local CKB contract structure, entrypoints, imports, file metrics, and source relationships.

---

## Builder Progress

```txt
Progress: 100%
Runtime Identity -> Capability Registration -> Workspace Discovery -> Structure Sync -> Preflight Readiness
```

| Status | Focus Area | Outcome |
|--------|------------|---------|
| Complete | Runtime Capability Model | Orbkit workers now advertise feature-specific capabilities |
| Complete | Service Event Bridge | Backend can route commands and receive typed worker progress |
| Complete | Workspace Discovery | Orbkit resolves workspace roots, config paths, contract paths, and deployment output |
| Complete | Contract Config API | UI can discover runtime contracts from live Orbkit metadata or cache |
| Complete | Structure Sync | Manual snapshots, latest state, streams, and live sync are wired |
| Complete | Preflight Foundation | Local toolchain checks are structured for UI display |
| In Progress | Hosted Validation | Hosted function redeploy and browser-to-runtime validation remain |

---

## Key Learnings

### A Hosted UI Needs Runtime Capabilities, Not Runtime Assumptions
> The UI cannot safely assume that a connected developer machine can build, deploy, fund, scan balances, and sync structure. Orbkit now advertises individual capabilities, so the UI can explain exactly which local worker is missing instead of showing a generic failure.

### Workspace Metadata Is Part Of The Product Surface
> Contract paths, script names, build flags, workspace roots, and config paths are not just backend configuration. The UI needs them to select contracts, scope commands, explain stale cache, and give the user confidence that Orbital is connected to the correct local project.

### Structure Sync Creates A Developer Inspection Layer
> A contract tree alone is useful, but a structure snapshot with imports, imported-by links, entrypoints, behavior classification, CKB API calls, shared functions, and file metrics gives the UI enough data to become an active CKB contract inspection tool.

---

## Practical Progress

### Project: **Orbital + Orbkit**
> **A hosted CKB workspace connected to a local runtime that can advertise capabilities, discover contracts, and inspect project structure**

```txt
Start Orbkit -> Register Capabilities -> Discover Contracts -> Sync Structure -> Inspect Project -> Run Preflight
```

### Month 5 Week 1 Achievements

#### Runtime Architecture + Capability Registration
- [x] Reshaped Orbkit into a local runtime that registers with the backend
- [x] Added service heartbeat behavior so connected Orbkit workers stay visible
- [x] Added capability metadata for local worker feature detection
- [x] Registered workspace metadata including workspace root, config path, contracts source path, and contract list
- [x] Added capability names for balance, funding, structure sync, preflight, build, test, reproduce, deploy, and deploy simulation
- [x] Added service-event command routing over GraphQL subscriptions
- [x] Added backend service bridge state for connected services and runtime topics
- [x] Added latest-state tracking for project structures, funding requests, build/deploy events, and balances

#### Configuration + Workspace Discovery
- [x] Expanded config resolution so Orbkit can locate workspace root, contracts root, deployment output, and contracts source files
- [x] Added discovery for `orbital.config.js`, `orbital.config.mjs`, and `orbital.config.json`
- [x] Preserved legacy `orbkit/mod/config.json` compatibility with migration guidance
- [x] Updated structure worker config handling to use the resolved contracts source file path
- [x] Added runtime contract metadata for `/contracts/config`
- [x] Added fallback behavior from live runtime config to persisted runtime cache to server config
- [x] Added contract mapping with stable IDs, names, paths, scripts, and build flags

#### Project Structure Sync + Graphing
- [x] Added `project-structure-sync` as an Orbkit runtime capability
- [x] Added project structure worker command handling through `project-structure-request`
- [x] Added manual project structure snapshots for selected contracts
- [x] Added live sync configuration and filesystem watch behavior
- [x] Added latest project structure state lookup
- [x] Added NDJSON stream support for project structure progress
- [x] Added contract manifest, stats, entrypoints, shared functions, file metrics, imports, and imported-by links to snapshots
- [x] Added CKB-focused analysis fields such as VM API calls, behavior classification, and state transition checks
- [x] Added structure routes for sync, live sync, latest snapshot, and stream
- [x] Extracted graph rendering into `ContractGraphModal`
- [x] Updated the structure panel for runtime contract config, search, details, live sync, and graph entry points

#### Preflight + Build Environment Foundation
- [x] Added structured preflight checks for local toolchain readiness
- [x] Checked Cargo, rustup, RISC-V target, clang/LLVM, Node, and OffCKB dependencies where required
- [x] Added Windows host toolchain detection
- [x] Added optional WSL path support for Windows workflows
- [x] Returned structured preflight results for UI rendering
- [x] Added CLI help text explaining preflight and build environment choices
- [x] Added UI-ready status states for missing preflight capability

#### Backend + Hosted API Alignment
- [x] Added local server routes for runtime status, contract config, and project structure workflows
- [x] Added GraphQL service registration, publication, and subscription support for runtime events
- [x] Mirrored key runtime routes inside the hosted Supabase function source
- [x] Added runtime message persistence paths for service events and latest state
- [x] Added `/orbkit/status` data shape with service list and capabilities
- [x] Added `/orbkit/reconnect` command path for UI-triggered runtime recovery

#### Documentation + UI Planning
- [x] Documented the runtime architecture and capability model in the Orbkit change summary
- [x] Documented structure sync, runtime status, and project inspection surfaces
- [x] Added a UI capability guide describing how the redesign can expose runtime status, contract discovery, and structure analysis
- [x] Identified core UI states for checking, connected, missing capability, stale cache, no snapshot, syncing, ready, and sync error

---

## Blockers & Resolutions

| Blocker | Impact | Resolution |
|---------|--------|------------|
| Orbkit was treated as a single opaque runtime | UI could not know which features were available | Added explicit worker capability registration |
| Contract discovery depended on static server config | Hosted UI could not reliably reflect the user's local workspace | Registered live workspace metadata and added cache/server fallback |
| Project structure was not available to the hosted UI | Users could not inspect local contract files from Orbital | Added project structure worker, sync routes, stream route, latest state, and live sync |
| Config paths were fragile across generated workspaces | Workers could miss the actual contracts source file | Centralized resolved config paths and used `cfg._resolved.contractsSourceFile` |
| Runtime failures were not feature-specific | Dashboard could only show generic runtime errors | Added capability-aware status and reconnect flow |

---

## What's Left

```txt
Remaining:
1. Expand build/deploy worker command surface
2. Add deploy simulation and richer deploy readiness data
3. Add worker-backed devnet funding and wallet balance refresh
4. Harden worker behavior against stale hosted responses
5. Package and publish the next Orbkit release
```

| # | Goal | Priority | Status |
|---|------|----------|--------|
| 1 | Build/deploy worker expansion | High | Next |
| 2 | Deploy simulation endpoint | High | Next |
| 3 | Devnet funding and balance workers | High | Next |
| 4 | Runtime stale-response hardening | High | Next |
| 5 | `orbkit` npm package release | Medium | Pending |
| 6 | Full hosted runtime validation | Medium | Pending |

---

## Progress Summary

| Category | Completion | Notes |
|----------|------------|-------|
| Runtime Capability Model | 100% | Workers advertise feature-specific capabilities |
| Service Event Routing | 90% | Command and progress paths established |
| Workspace Discovery | 95% | Runtime/cache/server fallback implemented |
| Contract Config API | 95% | UI can discover local workspace contracts |
| Project Structure Sync | 95% | Manual/live sync and stream routes implemented |
| Source Graph Foundation | 85% | Graph component extracted; redesign can improve inspection UX |
| Preflight Diagnostics | 85% | Structured checks available; broader build/deploy integration continues |
| Hosted API Parity | 80% | Source updated; redeploy and validation remain |
| UI Readiness | 80% | Existing panels can consume runtime status and structure snapshots |

**Overall Month 5 Week 1:** Orbkit now has a capability-aware runtime foundation. Orbital can detect connected local services, discover workspace contracts, request project structure snapshots, stream live structure updates, and render preflight-ready runtime states. This creates the base for a more capable UI that treats the local CKB workspace as an inspectable, commandable development environment rather than a black-box deployment target.

---

*Report generated for CKB Academy Builder Track*
