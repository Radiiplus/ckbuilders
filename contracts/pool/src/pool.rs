#![allow(dead_code)]

use ckb_std::high_level::load_cell_data;
use ckb_std::ckb_constants::Source;

pub const POOL_DATA_SIZE: usize = 152;
pub const MINIMUM_LIQUIDITY: u64 = 1_000;
pub const MAX_FEE_BPS: u64 = 1000;
pub const DEFAULT_FEE_BPS: u64 = 30;

#[repr(C)]
#[derive(Debug)]
pub struct PoolData {
    pub pool_id: [u8; 32],
    pub token_a_type_hash: [u8; 32],
    pub token_b_type_hash: [u8; 32],
    pub reserve_a: u64,
    pub reserve_b: u64,
    pub fee_bps: u64,
    pub lp_supply: u64,
    pub k_last: u64,
    pub bump: u64,
    pub created_at: u64,
}

impl PoolData {
    pub fn new(pool_id: [u8; 32], token_a: [u8; 32], token_b: [u8; 32], fee_bps: u64) -> Self {
        Self { pool_id, token_a_type_hash: token_a, token_b_type_hash: token_b,
            reserve_a: 0, reserve_b: 0, fee_bps, lp_supply: 0, k_last: 0, bump: 0, created_at: 0 }
    }

    pub fn to_bytes(&self) -> [u8; POOL_DATA_SIZE] {
        let mut bytes = [0u8; POOL_DATA_SIZE];
        bytes[0..32].copy_from_slice(&self.pool_id);
        bytes[32..64].copy_from_slice(&self.token_a_type_hash);
        bytes[64..96].copy_from_slice(&self.token_b_type_hash);
        bytes[96..104].copy_from_slice(&self.reserve_a.to_le_bytes());
        bytes[104..112].copy_from_slice(&self.reserve_b.to_le_bytes());
        bytes[112..120].copy_from_slice(&self.fee_bps.to_le_bytes());
        bytes[120..128].copy_from_slice(&self.lp_supply.to_le_bytes());
        bytes[128..136].copy_from_slice(&self.k_last.to_le_bytes());
        bytes[136..144].copy_from_slice(&self.bump.to_le_bytes());
        bytes[144..152].copy_from_slice(&self.created_at.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() != POOL_DATA_SIZE { return Err("Invalid pool data length"); }
        let mut pool_id = [0u8; 32];
        let mut token_a_type_hash = [0u8; 32];
        let mut token_b_type_hash = [0u8; 32];
        pool_id.copy_from_slice(&bytes[0..32]);
        token_a_type_hash.copy_from_slice(&bytes[32..64]);
        token_b_type_hash.copy_from_slice(&bytes[64..96]);
        let reserve_a = u64::from_le_bytes(bytes[96..104].try_into().unwrap());
        let reserve_b = u64::from_le_bytes(bytes[104..112].try_into().unwrap());
        let fee_bps = u64::from_le_bytes(bytes[112..120].try_into().unwrap());
        let lp_supply = u64::from_le_bytes(bytes[120..128].try_into().unwrap());
        let k_last = u64::from_le_bytes(bytes[128..136].try_into().unwrap());
        let bump = u64::from_le_bytes(bytes[136..144].try_into().unwrap());
        let created_at = u64::from_le_bytes(bytes[144..152].try_into().unwrap());
        Ok(Self { pool_id, token_a_type_hash, token_b_type_hash, reserve_a, reserve_b, fee_bps, lp_supply, k_last, bump, created_at })
    }

    pub fn is_initialized(&self) -> bool { self.reserve_a > 0 && self.reserve_b > 0 }
    pub fn calculate_k(&self) -> u128 { (self.reserve_a as u128) * (self.reserve_b as u128) }
}

pub fn load_pool_data() -> Result<PoolData, &'static str> {
    let data = load_cell_data(0, Source::GroupOutput).map_err(|_| "Failed to load cell data")?;
    PoolData::from_bytes(&data)
}
