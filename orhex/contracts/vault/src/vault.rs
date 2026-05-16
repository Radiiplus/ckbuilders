use ckb_std::high_level::load_cell_data;
use ckb_std::high_level::load_cell_type_hash;
use ckb_std::ckb_constants::Source;

pub const VAULT_DATA_SIZE: usize = 512;

// --- Source tags for deposits ---
pub const VAULT_SOURCE_DEPOSIT:  u8 = 1;  // user deposits to seed pool liquidity
pub const VAULT_SOURCE_LAUNCH:   u8 = 2;  // launchpad bonding curve proceeds
pub const VAULT_SOURCE_FEE:     u8 = 3;  // swap fees collected from pools

// --- Operation modes ---
pub const VAULT_OP_INITIALIZE:  u8 = 0;
pub const VAULT_OP_DEPOSIT:     u8 = 1;
pub const VAULT_OP_WITHDRAW:    u8 = 2;
pub const VAULT_OP_DISTRIBUTE:  u8 = 3;
pub const VAULT_OP_COLLECT:     u8 = 4;
pub const VAULT_OP_SEED_POOL:   u8 = 5;
pub const VAULT_OP_UPDATE:      u8 = 6;

#[repr(C)]
#[derive(Clone)]
#[derive(Debug)]
pub struct VaultData {
    // --- Admin (owner can update params, change registered contracts) ---
    pub owner_lock_hash: [u8; 32],

    // --- Registered contract Type IDs (set during init, updated by owner) ---
    pub factory_type_id: [u8; 20],     // factory contract Type ID
    pub launchpad_type_id: [u8; 20],   // launchpad contract Type ID
    pub registry_type_id: [u8; 20],    // registry contract Type ID

    // --- Global accounting ---
    pub total_deposited_ckb: u64,       // total CKB users deposited
    pub total_withdrawn_ckb: u64,       // total CKB withdrawn
    pub total_shares_issued: u64,       // total LP-style shares minted
    pub total_shares_burned: u64,       // total shares burned on withdrawal

    // --- Three-pot model ---
    // Pot 1: Stage Fund — capital ready to seed new pools (user deposits)
    pub stage_fund_balance: u64,
    pub stage_fund_pool_count: u64,     // how many pools seeded

    // Pot 2: Accumulator — launchpad bonding curve proceeds
    pub accumulator_balance: u64,
    pub accumulator_launch_count: u64,  // how many launches accumulated

    // Pot 3: Fee Router — swap fees from all pools
    pub fee_router_balance: u64,
    pub fee_router_distributed: u64,   // fees already distributed

    // --- Revenue tracking ---
    pub total_revenue_ckb: u64,         // sum of all inbound flows
    pub total_outbound_ckb: u64,        // sum of all outbound flows

    // --- Pool seeding metadata ---
    pub last_pool_seed_ckb: u64,        // CKB used to seed last pool
    pub last_pool_seed_timestamp: u64,  // when last pool was seeded

    // --- Fee distribution ---
    pub last_distribution_timestamp: u64,
    pub pending_distribution_ckb: u64,  // fees queued for next distribution

    // --- Status & padding ---
    pub status: u8,
    pub bump: u64,
    pub reserved: [u8; 202],
}

impl VaultData {
    pub fn new(owner_lock_hash: [u8; 32], factory_type_id: [u8; 20], launchpad_type_id: [u8; 20], registry_type_id: [u8; 20]) -> Self {
        Self {
            owner_lock_hash,
            factory_type_id,
            launchpad_type_id,
            registry_type_id,
            total_deposited_ckb: 0,
            total_withdrawn_ckb: 0,
            total_shares_issued: 0,
            total_shares_burned: 0,
            stage_fund_balance: 0,
            stage_fund_pool_count: 0,
            accumulator_balance: 0,
            accumulator_launch_count: 0,
            fee_router_balance: 0,
            fee_router_distributed: 0,
            total_revenue_ckb: 0,
            total_outbound_ckb: 0,
            last_pool_seed_ckb: 0,
            last_pool_seed_timestamp: 0,
            last_distribution_timestamp: 0,
            pending_distribution_ckb: 0,
            status: 0,
            bump: 0,
            reserved: [0u8; 202],
        }
    }

