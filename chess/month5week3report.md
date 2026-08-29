# Builder Track Weekly Report - Month 5 Week 3

> Tracking progress in the CKB Academy Builder Program

---

Name: Positive Vibes  
Week Ending: August 16, 2026  
Track: CKB Developer Builder  
Project: CKB Chess  
Status: Month 5 Week 3 - Complete

---

## Executive Summary

This week focused on turning the chess concept into a deterministic CKB protocol. The project now has
a complete Board layer for legal chess transitions, frozen byte layouts for Game, Bet, and Result
cells, a single CKB-VM Engine binary, and an off-chain client for assembling the game and betting
transaction lifecycles.

The main architectural decision was to keep rule evaluation, byte encoding, script validation, and
transaction construction separate while exposing one contract package and one public client entry
point. `lib.rs` owns deterministic chess logic, `cell.rs` owns data formats, `engine.rs` owns Game
validation, `pool.rs` owns betting validation, and `main.rs` only adapts CKB syscalls to the verifier.
Off-chain callers consume `client/index.js`, while `game.js` and `betting.js` retain their separate
transaction responsibilities.

The protocol now covers Game creation, legal moves, terminal settlement, timeouts, spectator wager
receipts, atomic Result attestation, exact integer allocation, and independent winner claims. The
test surface includes Rust rule and codec tests, CKB-VM execution, transaction-builder tests, 10,000
deterministic payout vectors, and stateful devnet harnesses.

---

## Builder Progress

    Progress: 100%
    Board -> Cell Layouts -> Engine -> Game Flow -> Pool -> VM/Devnet Verification

| Status | Focus Area | Outcome |
| --- | --- | --- |
| Complete | Board Logic | Legal move generation, application, terminal classification, and deterministic hashing |
| Complete | Cell Layouts | Frozen Game v2, Bet v1, and Result v1 codecs with capacity formulas |
| Complete | Engine Validation | Creation, moves, timeout, and terminal settlement validated in CKB-VM |
| Complete | Game Transactions | Create, step, finish, and sign builders exposed through one client API |
| Complete | Pool Transactions | Wager, attest, claim, and payout flows implemented |
| Complete | Integer Accounting | Winner allocations conserve the entire pool with deterministic remainder handling |
| Complete | VM Verification | Legal flows execute within measured cycle bounds and malformed transitions are rejected |
| Complete | Devnet Harnesses | Match and Pool lifecycle harnesses cover settlement and independent claims |

---

## Key Learnings

### Chess State Needs More Than A Board Array

> Legal chess depends on turn, castling rights, en-passant state, halfmove count, and repetition
> history. The public `Position` therefore remains opaque so callers cannot construct a board that
> silently omits the state required for correct move and draw classification.

### Stable Game Identity Cannot Depend On The Latest Output

> A Game cell out point changes after every move. Bets and Results need a stable identifier, so the
> Game ID is derived from the first creation input and committed into the Game lock. Every later Game,
> Bet, Result, and claim reference preserves that identity.

### Exact Payouts Require Deterministic Remainder Assignment

> Independent integer division can leave unallocated shannons. The Pool uses cumulative allocation,
> ordered by wager out point, so rounding remainders are assigned deterministically and every winner
> payout plus the platform fee equals the original pool exactly.

### Independent Claims Need Immutable Shared Evidence

> Winners should not depend on claim order or a script iterating over prior claims. Settlement creates
> one immutable Result and one unique claim receipt per winner. Each winner later consumes only their
> receipt and references the Result as a read-only cell dep.

### One Binary Can Still Preserve Clear Ownership

> Packaging the scripts into one Engine binary reduces deployment and maintenance overhead, but the
> internal modules still need explicit boundaries. Script argument prefixes dispatch Game, wager,
> claim, Result, and immutable-Result modes without mixing their validation responsibilities.

---

## Practical Progress

### Project: CKB Chess Protocol

