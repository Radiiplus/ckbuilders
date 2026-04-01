// DEX Registry - Registry Data Structures
#![allow(dead_code)]

use ckb_std::high_level::load_cell_data;
use ckb_std::ckb_constants::Source;

pub const REGISTRY_DATA_SIZE: usize = 256;
pub const DEX_ENTRY_SIZE: usize = 320;
pub const LAUNCH_MODE_MANUAL: u8 = 0;
pub const LAUNCH_MODE_AUTO: u8 = 1;
pub const MANUAL_LAUNCH_FEE_BPS: u16 = 100;
pub const AUTO_LAUNCH_FEE_BPS: u16 = 300;
pub const ACTIVITY_CHECK_PERIOD: u64 = 2_592_000;
pub const MIN_TRADE_VOLUME_CKB: u64 = 10_000;
pub const MIN_TRADE_COUNT: u64 = 5;
pub const DEFAULT_CREATION_FEE_CKB: u64 = 5000;
pub const DEFAULT_RE_LISTING_FEE_CKB: u64 = 1000;
pub const DEFAULT_RESERVATION_FEE_CKB: u64 = 500;
pub const MAX_CREATION_FEE_CKB: u64 = 50_000;
pub const MAX_RE_LISTING_FEE_CKB: u64 = 10_000;
pub const MAX_RESERVATION_FEE_CKB: u64 = 5_000;
pub const MIN_CREATION_FEE_CKB: u64 = 100;
pub const MIN_RE_LISTING_FEE_CKB: u64 = 50;
pub const MIN_RESERVATION_FEE_CKB: u64 = 50;
pub const RESERVATION_DURATION: u64 = 2_592_000;
pub const GRACE_PERIOD_DURATION: u64 = 604_800;
pub const STATUS_RESERVED: u8 = 0;
pub const STATUS_ACTIVE: u8 = 1;
pub const STATUS_SUSPENDED: u8 = 2;
pub const STATUS_INACTIVE: u8 = 3;
pub const STATUS_EXPIRED_NO_POOL: u8 = 4;
pub const STATUS_EXPIRED_WITH_POOL: u8 = 5;
pub const STATUS_DELISTED_INACTIVE: u8 = 6;

#[repr(C)]
#[derive(Debug)]
pub struct RegistryData {
    pub owner_lock_hash: [u8; 32],
    pub creation_fee_ckb: u64,
    pub re_listing_fee_ckb: u64,
    pub reservation_fee_ckb: u64,
    pub total_registrations: u64,
    pub total_fees_collected: u64,
    pub manual_launch_fee_bps: u16,
    pub auto_launch_fee_bps: u16,
    pub activity_check_period: u64,
    pub min_trade_volume_ckb: u64,
    pub min_trade_count: u64,
    pub bump: u64,
    pub reserved: [u8; 136],
}

impl RegistryData {
    pub fn new(owner_lock_hash: [u8; 32]) -> Self {
        Self {
            owner_lock_hash,
            creation_fee_ckb: DEFAULT_CREATION_FEE_CKB,
            re_listing_fee_ckb: DEFAULT_RE_LISTING_FEE_CKB,
            reservation_fee_ckb: DEFAULT_RESERVATION_FEE_CKB,
            total_registrations: 0, total_fees_collected: 0,
            manual_launch_fee_bps: MANUAL_LAUNCH_FEE_BPS,
            auto_launch_fee_bps: AUTO_LAUNCH_FEE_BPS,
            activity_check_period: ACTIVITY_CHECK_PERIOD,
            min_trade_volume_ckb: MIN_TRADE_VOLUME_CKB,
            min_trade_count: MIN_TRADE_COUNT,
            bump: 0, reserved: [0u8; 136],
        }
    }

