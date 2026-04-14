use ckb_std::debug;
use ckb_std::high_level::load_cell_capacity;
use ckb_std::ckb_constants::Source;

use crate::error::*;
use crate::vault::VaultData;
use crate::util::{is_owner_caller, is_contract_caller};

/// Determine the outbound CKB from output capacities (what's being withdrawn/distributed).
pub fn calculate_distribution_amount() -> Result<u64, &'static str> {
    let mut total = 0u64;
    for i in 0..255 {
        match load_cell_capacity(i, Source::Output) {
            Ok(capacity) => {
                total = total.saturating_add(capacity);
            }
            Err(_) => break,
        }
    }
    Ok(total)
}

/// Validate a withdrawal: share holder burns shares — permissionless, just math.
pub fn validate_withdrawal(vault: &VaultData, shares: u64) -> Result<u64, i8> {
    if shares == 0 {
        return Err(ERROR_INVALID_ARGUMENT as i8);
    }
    if vault.total_shares_issued == 0 {
        return Err(ERROR_INSUFFICIENT_BALANCE as i8);
    }

    // Compute CKB value of shares
    let total_value = vault.available_value().ok_or(ERROR_INVALID_STATE)
        .map_err(|_| ERROR_INVALID_STATE as i8)?;
    if total_value == 0 {
        return Err(ERROR_INSUFFICIENT_BALANCE as i8);
    }
    let ckb_amount = (shares as u128 * total_value as u128 / vault.total_shares_issued as u128) as u64;
    if ckb_amount == 0 {
        return Err(ERROR_INSUFFICIENT_BALANCE as i8);
    }
    Ok(ckb_amount)
}

/// Validate fee distribution: PERMISSIONLESS — anyone can trigger.
/// The vault just does the math and moves funds.
pub fn validate_fee_distribution(vault: &VaultData) -> Result<u64, i8> {
    if vault.pending_distribution_ckb == 0 {
        debug!("No fees to distribute");
        return Err(ERROR_INVALID_STATE as i8);
    }
    Ok(vault.pending_distribution_ckb)
}

/// Validate pool seeding: ONLY FACTORY can trigger.
/// The factory creates pools, so it requests vault capital to seed them.
pub fn validate_seed_pool(vault: &VaultData, amount: u64) -> Result<(), i8> {
    // Must be called by the factory contract
    if !is_contract_caller(&vault.factory_type_id) {
        debug!("Unauthorized pool seed: caller is not the factory");
        return Err(ERROR_UNAUTHORIZED as i8);
    }
    if amount == 0 {
        debug!("Seed amount must be positive");
        return Err(ERROR_INSUFFICIENT_INPUT as i8);
    }
    if amount > vault.stage_fund_balance {
        debug!("Insufficient stage fund: {} requested, {} available", amount, vault.stage_fund_balance);
        return Err(ERROR_INSUFFICIENT_BALANCE as i8);
    }
    Ok(())
}

/// Validate launchpad fund routing: ONLY LAUNCHPAD can send bonding curve proceeds.
pub fn validate_route_launch_funds(vault: &VaultData, amount: u64) -> Result<(), i8> {
    if !is_contract_caller(&vault.launchpad_type_id) {
        debug!("Unauthorized launch fund route: caller is not the launchpad");
        return Err(ERROR_UNAUTHORIZED as i8);
    }
    if amount == 0 {
        debug!("Route amount must be positive");
        return Err(ERROR_INSUFFICIENT_INPUT as i8);
    }
    Ok(())
}

/// Validate pool fee routing: any pool can send fees (they're registered via factory).
pub fn validate_route_pool_fees(vault: &VaultData, amount: u64) -> Result<(), i8> {
    if !vault.is_registered_pool(&get_caller_type_id_raw()) {
        debug!("Unauthorized fee route: caller is not a registered pool");
        return Err(ERROR_UNAUTHORIZED as i8);
    }
    if amount == 0 {
        debug!("Route amount must be positive");
        return Err(ERROR_INSUFFICIENT_INPUT as i8);
    }
    Ok(())
}

/// Validate a vault update (change owner, registered contracts): OWNER ONLY.
pub fn validate_update(vault: &VaultData) -> Result<(), i8> {
    if !is_owner_caller(&vault.owner_lock_hash) {
        debug!("Unauthorized vault update attempt");
        return Err(ERROR_UNAUTHORIZED as i8);
    }
    Ok(())
}

/// Verify the output cells match the distribution/withdrawal amounts.
pub fn verify_distribution_output(expected_ckb: u64) -> Result<(), &'static str> {
    let mut total = 0u64;
    for i in 0..255 {
        match load_cell_capacity(i, Source::Output) {
            Ok(capacity) => {
                total = total.saturating_add(capacity);
            }
            Err(_) => break,
        }
    }
    if total < expected_ckb {
        return Err("Output capacity insufficient");
    }
    Ok(())
}

/// Raw Type ID getter for pool fee routing.
fn get_caller_type_id_raw() -> [u8; 20] {
    use crate::util::get_caller_type_id;
    get_caller_type_id().unwrap_or([0u8; 20])
}
