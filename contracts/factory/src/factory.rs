use ckb_std::high_level::load_cell_data;
use ckb_std::ckb_constants::Source;

pub const FACTORY_DATA_SIZE: usize = 256;
pub const DEX_INSTANCE_SIZE: usize = 192;
pub const MAX_FACTORY_FEE_BPS: u16 = 1000;
pub const DEFAULT_FACTORY_FEE_BPS: u16 = 500;
pub const DEFAULT_CREATOR_FEE_BPS: u16 = 300;
pub const MIN_DEX_FEE_BPS: u16 = 10;
pub const MAX_DEX_FEE_BPS: u16 = 500;

#[repr(C)]
#[derive(Debug)]
pub struct FactoryData {
    pub owner_lock_hash: [u8; 32],
    pub factory_fee_bps: u16,
    pub dex_count: u64,
    pub total_fees_collected: u64,
    pub minimum_dex_fee_bps: u16,
    pub maximum_dex_fee_bps: u16,
    pub creation_fee_ckb: u64,
    pub total_creation_fees: u64,
    pub creator_fee_bps: u16,
    pub bump: u64,
    pub reserved: [u8; 152],
}

impl FactoryData {
    pub fn new(owner_lock_hash: [u8; 32], factory_fee_bps: u16, creation_fee_ckb: u64, creator_fee_bps: u16) -> Self {
        Self {
            owner_lock_hash,
            factory_fee_bps,
            dex_count: 0,
            total_fees_collected: 0,
            minimum_dex_fee_bps: MIN_DEX_FEE_BPS,
            maximum_dex_fee_bps: MAX_DEX_FEE_BPS,
            creation_fee_ckb,
            total_creation_fees: 0,
            creator_fee_bps,
            bump: 0,
            reserved: [0u8; 152],
        }
    }

    pub fn to_bytes(&self) -> [u8; FACTORY_DATA_SIZE] {
        let mut bytes = [0u8; FACTORY_DATA_SIZE];
        bytes[0..32].copy_from_slice(&self.owner_lock_hash);
        bytes[40..42].copy_from_slice(&self.factory_fee_bps.to_le_bytes());
        bytes[48..56].copy_from_slice(&self.dex_count.to_le_bytes());
        bytes[56..64].copy_from_slice(&self.total_fees_collected.to_le_bytes());
        bytes[64..66].copy_from_slice(&self.minimum_dex_fee_bps.to_le_bytes());
        bytes[72..74].copy_from_slice(&self.maximum_dex_fee_bps.to_le_bytes());
        bytes[80..88].copy_from_slice(&self.creation_fee_ckb.to_le_bytes());
        bytes[88..96].copy_from_slice(&self.total_creation_fees.to_le_bytes());
        bytes[96..98].copy_from_slice(&self.creator_fee_bps.to_le_bytes());
        bytes[104..112].copy_from_slice(&self.bump.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() != FACTORY_DATA_SIZE {
            return Err("Invalid factory data length");
        }
        let mut owner_lock_hash = [0u8; 32];
        owner_lock_hash.copy_from_slice(&bytes[0..32]);
        let factory_fee_bps = u16::from_le_bytes(bytes[40..42].try_into().unwrap());
        let dex_count = u64::from_le_bytes(bytes[48..56].try_into().unwrap());
        let total_fees_collected = u64::from_le_bytes(bytes[56..64].try_into().unwrap());
        let minimum_dex_fee_bps = u16::from_le_bytes(bytes[64..66].try_into().unwrap());
        let maximum_dex_fee_bps = u16::from_le_bytes(bytes[72..74].try_into().unwrap());
        let creation_fee_ckb = u64::from_le_bytes(bytes[80..88].try_into().unwrap());
        let total_creation_fees = u64::from_le_bytes(bytes[88..96].try_into().unwrap());
        let creator_fee_bps = u16::from_le_bytes(bytes[96..98].try_into().unwrap());
        let bump = u64::from_le_bytes(bytes[104..112].try_into().unwrap());
        Ok(Self {
            owner_lock_hash, factory_fee_bps, dex_count, total_fees_collected,
            minimum_dex_fee_bps, maximum_dex_fee_bps, creation_fee_ckb,
            total_creation_fees, creator_fee_bps, bump, reserved: [0u8; 152],
        })
    }

    pub fn calculate_factory_fee(&self, dex_fee_bps: u16) -> u16 {
        (dex_fee_bps as u32 * self.factory_fee_bps as u32 / 10000) as u16
    }

    pub fn calculate_creator_fee(&self, dex_fee_bps: u16) -> u16 {
        (dex_fee_bps as u32 * self.creator_fee_bps as u32 / 10000) as u16
    }

    pub fn calculate_lp_fee(&self, dex_fee_bps: u16) -> u16 {
        dex_fee_bps - self.calculate_factory_fee(dex_fee_bps) - self.calculate_creator_fee(dex_fee_bps)
    }

    pub fn get_fee_breakdown(&self, dex_fee_bps: u16) -> (u16, u16, u16) {
        (self.calculate_factory_fee(dex_fee_bps), self.calculate_creator_fee(dex_fee_bps), self.calculate_lp_fee(dex_fee_bps))
    }

    pub fn validate_dex_fee(&self, fee_bps: u16) -> bool {
        fee_bps >= self.minimum_dex_fee_bps && fee_bps <= self.maximum_dex_fee_bps
    }
}

#[repr(C)]
#[derive(Debug)]
pub struct DexInstanceData {
    pub dex_id: [u8; 32],
    pub dex_name_hash: [u8; 32],
    pub owner_lock_hash: [u8; 32],
    pub dex_fee_bps: u16,
    pub factory_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub lp_fee_bps: u16,
    pub pool_count: u64,
    pub total_volume: u64,
    pub total_fees_paid: u64,
    pub status: u8,
    pub bump: u64,
    pub reserved: [u8; 160],
}

impl DexInstanceData {
    pub fn new(dex_id: [u8; 32], owner_lock_hash: [u8; 32], dex_fee_bps: u16) -> Self {
        Self {
            dex_id, dex_name_hash: [0u8; 32], owner_lock_hash,
            dex_fee_bps, factory_fee_bps: 0, creator_fee_bps: 0, lp_fee_bps: 0,
            pool_count: 0, total_volume: 0, total_fees_paid: 0,
            status: 0, bump: 0, reserved: [0u8; 160],
        }
    }