    pub fn to_bytes(&self) -> [u8; REGISTRY_DATA_SIZE] {
        let mut bytes = [0u8; REGISTRY_DATA_SIZE];
        bytes[0..32].copy_from_slice(&self.owner_lock_hash);
        bytes[32..40].copy_from_slice(&self.creation_fee_ckb.to_le_bytes());
        bytes[40..48].copy_from_slice(&self.re_listing_fee_ckb.to_le_bytes());
        bytes[48..56].copy_from_slice(&self.reservation_fee_ckb.to_le_bytes());
        bytes[56..64].copy_from_slice(&self.total_registrations.to_le_bytes());
        bytes[64..72].copy_from_slice(&self.total_fees_collected.to_le_bytes());
        bytes[72..74].copy_from_slice(&self.manual_launch_fee_bps.to_le_bytes());
        bytes[80..82].copy_from_slice(&self.auto_launch_fee_bps.to_le_bytes());
        bytes[88..96].copy_from_slice(&self.activity_check_period.to_le_bytes());
        bytes[96..104].copy_from_slice(&self.min_trade_volume_ckb.to_le_bytes());
        bytes[104..112].copy_from_slice(&self.min_trade_count.to_le_bytes());
        bytes[112..120].copy_from_slice(&self.bump.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() != REGISTRY_DATA_SIZE { return Err("Invalid registry data length"); }
        let mut owner_lock_hash = [0u8; 32];
        owner_lock_hash.copy_from_slice(&bytes[0..32]);
        let creation_fee_ckb = u64::from_le_bytes(bytes[32..40].try_into().unwrap());
        let re_listing_fee_ckb = u64::from_le_bytes(bytes[40..48].try_into().unwrap());
        let reservation_fee_ckb = u64::from_le_bytes(bytes[48..56].try_into().unwrap());
        let total_registrations = u64::from_le_bytes(bytes[56..64].try_into().unwrap());
        let total_fees_collected = u64::from_le_bytes(bytes[64..72].try_into().unwrap());
        let manual_launch_fee_bps = u16::from_le_bytes(bytes[72..74].try_into().unwrap());
        let auto_launch_fee_bps = u16::from_le_bytes(bytes[80..82].try_into().unwrap());
        let activity_check_period = u64::from_le_bytes(bytes[88..96].try_into().unwrap());
        let min_trade_volume_ckb = u64::from_le_bytes(bytes[96..104].try_into().unwrap());
        let min_trade_count = u64::from_le_bytes(bytes[104..112].try_into().unwrap());
        let bump = u64::from_le_bytes(bytes[112..120].try_into().unwrap());
        Ok(Self { owner_lock_hash, creation_fee_ckb, re_listing_fee_ckb, reservation_fee_ckb,
            total_registrations, total_fees_collected, manual_launch_fee_bps, auto_launch_fee_bps,
            activity_check_period, min_trade_volume_ckb, min_trade_count, bump, reserved: [0u8; 136] })
    }

    pub fn update_creation_fee(&mut self, new_fee: u64) -> Result<(), &'static str> {
        if new_fee < MIN_CREATION_FEE_CKB || new_fee > MAX_CREATION_FEE_CKB { return Err("Creation fee out of bounds"); }
        self.creation_fee_ckb = new_fee;
        Ok(())
    }

    pub fn update_re_listing_fee(&mut self, new_fee: u64) -> Result<(), &'static str> {
        if new_fee < MIN_RE_LISTING_FEE_CKB || new_fee > MAX_RE_LISTING_FEE_CKB { return Err("Re-listing fee out of bounds"); }
        self.re_listing_fee_ckb = new_fee;
        Ok(())
    }

    pub fn update_reservation_fee(&mut self, new_fee: u64) -> Result<(), &'static str> {
        if new_fee < MIN_RESERVATION_FEE_CKB || new_fee > MAX_RESERVATION_FEE_CKB { return Err("Reservation fee out of bounds"); }
        self.reservation_fee_ckb = new_fee;
        Ok(())
    }

    pub fn verify_admin(&self, admin_lock_hash: &[u8; 32]) -> bool {
        &self.owner_lock_hash == admin_lock_hash
    }
}

#[repr(C)]
#[derive(Debug)]
pub struct DexEntryData {
    pub dex_name_hash: [u8; 32],
    pub owner_lock_hash: [u8; 32],
    pub reserved_name: [u8; 32],
    pub reservation_fee_paid: u64,
    pub reserved_at: u64,
    pub expires_at: u64,
    pub pool_deployed_at: u64,
    pub launch_mode: u8,
    pub total_launches: u64,
    pub total_volume: u64,
    pub total_fees_paid: u64,
    pub pool_count: u64,
    pub status: u8,
    pub pool_script_hash: [u8; 32],
    pub factory_script_hash: [u8; 32],
    pub dex_fee_bps: u16,
    pub bump: u64,
    pub last_trade_at: u64,
    pub trade_count: u64,
    pub last_trade_volume: u64,
    pub reserved: [u8; 40],
}

impl DexEntryData {
    pub fn new(dex_name_hash: [u8; 32], owner_lock_hash: [u8; 32], reserved_name: [u8; 32],
               reservation_fee_paid: u64, reserved_at: u64) -> Self {
        Self {
            dex_name_hash, owner_lock_hash, reserved_name, reservation_fee_paid, reserved_at,
            expires_at: reserved_at + RESERVATION_DURATION,
            pool_deployed_at: 0, launch_mode: LAUNCH_MODE_MANUAL,
            total_launches: 0, total_volume: 0, total_fees_paid: 0, pool_count: 0,
            status: STATUS_RESERVED,
            pool_script_hash: [0u8; 32], factory_script_hash: [0u8; 32],
            dex_fee_bps: 0, bump: 0,
            last_trade_at: 0, trade_count: 0, last_trade_volume: 0,
            reserved: [0u8; 40],
        }
    }

    pub fn is_pool_deployed(&self) -> bool { self.pool_deployed_at > 0 }

    pub fn record_trade(&mut self, volume: u64, timestamp: u64) {
        self.trade_count = self.trade_count.saturating_add(1);
        self.total_volume = self.total_volume.saturating_add(volume);
        self.last_trade_at = timestamp;
        self.last_trade_volume = volume;
    }