> Deterministic chess play, economic settlement, spectator betting, and independent claims on CKB

    Create Game -> Apply Moves -> Finish Game -> Attest Result -> Create Claims -> Claim Payout

### Month 5 Week 3 Achievements

#### Board Logic

- [x] Added opaque `Position` and candidate `Move` types.
- [x] Added stable legal-move iteration across origin, destination, and promotion choices.
- [x] Implemented ordinary movement for every chess piece.
- [x] Implemented captures, pawn double moves, en passant, castling, and four promotion choices.
- [x] Rejected moves that leave the acting king in check and prohibited king capture.
- [x] Classified ongoing, checkmate, stalemate, fifty-move, repetition, and insufficient-material states.
- [x] Added deterministic 32-byte SHA-256 position hashing.
- [x] Added reference perft checks for the opening, Kiwipete, endgame, and promotion/castling positions.

#### Frozen Cell Layouts

- [x] Defined the 128-byte Game v2 layout.
- [x] Defined the 80-byte Bet v1 layout.
- [x] Defined the 72-byte Result v1 layout.
- [x] Enforced magic values, versions, reserved zeroes, lengths, and enum discriminants.
- [x] Added round-trip tests for every cell type.
- [x] Added occupied-capacity formulas based on CKB RFC 0022 rules.
- [x] Documented byte offsets, integer endianness, and capacity examples.

#### Engine And CKB-VM Integration

- [x] Added the single CKB-VM `entry` function and syscall-backed `Read` adapter.
- [x] Added neutral Game lock validation with separate player authorization inputs.
- [x] Validated Game creation, immutable terms, stable scripts, and sufficient capacity.
- [x] Validated legal move witnesses and exact output-state transitions.
- [x] Added position settlement and relative-block timeout witnesses.
- [x] Added exact winner, draw, and protocol-fee accounting.
- [x] Rejected illegal moves, malformed witnesses, bad signatures, and short payouts.
- [x] Configured Orbkit for the RISC-V CKB target and `data2` deployment.

#### Game Transaction Flow

- [x] Added `create` for player input selection, immutable terms, stable Game ID, fee estimation, and change.
- [x] Added `step` for move witnesses, authorization inputs, preserved Game capacity, and preserved terms.
- [x] Added `finish` for checkmate, draw, and timeout settlement.
- [x] Added sequential CCC-compatible signing through `sign`.
- [x] Added Engine resolution from Orbkit deployment receipts.
- [x] Kept transaction construction stateless and free of direct network or indexer access.

#### Pool And Betting Flow

- [x] Added `wager` for typed Bet receipt creation.
- [x] Added atomic `attest` for terminal Game settlement plus Result publication.
- [x] Added one unique claim receipt per winning wager.
- [x] Added `claim` for independent winner redemption against an immutable Result.
- [x] Added exact platform-fee output enforcement.
- [x] Added deterministic cumulative integer payout arithmetic.
- [x] Added `WAGR`, `CLAM`, `RSLT`, and `KEEP` script modes to the Engine binary.
- [x] Added nonces and Type ID commitments to prevent receipt aliasing or duplication.

#### Verification

- [x] Passed 26 Rust library tests covering Board, Cell, and Engine behavior.
- [x] Passed 10 off-chain client tests for Game and Pool transaction construction.
- [x] Conserved 10,000 deterministic integer payout pools with no floating-point arithmetic.
- [x] Added VM cycle measurement and explicit maximum-cycle bounds.
- [x] Added a Game devnet harness for create, alternating moves, and settlement.
- [x] Added a Pool devnet harness for wagers, atomic Result creation, and separate winner claims.

---

## Contract And Client Surface Completed

