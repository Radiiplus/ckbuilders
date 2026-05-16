use ckb_std::high_level::load_cell_capacity;
use ckb_std::high_level::load_cell_data;
use ckb_std::ckb_constants::Source;

use crate::error::*;
use crate::vault::VaultData;

pub const MIN_DEPOSIT_CKB: u64 = 100_000_000; // 1 CKB minimum

/// Determine the deposit amount from input capacities.
pub fn calculate_deposit_amount() -> Result<u64, &'static str> {
    let mut total = 0u64;
    for i in 0..255 {
        match load_cell_capacity(i, Source::Input) {
            Ok(capacity) => {
                total = total.saturating_add(capacity);
            }
            Err(_) => break,
        }
    }
    if total == 0 {
        return Err("No CKB inputs provided");
    }
    Ok(total)
}

/// Verify the deposit output cell exists and has the correct data tag.
pub fn verify_deposit_output(vault: &VaultData, expected_shares: u64) -> Result<(), &'static str> {
    // Check that an output cell contains vault shares
    let mut found = false;
    for i in 0..255 {
        if let Ok(data) = load_cell_data(i, Source::Output) {
            // Output cell with vault data = share receipt
            if data.len() == crate::vault::VAULT_DATA_SIZE {
                found = true;
                break;
            }
            // A 64-byte cell can carry a share receipt
            if data.len() == 64 {
                let shares = u64::from_le_bytes(
                    data[0..8].try_into().map_err(|_| "Invalid share receipt")?
                );
                if shares == expected_shares {
                    found = true;
                    break;
                }
            }
        } else {
            break;
        }
    }
    if !found {
        return Err("No valid deposit output found");
    }
    Ok(())
}

/// Validate a deposit transaction — compute expected shares without mutating.
pub fn validate_deposit(vault: &VaultData, amount: u64) -> Result<u64, i8> {
    if amount < MIN_DEPOSIT_CKB {
        return Err(ERROR_DEPOSIT_TOO_SMALL as i8);
    }
    // Compute shares the same way mint_shares does, but read-only
    let shares = if vault.total_shares_issued == 0 {
        amount
    } else {
        let total_value = vault.available_value().ok_or(ERROR_OVERFLOW)
            .map_err(|_| ERROR_INVALID_ARGUMENT as i8)?;
        if total_value == 0 {
            return Err(ERROR_INSUFFICIENT_BALANCE as i8);
        }
        (amount as u128 * vault.total_shares_issued as u128 / total_value as u128) as u64
    };
    if shares == 0 {
        return Err(ERROR_DEPOSIT_TOO_SMALL as i8);
    }
    Ok(shares)
}