    pub fn to_bytes(&self) -> [u8; VAULT_DATA_SIZE] {
        let mut bytes = [0u8; VAULT_DATA_SIZE];
        // Owner (32 bytes)
        bytes[0..32].copy_from_slice(&self.owner_lock_hash);
        // Registered contract Type IDs (20 bytes each = 60 bytes)
        bytes[32..52].copy_from_slice(&self.factory_type_id);
        bytes[52..72].copy_from_slice(&self.launchpad_type_id);
        bytes[72..92].copy_from_slice(&self.registry_type_id);
        // Global accounting (32 bytes)
        bytes[92..100].copy_from_slice(&self.total_deposited_ckb.to_le_bytes());
        bytes[100..108].copy_from_slice(&self.total_withdrawn_ckb.to_le_bytes());
        bytes[108..116].copy_from_slice(&self.total_shares_issued.to_le_bytes());
        bytes[116..124].copy_from_slice(&self.total_shares_burned.to_le_bytes());
        // Stage Fund (16 bytes)
        bytes[124..132].copy_from_slice(&self.stage_fund_balance.to_le_bytes());
        bytes[132..140].copy_from_slice(&self.stage_fund_pool_count.to_le_bytes());
        // Accumulator (16 bytes)
        bytes[140..148].copy_from_slice(&self.accumulator_balance.to_le_bytes());
        bytes[148..156].copy_from_slice(&self.accumulator_launch_count.to_le_bytes());
        // Fee Router (16 bytes)
        bytes[156..164].copy_from_slice(&self.fee_router_balance.to_le_bytes());
        bytes[164..172].copy_from_slice(&self.fee_router_distributed.to_le_bytes());
        // Revenue tracking (16 bytes)
        bytes[172..180].copy_from_slice(&self.total_revenue_ckb.to_le_bytes());
        bytes[180..188].copy_from_slice(&self.total_outbound_ckb.to_le_bytes());
        // Pool seeding (16 bytes)
        bytes[188..196].copy_from_slice(&self.last_pool_seed_ckb.to_le_bytes());
        bytes[196..204].copy_from_slice(&self.last_pool_seed_timestamp.to_le_bytes());
        // Fee distribution (16 bytes)
        bytes[204..212].copy_from_slice(&self.last_distribution_timestamp.to_le_bytes());
        bytes[212..220].copy_from_slice(&self.pending_distribution_ckb.to_le_bytes());
        // Status & bump (9 bytes)
        bytes[220] = self.status;
        bytes[248..256].copy_from_slice(&self.bump.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() != VAULT_DATA_SIZE {
            return Err("Invalid vault data length");
        }
        let mut owner_lock_hash = [0u8; 32];
        owner_lock_hash.copy_from_slice(&bytes[0..32]);
        let mut factory_type_id = [0u8; 20];
        factory_type_id.copy_from_slice(&bytes[32..52]);
        let mut launchpad_type_id = [0u8; 20];
        launchpad_type_id.copy_from_slice(&bytes[52..72]);
        let mut registry_type_id = [0u8; 20];
        registry_type_id.copy_from_slice(&bytes[72..92]);
        let total_deposited_ckb = u64::from_le_bytes(bytes[92..100].try_into().unwrap());
        let total_withdrawn_ckb = u64::from_le_bytes(bytes[100..108].try_into().unwrap());
        let total_shares_issued = u64::from_le_bytes(bytes[108..116].try_into().unwrap());
        let total_shares_burned = u64::from_le_bytes(bytes[116..124].try_into().unwrap());
        let stage_fund_balance = u64::from_le_bytes(bytes[124..132].try_into().unwrap());
        let stage_fund_pool_count = u64::from_le_bytes(bytes[132..140].try_into().unwrap());
        let accumulator_balance = u64::from_le_bytes(bytes[140..148].try_into().unwrap());
        let accumulator_launch_count = u64::from_le_bytes(bytes[148..156].try_into().unwrap());
        let fee_router_balance = u64::from_le_bytes(bytes[156..164].try_into().unwrap());
        let fee_router_distributed = u64::from_le_bytes(bytes[164..172].try_into().unwrap());
        let total_revenue_ckb = u64::from_le_bytes(bytes[172..180].try_into().unwrap());
        let total_outbound_ckb = u64::from_le_bytes(bytes[180..188].try_into().unwrap());
        let last_pool_seed_ckb = u64::from_le_bytes(bytes[188..196].try_into().unwrap());
        let last_pool_seed_timestamp = u64::from_le_bytes(bytes[196..204].try_into().unwrap());
        let last_distribution_timestamp = u64::from_le_bytes(bytes[204..212].try_into().unwrap());
        let pending_distribution_ckb = u64::from_le_bytes(bytes[212..220].try_into().unwrap());
        let status = bytes[220];
        let bump = u64::from_le_bytes(bytes[248..256].try_into().unwrap());
        Ok(Self {
            owner_lock_hash, factory_type_id, launchpad_type_id, registry_type_id,
            total_deposited_ckb, total_withdrawn_ckb,
            total_shares_issued, total_shares_burned,
            stage_fund_balance, stage_fund_pool_count,
            accumulator_balance, accumulator_launch_count,
            fee_router_balance, fee_router_distributed,
            total_revenue_ckb, total_outbound_ckb,
            last_pool_seed_ckb, last_pool_seed_timestamp,
            last_distribution_timestamp, pending_distribution_ckb,
            status, bump, reserved: [0u8; 202],
        })
    }

    /// Check if the given Type ID matches a registered contract.
    pub fn is_factory(&self, type_id: &[u8; 20]) -> bool {
        self.factory_type_id == *type_id
    }

    pub fn is_launchpad(&self, type_id: &[u8; 20]) -> bool {
        self.launchpad_type_id == *type_id
    }

    pub fn is_registered_pool(&self, _type_id: &[u8; 20]) -> bool {
        // Pool Type IDs are dynamic — we trust the factory to only register valid pools.
        // For now, accept any pool that sends fees with proper source tagging.
        // In production, the registry would maintain a whitelist.
        true
    }

    /// Mint shares for a depositor. Returns the number of shares minted.
    /// First deposit gets 1:1 shares; later deposits use proportional minting.
    pub fn mint_shares(&mut self, ckb_amount: u64) -> Result<u64, &'static str> {
        if ckb_amount == 0 {
            return Err("Deposit amount must be positive");
        }
        let shares = if self.total_shares_issued == 0 {
            // First deposit: 1:1 ratio
            ckb_amount
        } else {
            // Proportional: shares = ckb * total_shares / total_value
            let total_value = self.available_value().ok_or("Overflow in available_value")?;
            if total_value == 0 {
                return Err("Vault has no available value");
            }
            (ckb_amount as u128 * self.total_shares_issued as u128 / total_value as u128) as u64
        };
        if shares == 0 {
            return Err("Deposit too small to mint shares");
        }
        self.total_shares_issued = self.total_shares_issued.checked_add(shares)
            .ok_or("Share supply overflow")?;
        self.total_deposited_ckb = self.total_deposited_ckb.checked_add(ckb_amount)
            .ok_or("Deposit overflow")?;
        self.total_revenue_ckb = self.total_revenue_ckb.checked_add(ckb_amount)
            .ok_or("Revenue overflow")?;
        Ok(shares)
    }

