# Builder Track Weekly Report - Month 5 Week 4

> Tracking progress in the CKB Academy Builder Program

---

Name: Positive Vibes  
Week Ending: August 23, 2026  
Track: CKB Developer Builder  
Project: CKB Chess  
Status: Month 5 Week 4 - Complete

---

## Executive Summary

This week focused on turning the Week 3 CKB protocol into a playable product. CKB Chess now has a
Fastify application server, a Vite/React interface, CCC wallet authentication, sessvm sessions,
server-backed match persistence, legal move validation, authoritative clocks, a complete Game Room,
realtime presence, live chat, and a pre-game spectator staking pool.

The gameplay architecture was adjusted after considering CKB throughput and user experience. Moves
are validated and stored by the application server for responsive play rather than creating one CKB
transaction per turn. Checkmate, draw, resignation, and timeout are finalized first and written to an
idempotent migration outbox for later Result-cell publication. This keeps the final outcome and
settlement path aligned with CKB while avoiding unnecessary per-move chain load.

The UI now supports guest play without a wallet while retaining CCC authentication for wallet-backed
identity. A separate Match directory lists waiting, live, and completed games. The Game Room fits in
one viewport, supports board interaction and promotion, shows authoritative player clocks, and gives
spectators dedicated presence, chat, and staking views. Spectator stakes are currently server-backed
intents tagged for future Bet-cell migration; they do not yet lock or transfer CKB.

---

## Builder Progress

    Progress: 100%
    Server/Data -> Sessions -> Match API -> Game Room -> Realtime -> Spectator Pool -> Hardening

| Status | Focus Area | Outcome |
| --- | --- | --- |
| Complete | Server Architecture | Fastify routes, modules, utilities, and one schema boundary |
| Complete | Server Storage | Separate JSONL table per logical record type |
| Complete | Authentication | CCC signature challenges with sessvm session lifecycle |
| Complete | Guest Play | Match creation and play work without requiring a wallet signature |
| Complete | Match Directory | Waiting, live, and finished matches have a dedicated browse page |
| Complete | Game Room | Playable board, move history, clocks, joining, promotion, resignation, and results |
| Complete | Realtime | WebSocket match updates, presence, spectator counts, and live chat |
| Complete | Spectator Pool | Pre-game proportional staking with an atomic start-time cutoff |
| Complete | Validation | Server, UI build, lint, and responsive visual suites pass |
| In Progress | CKB Application Bridge | Result and Bet migration tags exist; funding and publication workers remain |

---

## Key Learnings

### Not Every Move Needs To Become A Cell Transition

> Burning and recreating a Game cell for every move gives strong on-chain traceability, but it adds
> latency, signing friction, fees, and unnecessary throughput pressure. Responsive chess is better
> handled by the application server, with terminal results and economically relevant actions migrated
> to CKB.

### Database Access Needs One Replaceable Boundary

> JSONL is appropriate for the current development stage, but routes and business modules should not
> know how files are stored. All database interaction goes through `sch.ts`, and each logical table has
> its own JSONL file. Replacing JSONL later should require a schema adapter change rather than a rewrite
> of every endpoint.

### Clocks Must Be Server-Authoritative

> Browser timers are only projections. The server persists both players' remaining milliseconds and
> the active turn start time, charges elapsed time during accepted transitions, and independently
> verifies timeout settlement. This prevents refreshed or delayed clients from controlling match time.

### Realtime Chat Still Requires A Strict Data Contract

> WebSocket delivery does not remove validation requirements. Chat is limited to 400 characters,
> preserves meaningful whitespace and newlines, removes HTML, rejects empty content, rate-limits sends,
> and physically retains only the newest 1,000 messages per match.

### Staking And Playing Must Be Mutually Exclusive

> A visitor should not be able to back a player and then occupy a player seat. Wager insertion and match
> joining share the schema mutation queue, so a join-versus-wager race can grant only one role. Starting
> the game closes the pool atomically.

### Product Copy Should Not Expose Storage Internals

> The API records whether data is server-backed, but the site only needs to explain play and settlement.
> Storage labels were removed from the Game Room and landing copy so implementation details do not become
> product concepts.

---

## Practical Progress

### Project: CKB Chess Application

> A responsive chess application with server-backed play and a CKB settlement path

    Create -> Join -> Play -> Watch/Chat -> Finish -> Queue Result -> Publish To CKB

### Month 5 Week 4 Achievements

#### Fastify Server And Data Architecture

- [x] Added a root `server/` application using Fastify and TypeScript.
- [x] Split HTTP endpoints into `routes/`, use cases into `module/`, and shared helpers into `util/`.
- [x] Added `sch.ts` as the only persistence interface used by routes and modules.
- [x] Added separate JSONL tables for matches, moves, chats, wagers, migrations, challenges, and sessions.
- [x] Added backward normalization for earlier match records.
- [x] Added optimistic and queued mutation guards for conflicting moves, joins, and wagers.

