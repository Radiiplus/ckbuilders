#![allow(dead_code)]

use ckb_std::high_level::load_cell_data;
use ckb_std::ckb_constants::Source;

pub const DCURVE_DATA_SIZE: usize = 256;

pub const CURVE_STATUS_PENDING: u8 = 0;
pub const CURVE_STATUS_ACTIVE: u8 = 1;
pub const CURVE_STATUS_FILLED: u8 = 2;
pub const CURVE_STATUS_SUCCESS: u8 = 3;
pub const CURVE_STATUS_EXPIRED: u8 = 4;
pub const CURVE_STATUS_REFUNDED: u8 = 5;

#[repr(C)]
#[derive(Debug)]
pub struct DCurve {
    pub curve_id: [u8; 32],
    pub launch_id: [u8; 32],
    pub dex_operator_lock_hash: [u8; 32],
    pub dex_script_hash: [u8; 32],
    pub price_multiplier_bps: u16,
    pub status: u8,
    pub start_time: u64,
    pub end_time: u64,
    pub launch_offset_blocks: u64,
    pub target_ckb: u64,
    pub current_ckb: u64,
    pub tokens_allocated: u64,
    pub tokens_sold: u64,
    pub contributor_count: u64,
    pub stake_ckb: u64,
    pub fees_generated: u64,
    pub current_price_scaled: u64,
    pub initial_price_scaled: u64,
    pub reserved: [u8; 70],
}

impl DCurve {
    pub fn new(
        curve_id: [u8; 32],
        launch_id: [u8; 32],
        dex_operator_lock_hash: [u8; 32],
        dex_script_hash: [u8; 32],
        price_multiplier_bps: u16,
        start_time: u64,
        end_time: u64,
        launch_offset_blocks: u64,
        target_ckb: u64,
        initial_price_scaled: u64,
        stake_ckb: u64,
    ) -> Self {
        Self {
            curve_id,
            launch_id,
            dex_operator_lock_hash,
            dex_script_hash,
            price_multiplier_bps,
            status: CURVE_STATUS_PENDING,
            start_time,
            end_time,
            launch_offset_blocks,
            target_ckb,
            current_ckb: 0,
            tokens_allocated: 0,
            tokens_sold: 0,
            contributor_count: 0,
            stake_ckb,
            fees_generated: 0,
            current_price_scaled: initial_price_scaled,
            initial_price_scaled,
            reserved: [0u8; 70],
        }
    }

