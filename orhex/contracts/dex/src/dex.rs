#![allow(dead_code)]

use ckb_std::high_level::load_cell_data;
use ckb_std::ckb_constants::Source;

pub const DEX_DATA_SIZE: usize = 256;
pub const DEX_FEE_BPS: u16 = 30;
pub const MIN_POOL_CKB: u64 = 100_000_000;

#[repr(C)]
#[derive(Debug)]
pub struct DexData {
    pub dex_name_hash: [u8; 32],
    pub owner_lock_hash: [u8; 32],
    pub dex_name: [u8; 32],
    pub description_hash: [u8; 32],
    pub factory_script_hash: [u8; 32],
    pub registry_entry_hash: [u8; 32],
    pub pool_count: u64,
    pub total_volume: u64,
    pub total_trades: u64,
    pub total_fees_collected: u64,
    pub dex_fee_bps: u16,
    pub status: u8,
    pub created_at: u64,
    pub last_activity_at: u64,
    pub bump: u64,
    pub reserved: [u8; 88],
}

impl DexData {
    pub fn new(
        dex_name_hash: [u8; 32],
        owner_lock_hash: [u8; 32],
        dex_name: [u8; 32],
        factory_script_hash: [u8; 32],
    ) -> Self {
        Self {
            dex_name_hash,
            owner_lock_hash,
            dex_name,
            description_hash: [0u8; 32],
            factory_script_hash,
            registry_entry_hash: [0u8; 32],
            pool_count: 0,
            total_volume: 0,
            total_trades: 0,
            total_fees_collected: 0,
            dex_fee_bps: DEX_FEE_BPS,
            status: 0,
            created_at: 0,
            last_activity_at: 0,
            bump: 0,
            reserved: [0u8; 88],
        }
    }

    pub fn to_bytes(&self) -> [u8; DEX_DATA_SIZE] {
        let mut bytes = [0u8; DEX_DATA_SIZE];
        bytes[0..32].copy_from_slice(&self.dex_name_hash);
        bytes[32..64].copy_from_slice(&self.owner_lock_hash);
        bytes[64..96].copy_from_slice(&self.dex_name);
        bytes[96..128].copy_from_slice(&self.description_hash);
        bytes[128..160].copy_from_slice(&self.factory_script_hash);
        bytes[160..192].copy_from_slice(&self.registry_entry_hash);
        bytes[192..200].copy_from_slice(&self.pool_count.to_le_bytes());
        bytes[200..208].copy_from_slice(&self.total_volume.to_le_bytes());
        bytes[208..216].copy_from_slice(&self.total_trades.to_le_bytes());
        bytes[216..224].copy_from_slice(&self.total_fees_collected.to_le_bytes());
        bytes[224..226].copy_from_slice(&self.dex_fee_bps.to_le_bytes());
        bytes[226] = self.status;
        bytes[227..235].copy_from_slice(&self.created_at.to_le_bytes());
        bytes[235..243].copy_from_slice(&self.last_activity_at.to_le_bytes());
        bytes[243..251].copy_from_slice(&self.bump.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() != DEX_DATA_SIZE {
            return Err("Invalid DEX data length");
        }

        let mut dex_name_hash = [0u8; 32];
        dex_name_hash.copy_from_slice(&bytes[0..32]);

        let mut owner_lock_hash = [0u8; 32];
        owner_lock_hash.copy_from_slice(&bytes[32..64]);

        let mut dex_name = [0u8; 32];
        dex_name.copy_from_slice(&bytes[64..96]);

        let mut description_hash = [0u8; 32];
        description_hash.copy_from_slice(&bytes[96..128]);

        let mut factory_script_hash = [0u8; 32];
        factory_script_hash.copy_from_slice(&bytes[128..160]);

        let mut registry_entry_hash = [0u8; 32];
        registry_entry_hash.copy_from_slice(&bytes[160..192]);

        let pool_count = u64::from_le_bytes(bytes[192..200].try_into().unwrap());
        let total_volume = u64::from_le_bytes(bytes[200..208].try_into().unwrap());
        let total_trades = u64::from_le_bytes(bytes[208..216].try_into().unwrap());
        let total_fees_collected = u64::from_le_bytes(bytes[216..224].try_into().unwrap());
        let dex_fee_bps = u16::from_le_bytes(bytes[224..226].try_into().unwrap());
        let status = bytes[226];
        let created_at = u64::from_le_bytes(bytes[227..235].try_into().unwrap());
        let last_activity_at = u64::from_le_bytes(bytes[235..243].try_into().unwrap());
        let bump = u64::from_le_bytes(bytes[243..251].try_into().unwrap());

        Ok(Self {
            dex_name_hash,
            owner_lock_hash,
            dex_name,
            description_hash,
            factory_script_hash,
            registry_entry_hash,
            pool_count,
            total_volume,
            total_trades,
            total_fees_collected,
            dex_fee_bps,
            status,
            created_at,
            last_activity_at,
            bump,
            reserved: [0u8; 88],
        })
    }

    pub fn increment_pool_count(&mut self) {
        self.pool_count = self.pool_count.saturating_add(1);
    }

    pub fn record_trade(&mut self, volume: u64, timestamp: u64) {
        self.total_trades = self.total_trades.saturating_add(1);
        self.total_volume = self.total_volume.saturating_add(volume);
        self.last_activity_at = timestamp;
    }

    pub fn record_fee(&mut self, fee: u64) {
        self.total_fees_collected = self.total_fees_collected.saturating_add(fee);
    }

    pub fn is_active(&self) -> bool {
        self.status == 0
    }

    pub fn set_registry_entry(&mut self, entry_hash: [u8; 32]) {
        self.registry_entry_hash = entry_hash;
    }
}

pub fn load_dex_data() -> Result<DexData, &'static str> {
    let data = load_cell_data(0, Source::GroupOutput)
        .map_err(|_| "Failed to load cell data")?;
    DexData::from_bytes(&data)
}

pub fn load_pool_data() -> Result<[u8; 152], &'static str> {
    let data = load_cell_data(1, Source::GroupOutput)
        .map_err(|_| "Failed to load pool data")?;
    if data.len() != 152 {
        return Err("Invalid pool data length");
    }
    let mut pool_data = [0u8; 152];
    pool_data.copy_from_slice(&data);
    Ok(pool_data)
}
