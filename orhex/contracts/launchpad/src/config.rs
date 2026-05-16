#![allow(dead_code)]

use ckb_std::high_level::load_cell_data;
use ckb_std::ckb_constants::Source;

pub const LAUNCH_DATA_SIZE: usize = 512;

pub const PRICE_MULTIPLIER_DISCOUNT: u16 = 95;
pub const PRICE_MULTIPLIER_BASELINE: u16 = 100;
pub const PRICE_MULTIPLIER_PREMIUM: u16 = 105;

pub const STATUS_PENDING: u8 = 0;
pub const STATUS_ACTIVE: u8 = 1;
pub const STATUS_SUCCESS: u8 = 2;
pub const STATUS_EXPIRED: u8 = 3;
pub const STATUS_CANCELLED: u8 = 4;

#[repr(C)]
#[derive(Debug)]
pub struct LaunchConfig {
    pub launch_id: [u8; 32],
    pub creator_lock_hash: [u8; 32],
    pub token_type_hash: [u8; 32],
    pub token_name: [u8; 32],
    pub token_symbol: [u8; 16],
    pub total_supply: u64,
    pub target_ckb: u64,
    pub max_ckb: u64,
    pub price_multiplier_bps: u16,
    pub status: u8,
    pub start_time: u64,
    pub end_time: u64,
    pub launch_offset: u64,
    pub total_contributed_ckb: u64,
    pub total_tokens_allocated: u64,
    pub contributor_count: u64,
    pub dex_script_hash: [u8; 32],
    pub registry_entry_hash: [u8; 32],
    pub stake_ckb: u64,
    pub fee_bps: u16,
    pub reserved: [u8; 98],
}

impl LaunchConfig {
    pub fn new(
        launch_id: [u8; 32],
        creator_lock_hash: [u8; 32],
        token_type_hash: [u8; 32],
        token_name: [u8; 32],
        token_symbol: [u8; 16],
        total_supply: u64,
        target_ckb: u64,
        max_ckb: u64,
        price_multiplier_bps: u16,
        start_time: u64,
        end_time: u64,
        dex_script_hash: [u8; 32],
    ) -> Self {
        Self {
            launch_id,
            creator_lock_hash,
            token_type_hash,
            token_name,
            token_symbol,
            total_supply,
            target_ckb,
            max_ckb,
            price_multiplier_bps,
            status: STATUS_PENDING,
            start_time,
            end_time,
            launch_offset: 0,
            total_contributed_ckb: 0,
            total_tokens_allocated: 0,
            contributor_count: 0,
            dex_script_hash,
            registry_entry_hash: [0u8; 32],
            stake_ckb: 0,
            fee_bps: 30,
            reserved: [0u8; 98],
        }
    }