    pub fn to_bytes(&self) -> [u8; DCURVE_DATA_SIZE] {
        let mut bytes = [0u8; DCURVE_DATA_SIZE];
        bytes[0..32].copy_from_slice(&self.curve_id);
        bytes[32..64].copy_from_slice(&self.launch_id);
        bytes[64..96].copy_from_slice(&self.dex_operator_lock_hash);
        bytes[96..128].copy_from_slice(&self.dex_script_hash);
        bytes[128..130].copy_from_slice(&self.price_multiplier_bps.to_le_bytes());
        bytes[130] = self.status;
        bytes[131..139].copy_from_slice(&self.start_time.to_le_bytes());
        bytes[139..147].copy_from_slice(&self.end_time.to_le_bytes());
        bytes[147..155].copy_from_slice(&self.launch_offset_blocks.to_le_bytes());
        bytes[155..163].copy_from_slice(&self.target_ckb.to_le_bytes());
        bytes[163..171].copy_from_slice(&self.current_ckb.to_le_bytes());
        bytes[171..179].copy_from_slice(&self.tokens_allocated.to_le_bytes());
        bytes[179..187].copy_from_slice(&self.tokens_sold.to_le_bytes());
        bytes[187..195].copy_from_slice(&self.contributor_count.to_le_bytes());
        bytes[195..203].copy_from_slice(&self.stake_ckb.to_le_bytes());
        bytes[203..211].copy_from_slice(&self.fees_generated.to_le_bytes());
        bytes[211..219].copy_from_slice(&self.current_price_scaled.to_le_bytes());
        bytes[219..227].copy_from_slice(&self.initial_price_scaled.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() != DCURVE_DATA_SIZE {
            return Err("Invalid dcurve data length");
        }

        let mut curve_id = [0u8; 32];
        curve_id.copy_from_slice(&bytes[0..32]);

        let mut launch_id = [0u8; 32];
        launch_id.copy_from_slice(&bytes[32..64]);

        let mut dex_operator_lock_hash = [0u8; 32];
        dex_operator_lock_hash.copy_from_slice(&bytes[64..96]);

        let mut dex_script_hash = [0u8; 32];
        dex_script_hash.copy_from_slice(&bytes[96..128]);

        let price_multiplier_bps = u16::from_le_bytes(bytes[128..130].try_into().unwrap());
        let status = bytes[130];
        let start_time = u64::from_le_bytes(bytes[131..139].try_into().unwrap());
        let end_time = u64::from_le_bytes(bytes[139..147].try_into().unwrap());
        let launch_offset_blocks = u64::from_le_bytes(bytes[147..155].try_into().unwrap());
        let target_ckb = u64::from_le_bytes(bytes[155..163].try_into().unwrap());
        let current_ckb = u64::from_le_bytes(bytes[163..171].try_into().unwrap());
        let tokens_allocated = u64::from_le_bytes(bytes[171..179].try_into().unwrap());
        let tokens_sold = u64::from_le_bytes(bytes[179..187].try_into().unwrap());
        let contributor_count = u64::from_le_bytes(bytes[187..195].try_into().unwrap());
        let stake_ckb = u64::from_le_bytes(bytes[195..203].try_into().unwrap());
        let fees_generated = u64::from_le_bytes(bytes[203..211].try_into().unwrap());
        let current_price_scaled = u64::from_le_bytes(bytes[211..219].try_into().unwrap());
        let initial_price_scaled = u64::from_le_bytes(bytes[219..227].try_into().unwrap());

        Ok(Self {
            curve_id,
            launch_id,
            dex_operator_lock_hash,
            dex_script_hash,
            price_multiplier_bps,
            status,
            start_time,
            end_time,
            launch_offset_blocks,
            target_ckb,
            current_ckb,
            tokens_allocated,
            tokens_sold,
            contributor_count,
            stake_ckb,
            fees_generated,
            current_price_scaled,
            initial_price_scaled,
            reserved: [0u8; 70],
        })
    }

    pub fn calculate_tokens_for_ckb(&self, ckb_amount: u64) -> u64 {
        if self.tokens_allocated == 0 || self.initial_price_scaled == 0 || ckb_amount == 0 {
            return 0;
        }

        let ckb_scaled = (ckb_amount as u128) * 1_000_000_000_000;

        let sold_ratio = if self.tokens_allocated > 0 {
            (self.tokens_sold as u128) * 10000 / (self.tokens_allocated as u128)
        } else {
            0
        };

        let price_multiplier = 10000 + sold_ratio;
        let adjusted_price = (self.initial_price_scaled as u128) * price_multiplier / 10000;

        if adjusted_price == 0 {
            return 0;
        }

        let final_price = adjusted_price * (self.price_multiplier_bps as u128) / 100;

        if final_price == 0 {
            return 0;
        }

        let tokens = ckb_scaled / final_price;

        if tokens > u64::MAX as u128 {
            return 0;
        }

        tokens as u64
    }

    pub fn is_active(&self) -> bool {
        self.status == CURVE_STATUS_ACTIVE
            && self.current_ckb < self.target_ckb
    }

    pub fn is_filled(&self) -> bool {
        self.current_ckb >= self.target_ckb || self.status == CURVE_STATUS_FILLED
    }
}

pub fn load_dcurve() -> Result<DCurve, &'static str> {
    let data = load_cell_data(0, Source::GroupOutput)
        .map_err(|_| "Failed to load cell data")?;
    DCurve::from_bytes(&data)
}