    pub fn to_bytes(&self) -> [u8; DEX_INSTANCE_SIZE] {
        let mut bytes = [0u8; DEX_INSTANCE_SIZE];
        bytes[0..32].copy_from_slice(&self.dex_id);
        bytes[32..64].copy_from_slice(&self.dex_name_hash);
        bytes[64..96].copy_from_slice(&self.owner_lock_hash);
        bytes[96..98].copy_from_slice(&self.dex_fee_bps.to_le_bytes());
        bytes[104..112].copy_from_slice(&self.total_volume.to_le_bytes());
        bytes[168] = self.status;
        bytes[248..256].copy_from_slice(&self.bump.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() != DEX_INSTANCE_SIZE {
            return Err("Invalid DEX instance data length");
        }
        let mut dex_id = [0u8; 32];
        let mut dex_name_hash = [0u8; 32];
        let mut owner_lock_hash = [0u8; 32];
        dex_id.copy_from_slice(&bytes[0..32]);
        dex_name_hash.copy_from_slice(&bytes[32..64]);
        owner_lock_hash.copy_from_slice(&bytes[64..96]);
        let dex_fee_bps = u16::from_le_bytes(bytes[96..98].try_into().unwrap());
        let total_volume = u64::from_le_bytes(bytes[104..112].try_into().unwrap());
        let status = bytes[168];
        let bump = u64::from_le_bytes(bytes[248..256].try_into().unwrap());
        Ok(Self {
            dex_id, dex_name_hash, owner_lock_hash, dex_fee_bps,
            factory_fee_bps: 0, creator_fee_bps: 0, lp_fee_bps: 0,
            pool_count: 0, total_volume, total_fees_paid: 0,
            status, bump, reserved: [0u8; 160],
        })
    }
}

pub fn load_factory_data() -> Result<FactoryData, &'static str> {
    let data = load_cell_data(0, Source::GroupOutput).map_err(|_| "Failed to load cell data")?;
    FactoryData::from_bytes(&data)
}

pub fn load_dex_instance_data() -> Result<DexInstanceData, &'static str> {
    let data = load_cell_data(0, Source::GroupOutput).map_err(|_| "Failed to load cell data")?;
    DexInstanceData::from_bytes(&data)
}