    pub fn to_bytes(&self) -> [u8; LAUNCH_DATA_SIZE] {
        let mut bytes = [0u8; LAUNCH_DATA_SIZE];
        bytes[0..32].copy_from_slice(&self.launch_id);
        bytes[32..64].copy_from_slice(&self.creator_lock_hash);
        bytes[64..96].copy_from_slice(&self.token_type_hash);
        bytes[96..128].copy_from_slice(&self.token_name);
        bytes[128..144].copy_from_slice(&self.token_symbol);
        bytes[144..152].copy_from_slice(&self.total_supply.to_le_bytes());
        bytes[152..160].copy_from_slice(&self.target_ckb.to_le_bytes());
        bytes[160..168].copy_from_slice(&self.max_ckb.to_le_bytes());
        bytes[168..170].copy_from_slice(&self.price_multiplier_bps.to_le_bytes());
        bytes[170] = self.status;
        bytes[171..179].copy_from_slice(&self.start_time.to_le_bytes());
        bytes[179..187].copy_from_slice(&self.end_time.to_le_bytes());
        bytes[187..195].copy_from_slice(&self.launch_offset.to_le_bytes());
        bytes[195..203].copy_from_slice(&self.total_contributed_ckb.to_le_bytes());
        bytes[203..211].copy_from_slice(&self.total_tokens_allocated.to_le_bytes());
        bytes[211..219].copy_from_slice(&self.contributor_count.to_le_bytes());
        bytes[219..251].copy_from_slice(&self.dex_script_hash);
        bytes[251..283].copy_from_slice(&self.registry_entry_hash);
        bytes[283..291].copy_from_slice(&self.stake_ckb.to_le_bytes());
        bytes[291..293].copy_from_slice(&self.fee_bps.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() != LAUNCH_DATA_SIZE {
            return Err("Invalid launch config length");
        }

        let mut launch_id = [0u8; 32];
        launch_id.copy_from_slice(&bytes[0..32]);

        let mut creator_lock_hash = [0u8; 32];
        creator_lock_hash.copy_from_slice(&bytes[32..64]);

        let mut token_type_hash = [0u8; 32];
        token_type_hash.copy_from_slice(&bytes[64..96]);

        let mut token_name = [0u8; 32];
        token_name.copy_from_slice(&bytes[96..128]);

        let mut token_symbol = [0u8; 16];
        token_symbol.copy_from_slice(&bytes[128..144]);

        let total_supply = u64::from_le_bytes(bytes[144..152].try_into().unwrap());
        let target_ckb = u64::from_le_bytes(bytes[152..160].try_into().unwrap());
        let max_ckb = u64::from_le_bytes(bytes[160..168].try_into().unwrap());
        let price_multiplier_bps = u16::from_le_bytes(bytes[168..170].try_into().unwrap());
        let status = bytes[170];
        let start_time = u64::from_le_bytes(bytes[171..179].try_into().unwrap());
        let end_time = u64::from_le_bytes(bytes[179..187].try_into().unwrap());
        let launch_offset = u64::from_le_bytes(bytes[187..195].try_into().unwrap());
        let total_contributed_ckb = u64::from_le_bytes(bytes[195..203].try_into().unwrap());
        let total_tokens_allocated = u64::from_le_bytes(bytes[203..211].try_into().unwrap());
        let contributor_count = u64::from_le_bytes(bytes[211..219].try_into().unwrap());

        let mut dex_script_hash = [0u8; 32];
        dex_script_hash.copy_from_slice(&bytes[219..251]);

        let mut registry_entry_hash = [0u8; 32];
        registry_entry_hash.copy_from_slice(&bytes[251..283]);

        let stake_ckb = u64::from_le_bytes(bytes[283..291].try_into().unwrap());
        let fee_bps = u16::from_le_bytes(bytes[291..293].try_into().unwrap());

        Ok(Self {
            launch_id,
            creator_lock_hash,
            token_type_hash,
            token_name,
            token_symbol,
            total_supply,
            target_ckb,
            max_ckb,
            price_multiplier_bps,
            status,
            start_time,
            end_time,
            launch_offset,
            total_contributed_ckb,
            total_tokens_allocated,
            contributor_count,
            dex_script_hash,
            registry_entry_hash,
            stake_ckb,
            fee_bps,
            reserved: [0u8; 98],
        })
    }

    pub fn is_active(&self) -> bool {
        self.status == STATUS_ACTIVE
    }

    pub fn is_success(&self) -> bool {
        self.status == STATUS_SUCCESS
    }

    pub fn is_expired(&self) -> bool {
        self.status == STATUS_EXPIRED
    }

    pub fn target_reached(&self) -> bool {
        self.total_contributed_ckb >= self.target_ckb
    }

    pub fn is_full(&self) -> bool {
        self.total_contributed_ckb >= self.max_ckb
    }
}

pub fn load_launch_config() -> Result<LaunchConfig, &'static str> {
    let data = load_cell_data(0, Source::GroupOutput)
        .map_err(|_| "Failed to load cell data")?;
    LaunchConfig::from_bytes(&data)
}