    /// Burn shares and return the corresponding CKB amount.
    pub fn burn_shares(&mut self, shares: u64) -> Result<u64, &'static str> {
        if shares == 0 || shares > self.total_shares_issued {
            return Err("Invalid share amount");
        }
        let total_value = self.available_value().ok_or("Overflow in available_value")?;
        if total_value == 0 {
            return Err("Vault is empty");
        }
        let ckb_amount = (shares as u128 * total_value as u128 / self.total_shares_issued as u128) as u64;
        if ckb_amount == 0 {
            return Err("Shares too small to withdraw");
        }
        self.total_shares_issued = self.total_shares_issued.checked_sub(shares)
            .ok_or("Share supply underflow")?;
        self.total_shares_burned = self.total_shares_burned.checked_add(shares)
            .ok_or("Share burn overflow")?;
        self.total_withdrawn_ckb = self.total_withdrawn_ckb.checked_add(ckb_amount)
            .ok_or("Withdrawal overflow")?;
        self.total_outbound_ckb = self.total_outbound_ckb.checked_add(ckb_amount)
            .ok_or("Outbound overflow")?;
        Ok(ckb_amount)
    }

    /// Total CKB value available across all three pots.
    pub fn available_value(&self) -> Option<u64> {
        self.stage_fund_balance
            .checked_add(self.accumulator_balance)?
            .checked_add(self.fee_router_balance)
    }

    /// Route incoming funds to the correct pot.
    pub fn route_funds(&mut self, source: u8, amount: u64) -> Result<(), &'static str> {
        if amount == 0 {
            return Err("Amount must be positive");
        }
        self.total_revenue_ckb = self.total_revenue_ckb.checked_add(amount)
            .ok_or("Revenue overflow")?;
        match source {
            VAULT_SOURCE_DEPOSIT => {
                self.stage_fund_balance = self.stage_fund_balance.checked_add(amount)
                    .ok_or("Stage fund overflow")?;
            }
            VAULT_SOURCE_LAUNCH => {
                self.accumulator_balance = self.accumulator_balance.checked_add(amount)
                    .ok_or("Accumulator overflow")?;
                self.accumulator_launch_count += 1;
            }
            VAULT_SOURCE_FEE => {
                self.fee_router_balance = self.fee_router_balance.checked_add(amount)
                    .ok_or("Fee router overflow")?;
                self.pending_distribution_ckb = self.pending_distribution_ckb.checked_add(amount)
                    .ok_or("Pending distribution overflow")?;
            }
            _ => return Err("Unknown source tag"),
        }
        Ok(())
    }

    /// Allocate stage fund capital to seed a new pool.
    pub fn seed_pool(&mut self, amount: u64, timestamp: u64) -> Result<(), &'static str> {
        if amount == 0 {
            return Err("Seed amount must be positive");
        }
        if amount > self.stage_fund_balance {
            return Err("Insufficient stage fund balance");
        }
        self.stage_fund_balance = self.stage_fund_balance.checked_sub(amount)
            .ok_or("Stage fund underflow")?;
        self.stage_fund_pool_count += 1;
        self.last_pool_seed_ckb = amount;
        self.last_pool_seed_timestamp = timestamp;
        self.total_outbound_ckb = self.total_outbound_ckb.checked_add(amount)
            .ok_or("Outbound overflow")?;
        Ok(())
    }

    /// Distribute accumulated fees to share holders.
    pub fn distribute_fees(&mut self, timestamp: u64) -> Result<u64, &'static str> {
        if self.pending_distribution_ckb == 0 {
            return Err("No fees pending distribution");
        }
        let amount = self.pending_distribution_ckb;
        self.pending_distribution_ckb = 0;
        self.fee_router_distributed = self.fee_router_distributed.checked_add(amount)
            .ok_or("Fee distribution overflow")?;
        self.last_distribution_timestamp = timestamp;
        self.total_outbound_ckb = self.total_outbound_ckb.checked_add(amount)
            .ok_or("Outbound overflow")?;
        Ok(amount)
    }

    /// Share price in CKB per share (0 if no shares exist).
    pub fn share_price(&self) -> Option<u64> {
        if self.total_shares_issued == 0 {
            return Some(0);
        }
        let total_value = self.available_value()?;
        Some(total_value / self.total_shares_issued)
    }
}

pub fn load_vault_data() -> Result<VaultData, &'static str> {
    let data = load_cell_data(0, Source::GroupOutput).map_err(|_| "Failed to load cell data")?;
    VaultData::from_bytes(&data)
}

/// Get the Type ID of the caller's contract (first input cell's type hash).
/// Returns None if the caller is a native CKB cell (no type script).
pub fn get_caller_type_id() -> Option<[u8; 20]> {
    match load_cell_type_hash(0, Source::Input) {
        Ok(Some(hash)) => {
            // Type hash is 32 bytes, Type ID args are the first 20 bytes
            let mut type_id = [0u8; 20];
            type_id.copy_from_slice(&hash[0..20]);
            Some(type_id)
        }
        Ok(None) | Err(_) => None,
    }
}
