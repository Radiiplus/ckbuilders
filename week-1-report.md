## Builder Track Weekly Report — Week 1

**Name:** Positive Vibes  
**Week Ending:** April 1, 2026

### Courses Completed

- Completed **Summary 1** of the CKB Academy course
- Currently transitioning into **Summary 2**
- Key topics covered:
  - Nervos CKB architecture and cell model
  - Transaction structure and validation
  - Lock scripts and type scripts
  - xUDT token standard

### Key Learnings

- **Cell Model**: Understanding how CKB's cell-based storage differs from account-based models
- **Transaction Flow**: How inputs, outputs, and witnesses work together in CKB transactions
- **Script System**: The role of lock scripts (ownership) vs type scripts (validation logic)
- **Development Workflow**: How to set up devnet, deploy contracts, and interact with the chain

### Practical Progress

**Project: ATHEON Protocol - Decentralized Token Launchpad**

Built the foundation for a token launchpad with automatic DEX deployment:

- **Devnet Infrastructure**:
  - Automated devnet setup scripts (start, fund wallets, deploy)
  - Multi-wallet management system
  - Faucet for funding test accounts

- **Smart Contract Structure**:
  - Created 3 contract repositories:
    - `contracts/factory/` - DEX Factory
    - `contracts/pool/` - DEX Pool (x*y=k AMM)
    - `contracts/registry/` - DEX Registry
  - Set up Rust project structure for RISC-V compilation

- **TypeScript SDK**:
  - `sdk/dex.ts` - Pool interaction utilities (swap calculations, LP token math)
  - `sdk/factory.ts` - Factory client with transaction building

- **Documentation**:
  - Protocol specifications for all 3 components
  - Architecture diagrams and flow documentation
  - Project README explaining the core concept

- **Repository**:
  - Code pushed to GitHub: https://github.com/Radiiplus/ckbuilders

### Environment

- **CKB Devnet**: Running locally with automated scripts
- **Rust & Cargo**: Installed and configured for RISC-V target
- **Node.js**: Development environment set up
- **CLI Tools**: offckb, CCC SDK integrated into build scripts

### Next Week Goals

1. Complete **Summary 2** of CKB Academy
2. Implement the DEX Pool contract (x*y=k AMM logic)
3. Write unit tests for pool operations
4. Begin DEX Registry contract structure