#### Match Lifecycle

- [x] Added match creation with player name, stake terms, and optional clock.
- [x] Added open waiting matches and Black-seat joining.
- [x] Added legal move submission with server-side `chess.js` validation.
- [x] Reconstructed positions from append-only move history before transitions.
- [x] Added checkmate, draw, resignation, and timeout finalization.
- [x] Added deterministic final-position digests and idempotent Result migration jobs.
- [x] Marked ordinary moves as non-migrating and terminal outcomes for future CKB publication.

#### CCC Authentication And Sessions

- [x] Integrated the CCC connector for wallet selection and message signing.
- [x] Added one-time signature challenges and replay-safe challenge consumption.
- [x] Added sessvm access, refresh, authentication, and logout handling.
- [x] Added stable browser guest identities for wallet-free creation and play.
- [x] Added configuration to restore wallet-only match actions later.
- [x] Kept match creation from automatically opening the wallet connector.

#### UI Pages And Navigation

- [x] Created a Vite, React, and TypeScript UI project.
- [x] Added a Home page with authentication, match creation, protocol summary, and live matches.
- [x] Added an independent `/matches` directory with All, Live, Waiting, and Finished filters.
- [x] Added `/matches/:id` as the full playable and spectatable Game Room.
- [x] Added loading, empty, error, busy, and terminal-result states.
- [x] Replaced redundant icon-and-text controls with icon-only utilities or text-only commands.
- [x] Removed storage implementation details from visible product copy.

#### Playable Game Room

- [x] Rendered the board from the persisted FEN position.
- [x] Added click-based origin and destination selection.
- [x] Added promotion choices for queen, rook, bishop, and knight.
- [x] Oriented the board from Black's perspective for the Black player.
- [x] Highlighted selected squares and the latest move.
- [x] Added algebraic move history with an internal scroll region.
- [x] Added join, resign, result, migration-status, and copy-match-ID controls.
- [x] Locked the page document to one viewport while keeping internal histories scrollable.

#### Authoritative Match Clocks

- [x] Persisted White and Black remaining milliseconds independently.
- [x] Persisted the active turn start time.
- [x] Charged elapsed time only to the player whose turn was completed.
- [x] Projected the active clock smoothly in the browser using server-time offset.
- [x] Added server-verified timeout settlement and Result migration.
- [x] Preserved untimed matches with `clock: null`.

#### Presence And Live Chat

- [x] Added short-lived, single-use WebSocket tickets.
- [x] Added match-scoped WebSocket rooms and reconnection behavior.
- [x] Added total viewer and spectator counts.
- [x] Added a dedicated desktop chat pane and a full-height narrow-screen overlay.
- [x] Added multiline messages and a visible 400-character counter.
- [x] Preserved intentional leading, trailing, and newline whitespace.
- [x] Removed HTML in both frontend and backend validation.
- [x] Rejected empty and whitespace-only messages.
- [x] Added message rate limiting and newest-1,000 retention per match.

#### Spectator Staking

- [x] Added a separate spectator pool for each waiting match.
- [x] Kept spectator stakes independent from the stake agreed between the two players.
- [x] Allowed spectators to back White or Black before play begins.
- [x] Allowed additional stake on the same side and rejected opposite-side hedging.
- [x] Prevented players from wagering and bettors from taking a player seat.
- [x] Closed wagering when the second player joined and the game became live.
- [x] Added dynamic pool totals, backer count, personal stake, and potential gross return.
- [x] Broadcast pool-change notifications over the match WebSocket.
- [x] Tagged wager records for future `ckb-bet-cell` migration.

#### Verification And UI Hardening

- [x] Passed 20 server tests covering lifecycle, clocks, sessions, chat, persistence, and wagers.
- [x] Added explicit join-versus-wager concurrency coverage.
- [x] Added legacy record normalization coverage.
- [x] Passed TypeScript server and UI production builds.
- [x] Passed UI lint with no warnings.
- [x] Passed browser interaction and viewport checks at 320, 390, 1366, and 1920 pixels.
- [x] Verified the Game Room has no document-level horizontal or vertical overflow.
- [x] Verified the spectator pool form and dynamic payout preview in the browser harness.

---

## Backend And Realtime Surface Completed