    pub fn mark_pool_deployed(&mut self, pool_script_hash: [u8; 32], timestamp: u64) {
        self.pool_deployed_at = timestamp;
        self.pool_script_hash = pool_script_hash;
        self.status = STATUS_ACTIVE;
    }

    pub fn to_bytes(&self) -> [u8; DEX_ENTRY_SIZE] {
        let mut bytes = [0u8; DEX_ENTRY_SIZE];
        bytes[0..32].copy_from_slice(&self.dex_name_hash);
        bytes[32..64].copy_from_slice(&self.owner_lock_hash);
        bytes[64..96].copy_from_slice(&self.reserved_name);
        bytes[96..104].copy_from_slice(&self.reservation_fee_paid.to_le_bytes());
        bytes[104..112].copy_from_slice(&self.reserved_at.to_le_bytes());
        bytes[112..120].copy_from_slice(&self.expires_at.to_le_bytes());
        bytes[120..128].copy_from_slice(&self.pool_deployed_at.to_le_bytes());
        bytes[128] = self.launch_mode;
        bytes[129..136].copy_from_slice(&self.total_launches.to_le_bytes());
        bytes[136..144].copy_from_slice(&self.total_volume.to_le_bytes());
        bytes[144..152].copy_from_slice(&self.total_fees_paid.to_le_bytes());
        bytes[152..160].copy_from_slice(&self.pool_count.to_le_bytes());
        bytes[160] = self.status;
        bytes[161..193].copy_from_slice(&self.pool_script_hash);
        bytes[193..225].copy_from_slice(&self.factory_script_hash);
        bytes[225..227].copy_from_slice(&self.dex_fee_bps.to_le_bytes());
        bytes[227..235].copy_from_slice(&self.bump.to_le_bytes());
        bytes[235..243].copy_from_slice(&self.last_trade_at.to_le_bytes());
        bytes[243..251].copy_from_slice(&self.trade_count.to_le_bytes());
        bytes[251..259].copy_from_slice(&self.last_trade_volume.to_le_bytes());
        bytes[259..299].copy_from_slice(&self.reserved);
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() != DEX_ENTRY_SIZE { return Err("Invalid DEX entry data length"); }
        let mut dex_name_hash = [0u8; 32];
        dex_name_hash.copy_from_slice(&bytes[0..32]);
        let mut owner_lock_hash = [0u8; 32];
        owner_lock_hash.copy_from_slice(&bytes[32..64]);
        let mut reserved_name = [0u8; 32];
        reserved_name.copy_from_slice(&bytes[64..96]);
        let reservation_fee_paid = u64::from_le_bytes(bytes[96..104].try_into().unwrap());
        let reserved_at = u64::from_le_bytes(bytes[104..112].try_into().unwrap());
        let expires_at = u64::from_le_bytes(bytes[112..120].try_into().unwrap());
        let pool_deployed_at = u64::from_le_bytes(bytes[120..128].try_into().unwrap());
        let launch_mode = bytes[128];
        let total_launches = u64::from_le_bytes(bytes[129..136].try_into().unwrap());
        let total_volume = u64::from_le_bytes(bytes[136..144].try_into().unwrap());
        let total_fees_paid = u64::from_le_bytes(bytes[144..152].try_into().unwrap());
        let pool_count = u64::from_le_bytes(bytes[152..160].try_into().unwrap());
        let status = bytes[160];
        let mut pool_script_hash = [0u8; 32];
        pool_script_hash.copy_from_slice(&bytes[161..193]);
        let mut factory_script_hash = [0u8; 32];
        factory_script_hash.copy_from_slice(&bytes[193..225]);
        let dex_fee_bps = u16::from_le_bytes(bytes[225..227].try_into().unwrap());
        let bump = u64::from_le_bytes(bytes[227..235].try_into().unwrap());
        let last_trade_at = u64::from_le_bytes(bytes[235..243].try_into().unwrap());
        let trade_count = u64::from_le_bytes(bytes[243..251].try_into().unwrap());
        let last_trade_volume = u64::from_le_bytes(bytes[251..259].try_into().unwrap());
        Ok(Self {
            dex_name_hash, owner_lock_hash, reserved_name, reservation_fee_paid, reserved_at,
            expires_at, pool_deployed_at, launch_mode, total_launches, total_volume,
            total_fees_paid, pool_count, status, pool_script_hash, factory_script_hash,
            dex_fee_bps, bump, last_trade_at, trade_count, last_trade_volume,
            reserved: [0u8; 40],
        })
    }
}

pub fn load_registry_data() -> Result<RegistryData, &'static str> {
    let data = load_cell_data(0, Source::GroupOutput).map_err(|_| "Failed to load cell data")?;
    RegistryData::from_bytes(&data)
}

pub fn load_dex_entry_data() -> Result<DexEntryData, &'static str> {
    let data = load_cell_data(0, Source::GroupOutput).map_err(|_| "Failed to load cell data")?;
    DexEntryData::from_bytes(&data)
}