| Area | Interface | Purpose |
| --- | --- | --- |
| Board | `Position`, `Move`, `apply`, `legal_moves`, `end`, `hash` | Deterministic chess state and transitions |
| Cell | `Game`, `Bet`, `Result`, `cost`, `cell_cost` | Frozen encoding and occupied capacity |
| Engine | `entry`, `Read`, `verify` | CKB-VM syscall integration and Game validation |
| Game Client | `create`, `step`, `finish`, `sign` | Unsigned Game lifecycle construction and signing |
| Pool Client | `wager`, `attest`, `claim`, `payout` | Bet receipt, Result, claim, and allocation flow |
| Deployment | Orbkit deployment receipt resolution | Locate the Engine code hash and cell dep |
| VM Harness | Game and Pool simulator suites | Execute scripts and measure cycles |
| Devnet Harness | `test:devnet`, `test:devnet:pool` | Confirm stateful lifecycle behavior on a local chain |

---

## Blockers & Resolutions

| Blocker | Impact | Resolution |
| --- | --- | --- |
| `main.rs` appeared to be the only detected Rust target | Board logic in `lib.rs` looked disconnected from the binary | Kept one Cargo package; Cargo detects `lib.rs` as the library and `main.rs` imports it |
| Separate contract directories increased maintenance cost | Shared layouts and constants could drift between scripts | Consolidated Game and Pool modes into one contract binary with internal modules |
| Game out points change after every move | Bets could lose their reference to the game they backed | Derived and preserved an immutable creation-based Game ID |
| Proportional division produced remainder risk | Pool capacity could fail to balance exactly | Used cumulative integer allocation ordered by wager out point |
| Independent claims could contend over mutable state | Claim order could affect other winners | Created unique winner receipts and kept the Result immutable |
| Receipt capacity can be smaller than occupied capacity | Transactions could construct invalid outputs | Added explicit occupied-capacity checks and rejected undersized receipts |

---

## What's Left

    Remaining:
    1. Build the browser application around the protocol
    2. Add a server-backed match lifecycle for responsive play
    3. Add CCC wallet authentication and session management
    4. Add a playable Game Room, match directory, clocks, presence, and chat
    5. Connect application result jobs to on-chain Result publication
    6. Connect spectator wager intents to actual Bet-cell funding and claim flows

| # | Goal | Priority | Status |
| ---: | --- | --- | --- |
| 1 | Fastify application API and data boundary | High | Ready to Start |
| 2 | Vite/React playable UI | High | Ready to Start |
| 3 | CCC and sessvm authentication | High | Ready to Start |
| 4 | Realtime Game Room | High | Pending |
| 5 | Result migration worker | High | Pending |
| 6 | Browser Bet-cell funding and claims | High | Pending |
| 7 | Hosted deployment and monitoring | Medium | Pending |

---

## Progress Summary

| Category | Completion | Notes |
| --- | ---: | --- |
| Board Rules | 100% | Legal moves, special rules, terminal states, and hashing implemented |
| Cell Layouts | 100% | Game, Bet, Result, and capacity rules frozen and documented |
| Engine Game Validation | 100% | Creation, moves, timeout, and settlement validated |
| Game Transaction Client | 100% | Create, step, finish, and sign available |
| Pool Scripts | 100% | Wager, Result, immutable evidence, and claim modes implemented |
| Pool Transaction Client | 100% | Wager, attest, claim, and exact payout available |
| Unit And Client Verification | 100% | 26 Rust tests and 10 client tests pass |
| VM And Devnet Harnesses | 95% | Core lifecycle coverage exists; broader operational runs remain useful |
| Browser Application | 10% | Application work begins in Week 4 |
| On-Chain Application Bridge | 25% | Protocol exists; browser funding and migration workers remain |

Overall Month 5 Week 3: CKB Chess moved from a project outline to a tested protocol implementation.
The deterministic Board, frozen Cell layouts, Engine validator, Game transaction flow, and Pool
lifecycle now agree on stable identities, exact capacity accounting, and immutable settlement
evidence. The next step is to turn this protocol into a usable application without placing every
interactive move on-chain.

---

Report generated for CKB Academy Builder Track