| Area | Endpoint Or Channel | Purpose |
| --- | --- | --- |
| Health | `GET /api/health` | Confirm API availability |
| Match Feed | `GET /api/matches` | List and filter waiting, live, and finished matches |
| Identity | `GET /api/matches/identity` | Resolve the current wallet or guest identity |
| Match Detail | `GET /api/matches/:id` | Return current match, moves, and server time |
| Create | `POST /api/matches` | Create a waiting match |
| Join | `POST /api/matches/:id/join` | Claim the open Black seat |
| Move | `POST /api/matches/:id/moves` | Validate and persist a legal move |
| Resign | `POST /api/matches/:id/resign` | Finalize resignation |
| Timeout | `POST /api/matches/:id/timeout` | Verify and settle an expired clock |
| Wager Summary | `GET /api/matches/:id/wagers` | Return pools and personal return projection |
| Place Wager | `POST /api/matches/:id/wagers` | Record a pre-game spectator stake |
| Realtime Ticket | `POST /api/matches/:id/realtime-ticket` | Issue a single-use room ticket |
| Match Socket | `GET /api/matches/:id/live` | Upgrade to presence, chat, match, and pool events |
| Session Challenge | `POST /api/session/challenge` | Issue a wallet-signature challenge |
| Session Login | `POST /api/session/login` | Verify CCC signature and create sessvm session |
| Session Refresh | `POST /api/session/refresh` | Rotate session access |
| Session State | `GET /api/session/me` | Return authenticated identity |
| Session Logout | `POST /api/session/logout` | Revoke the active session |

---

## Blockers & Resolutions

| Blocker | Impact | Resolution |
| --- | --- | --- |
| One cell transition per move would add signing and throughput pressure | Gameplay would feel slow and place nonessential history on-chain | Kept responsive moves server-backed and queued terminal outcomes for CKB |
| Fake matches hid missing application behavior | UI could not prove creation, joining, or legal play | Replaced fixtures with Fastify endpoints and JSONL-backed records |
| Database access spread across modules would make migration expensive | Replacing JSONL would require broad rewrites | Routed all persistence through `sch.ts` and separate logical tables |
| Browser clocks could be manipulated or drift | Timeout outcomes could become client-controlled | Made the server authoritative and treated UI clocks as projections |
| Chat could store markup, empty content, or unbounded history | Realtime rooms could become unsafe and storage could grow indefinitely | Added mirrored validation, sanitization, rate limits, and 1,000-message retention |
| Chat compressed the move panel on smaller screens | Spectators lost a usable full conversation view | Moved chat to its own desktop pane and dedicated mobile overlay |
| A bettor could race to become the second player | One identity could obtain conflicting economic roles | Serialized join and wager mutations and made the roles mutually exclusive |
| Storage language leaked into the interface | Implementation details distracted from play and settlement | Removed storage labels and architecture-specific product copy |

---

## What's Left

    Remaining:
    1. Build the worker that publishes pending Result migration jobs to CKB
    2. Convert spectator wager intents into funded Bet-cell transactions
    3. Add wallet signing and confirmation states for wagering and claims
    4. Index terminal games and wager receipts for attestation
    5. Add winner claim and payout history interfaces
    6. Replace single-process JSONL when hosted concurrency requires a transactional database
    7. Add production deployment, monitoring, moderation, and recovery workflows

| # | Goal | Priority | Status |
| ---: | --- | --- | --- |
| 1 | Result migration worker | High | Pending |
| 2 | Browser Bet-cell funding | High | Pending |
| 3 | Result attestation service | High | Pending |
| 4 | Winner claim UI | High | Pending |
| 5 | Transactional database adapter | Medium | Planned |
| 6 | User match and wager history | Medium | Pending |
| 7 | Chat moderation and abuse controls | Medium | Pending |
| 8 | Hosted observability and recovery | Medium | Pending |

---

## Progress Summary

| Category | Completion | Notes |
| --- | ---: | --- |
| Server Architecture | 100% | Routes, modules, utilities, and schema ownership established |
| Match Lifecycle | 100% | Create, join, move, finish, resignation, and timeout supported |
| Authentication | 95% | CCC and sessvm work; production policy and recovery remain |
| Match Directory | 100% | Complete filtered directory and page states available |
| Game Room | 100% | Play, spectate, clocks, move history, and result states implemented |
| Realtime Presence And Chat | 100% | Ticketed rooms, validation, retention, and responsive panes complete |
| Spectator Pool Projection | 100% | Pre-game intent and dynamic return model complete |
| Server Verification | 100% | 20 tests pass |
| Responsive UI Verification | 100% | Lint, build, interactions, and 320-1920px viewport checks pass |
| Result Publication Bridge | 35% | Migration outbox and payload exist; chain worker remains |
| Wager Funding And Claims | 30% | Protocol exists and intents are tagged; wallet transaction UX remains |

Overall Month 5 Week 4: CKB Chess is now a usable server-backed chess application rather than only a
contract protocol. Players can create, join, play, time, resign, and finish games; spectators can
watch, chat, see presence, and place pre-game proportional stake intents. The application keeps
interactive gameplay responsive while preserving a deliberate path for terminal results, Bet cells,
attestation, and winner claims to move onto CKB. The next milestone is completing that application-to-
chain bridge with real wallet-funded wager and settlement transactions.

---

Report generated for CKB Academy Builder Track
