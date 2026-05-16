#![allow(dead_code)]

use ckb_std::high_level::load_cell_data;
use ckb_std::ckb_constants::Source;

pub const VAULT_DATA_SIZE: usize = 192;

#[repr(C)]
#[derive(Debug)]
pub struct FeeVault {
    pub vault_id: [u8; 32],
    pub launch_id: [u8; 32],
    pub total_fees_collected: u64,
    pub total_fees_distributed: u64,
    pub lp_count: u64,
    pub total_lp_shares: u64,
    pub last_distribution_time: u64,
    pub distribution_count: u64,
    pub lp_fee_bps: u16,
    pub operator_fee_bps: u16,
    pub protocol_fee_bps: u16,
    pub reserved: [u8; 106],
}

impl FeeVault {
    pub fn new(
        vault_id: [u8; 32],
        launch_id: [u8; 32],
        lp_fee_bps: u16,
        operator_fee_bps: u16,
        protocol_fee_bps: u16,
    ) -> Self {
        Self {
            vault_id,
            launch_id,
            total_fees_collected: 0,
            total_fees_distributed: 0,
            lp_count: 0,
            total_lp_shares: 0,
            last_distribution_time: 0,
            distribution_count: 0,
            lp_fee_bps,
            operator_fee_bps,
            protocol_fee_bps,
            reserved: [0u8; 106],
        }
    }

    pub fn to_bytes(&self) -> [u8; VAULT_DATA_SIZE] {
        let mut bytes = [0u8; VAULT_DATA_SIZE];
        bytes[0..32].copy_from_slice(&self.vault_id);
        bytes[32..64].copy_from_slice(&self.launch_id);
        bytes[64..72].copy_from_slice(&self.total_fees_collected.to_le_bytes());
        bytes[72..80].copy_from_slice(&self.total_fees_distributed.to_le_bytes());
        bytes[80..88].copy_from_slice(&self.lp_count.to_le_bytes());
        bytes[88..96].copy_from_slice(&self.total_lp_shares.to_le_bytes());
        bytes[96..104].copy_from_slice(&self.last_distribution_time.to_le_bytes());
        bytes[104..112].copy_from_slice(&self.distribution_count.to_le_bytes());
        bytes[112..114].copy_from_slice(&self.lp_fee_bps.to_le_bytes());
        bytes[114..116].copy_from_slice(&self.operator_fee_bps.to_le_bytes());
        bytes[116..118].copy_from_slice(&self.protocol_fee_bps.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() != VAULT_DATA_SIZE {
            return Err("Invalid vault data length");
        }

        let mut vault_id = [0u8; 32];
        vault_id.copy_from_slice(&bytes[0..32]);

        let mut launch_id = [0u8; 32];
        launch_id.copy_from_slice(&bytes[32..64]);

        let total_fees_collected = u64::from_le_bytes(bytes[64..72].try_into().unwrap());
        let total_fees_distributed = u64::from_le_bytes(bytes[72..80].try_into().unwrap());
        let lp_count = u64::from_le_bytes(bytes[80..88].try_into().unwrap());
        let total_lp_shares = u64::from_le_bytes(bytes[88..96].try_into().unwrap());
        let last_distribution_time = u64::from_le_bytes(bytes[96..104].try_into().unwrap());
        let distribution_count = u64::from_le_bytes(bytes[104..112].try_into().unwrap());
        let lp_fee_bps = u16::from_le_bytes(bytes[112..114].try_into().unwrap());
        let operator_fee_bps = u16::from_le_bytes(bytes[114..116].try_into().unwrap());
        let protocol_fee_bps = u16::from_le_bytes(bytes[116..118].try_into().unwrap());

        Ok(Self {
            vault_id,
            launch_id,
            total_fees_collected,
            total_fees_distributed,
            lp_count,
            total_lp_shares,
            last_distribution_time,
            distribution_count,
            lp_fee_bps,
            operator_fee_bps,
            protocol_fee_bps,
            reserved: [0u8; 106],
        })
    }

    pub fn calculate_lp_share(&self, lp_shares: u64) -> u64 {
        if self.total_lp_shares == 0 || lp_shares == 0 {
            return 0;
        }
        let lp_portion = self.total_fees_collected * self.lp_fee_bps as u64 / 10000;
        lp_portion * lp_shares / self.total_lp_shares
    }

    pub fn add_fees(&mut self, fee_amount: u64) {
        self.total_fees_collected = self.total_fees_collected.saturating_add(fee_amount);
    }

    pub fn record_distribution(&mut self, amount: u64, current_time: u64) {
        self.total_fees_distributed = self.total_fees_distributed.saturating_add(amount);
        self.last_distribution_time = current_time;
        self.distribution_count = self.distribution_count.saturating_add(1);
    }
}

pub fn load_fee_vault() -> Result<FeeVault, &'static str> {
    let data = load_cell_data(0, Source::GroupOutput)
        .map_err(|_| "Failed to load cell data")?;
    FeeVault::from_bytes(&data)
}
