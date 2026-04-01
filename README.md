# ATHEON Protocol

> **Fair token launches with automatic liquidity deployment**

---

## The Problem

Launching a token today is broken:

1. **Manual liquidity deployment** - Creators must manually set up pools on each DEX
2. **Single DEX launches** - Tokens only launch on one DEX, limiting access
3. **Unclear pricing** - Initial token price is arbitrary or manipulated
4. **High capital requirements** - Creators need CKB upfront for liquidity

---

## The ATHEON Solution

ATHEON automates the entire launch process:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. CREATE LAUNCH                                          │
│     Creator deposits tokens, sets fundraising goal         │
│                                                             │
│  2. COMMUNITY CONTRIBUTES (Bonding Curve)                  │
│     Early supporters get better prices                     │
│     Funds locked in escrow                                 │
│                                                             │
│  3. THRESHOLD REACHED → AUTO-DEPLOY                        │
│     Liquidity deployed to ALL registered DEXs at once      │
│     70% to current DEXs, 30% held in reserve               │
│                                                             │
│  4. NEW DEXs REGISTER → RESERVE DEPLOYS                    │
│     Future DEXs automatically get liquidity from reserve   │
│     No action needed from creator                          │
│                                                             │
│  5. CONTRIBUTORS CLAIM LP TOKENS                           │
│     Tokens tradeable on all DEXs                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Innovation: The Reserve System

Unlike other launchpads, ATHEON doesn't deploy all liquidity at once:

| At Launch | Future DEX Registrations |
|-----------|-------------------------|
| 70% → Deployed to current DEXs | 30% → Held in reserve |
| | New DEX registers → Auto-deploys from reserve |
| | No creator action needed |
| | Fair distribution over time |

**Why?** New DEXs can register AFTER the launch. The reserve ensures they automatically receive liquidity without the creator taking any action.

---

## How It Works

### For Token Creators

```
Create Token → Configure Launch → Deposit Tokens
                    ↓
         Community contributes CKB
                    ↓
         Threshold reached → Auto-deploy
                    ↓
         Receive raised CKB (minus fees)
```

**No upfront CKB needed** - You only deposit your tokens.

### For Investors

```
Browse Launches → Contribute CKB → Get Receipt
                    ↓
         Threshold reached
                    ↓
         Claim LP Tokens → Trade or Earn Fees
```

**Early supporter advantage** - Bonding curve rewards early contributors with better prices.

### For DEX Operators

```
Deploy DEX Pool → Register with ATHEON
                    ↓
         Automatically receive liquidity
         from ALL new launches
                    ↓
         Earn trading fees
```

**Passive liquidity acquisition** - Your DEX gets new tokens without manual work.

---

## Current Status

| Component | Status |
|-----------|--------|
| Protocol Design | ✅ Complete |
| Devnet Setup | ✅ Complete |
| SDK | ✅ Complete |
| DEX Pool Contract | 🟡 In Progress |
| DEX Registry | 🔴 Not Started |
| Launchpad Contract | 🔴 Not Started |

---

## Quick Start

```bash
# Install dependencies
npm install

# Start devnet
npm run devnet

# Deploy contracts
npm run deploy
```

---

**ATHEON Protocol**

*Built on Nervos CKB*
