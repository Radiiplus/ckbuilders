#![no_std]
#![no_main]
#![allow(dead_code)]
#![allow(unused_variables)]

mod error;
mod vault;
mod deposit;
mod distribute;
mod util;

use ckb_std::{debug, high_level::load_script};
use ckb_std::default_alloc;
use error::*;
use vault::*;
use deposit::*;
use distribute::*;

extern crate alloc;

default_alloc!();

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

#[no_mangle]
pub fn main() -> i8 {
    let _script = match load_script() {
        Ok(s) => s,
        Err(_) => { debug!("Failed to load script"); return ERROR_INVALID_ARGUMENT as i8; }
    };

    let vault_data = match load_vault_data() {
        Ok(v) => v,
        Err(e) => { debug!("Failed to load vault data: {:?}", e); return ERROR_INVALID_DATA_LENGTH as i8; }
    };

    match determine_operation(&vault_data) {
        Ok(Operation::Initialize) => validate_initialize(&vault_data),
        Ok(Operation::Deposit) => validate_deposit_tx(&vault_data),
        Ok(Operation::Withdraw) => validate_withdraw_tx(&vault_data),
        Ok(Operation::DistributeFees) => validate_distribute_fees_tx(&vault_data),
        Ok(Operation::SeedPool) => validate_seed_pool_tx(&vault_data),
        Ok(Operation::RouteLaunchFunds) => validate_route_launch_tx(&vault_data),
        Ok(Operation::RoutePoolFees) => validate_route_pool_fees_tx(&vault_data),
        Ok(Operation::Update) => validate_update_tx(&vault_data),
        Err(e) => { debug!("Invalid operation: {:?}", e); return ERROR_INVALID_OPERATION as i8; }
    }
}

enum Operation {
    Initialize,
    Deposit,
    Withdraw,
    DistributeFees,
    SeedPool,
    RouteLaunchFunds,
    RoutePoolFees,
    Update,
}

fn determine_operation(vault: &VaultData) -> Result<Operation, &'static str> {
    use ckb_std::high_level::load_cell_data;
    use ckb_std::ckb_constants::Source;
    use ckb_std::high_level::load_input;

    let mut input_count = 0u64;
    let mut output_count = 0u64;

    for i in 0..255 {
        if load_input(i, Source::Input).is_ok() {
            input_count += 1;
        } else {
            break;
        }
    }
    for i in 0..255 {
        if load_cell_data(i, Source::Output).is_ok() {
            output_count += 1;
        } else {
            break;
        }
    }

    if input_count == 0 || output_count == 0 {
        return Err("Transaction must have inputs and outputs");
    }

    // Initialize: vault has zero shares, zero deposits, single input from owner
    if vault.total_shares_issued == 0 && vault.total_deposited_ckb == 0 && input_count == 1 {
        return Ok(Operation::Initialize);
    }

    // Update: single input from owner, single output with updated data
    if input_count == 1 && output_count == 1 {
        return Ok(Operation::Update);
    }

    // Route launchpad funds: launchpad contract sends bonding curve proceeds
    if util::is_contract_caller(&vault.launchpad_type_id) {
        return Ok(Operation::RouteLaunchFunds);
    }

    // Route pool fees: a pool sends swap fees
    if util::is_contract_caller(&vault.factory_type_id) == false
        && input_count == 1 && output_count == 1 {
        // Could be a pool sending fees — check if there's a fee source tag in witness
        return Ok(Operation::RoutePoolFees);
    }

    // Seed pool: factory requests vault capital for new pool
    if util::is_contract_caller(&vault.factory_type_id) {
        return Ok(Operation::SeedPool);
    }

    // Distribute fees: anyone can trigger, multiple outputs to share holders
    if input_count == 1 && output_count >= 2 {
        return Ok(Operation::DistributeFees);
    }

    // Deposit: user CKB inputs → vault cell + share receipt
    if input_count >= 1 && output_count >= 1 {
        return Ok(Operation::Deposit);
    }

    Err("Unable to determine operation from transaction structure")
}

fn validate_initialize(vault: &VaultData) -> i8 {
    debug!("Validating vault initialization...");

    if vault.owner_lock_hash.iter().all(|&b| b == 0) {
        debug!("Owner lock hash not set");
        return ERROR_INVALID_OWNER as i8;
    }
    if vault.factory_type_id.iter().all(|&b| b == 0) {
        debug!("Factory Type ID not set");
        return ERROR_VAULT_NOT_INITIALIZED as i8;
    }
    if vault.launchpad_type_id.iter().all(|&b| b == 0) {
        debug!("Launchpad Type ID not set");
        return ERROR_VAULT_NOT_INITIALIZED as i8;
    }

    debug!("Vault initialized successfully");
    SUCCESS as i8
}

fn validate_deposit_tx(vault: &VaultData) -> i8 {
    debug!("Validating vault deposit...");

    let amount = match calculate_deposit_amount() {
        Ok(a) => a,
        Err(e) => { debug!("Failed to calculate deposit: {:?}", e); return ERROR_INSUFFICIENT_INPUT as i8; }
    };

    let shares = match validate_deposit(vault, amount) {
        Ok(s) => s,
        Err(e) => { debug!("Deposit validation failed: {:?}", e); return e; }
    };

    debug!("Deposit validated: {} CKB for {} shares", amount, shares);
    SUCCESS as i8
}

fn validate_withdraw_tx(vault: &VaultData) -> i8 {
    debug!("Validating vault withdrawal...");

    // Shares to burn are encoded in the first input's witness
    let shares = match extract_withdraw_shares() {
        Ok(s) => s,
        Err(e) => { debug!("Failed to extract shares: {:?}", e); return ERROR_INVALID_ARGUMENT as i8; }
    };

    let ckb_amount = match validate_withdrawal(vault, shares) {
        Ok(a) => a,
        Err(e) => { debug!("Withdrawal validation failed: {:?}", e); return e; }
    };

    debug!("Withdrawal validated: {} shares → {} CKB", shares, ckb_amount);
    SUCCESS as i8
}

fn validate_distribute_fees_tx(vault: &VaultData) -> i8 {
    debug!("Validating fee distribution...");

    let pending = match validate_fee_distribution(vault) {
        Ok(p) => p,
        Err(e) => { debug!("Fee distribution validation failed: {:?}", e); return e; }
    };

    debug!("Fee distribution validated: {} CKB pending", pending);
    SUCCESS as i8
}

fn validate_seed_pool_tx(vault: &VaultData) -> i8 {
    debug!("Validating pool seeding...");

    let amount = match extract_seed_amount() {
        Ok(a) => a,
        Err(e) => { debug!("Failed to extract seed amount: {:?}", e); return ERROR_INSUFFICIENT_INPUT as i8; }
    };

    match validate_seed_pool(vault, amount) {
        Ok(_) => {},
        Err(e) => { debug!("Pool seed validation failed: {:?}", e); return e; }
    }

    debug!("Pool seeding validated: {} CKB", amount);
    SUCCESS as i8
}

fn validate_route_launch_tx(vault: &VaultData) -> i8 {
    debug!("Validating launch fund routing...");

    let amount = match extract_route_amount() {
        Ok(a) => a,
        Err(e) => { debug!("Failed to extract route amount: {:?}", e); return ERROR_INSUFFICIENT_INPUT as i8; }
    };

    match validate_route_launch_funds(vault, amount) {
        Ok(_) => {},
        Err(e) => { debug!("Launch fund validation failed: {:?}", e); return e; }
    }

    debug!("Launch fund routing validated: {} CKB", amount);
    SUCCESS as i8
}

fn validate_route_pool_fees_tx(vault: &VaultData) -> i8 {
    debug!("Validating pool fee routing...");

    let amount = match extract_route_amount() {
        Ok(a) => a,
        Err(e) => { debug!("Failed to extract route amount: {:?}", e); return ERROR_INSUFFICIENT_INPUT as i8; }
    };

    match validate_route_pool_fees(vault, amount) {
        Ok(_) => {},
        Err(e) => { debug!("Pool fee route validation failed: {:?}", e); return e; }
    }

    debug!("Pool fee routing validated: {} CKB", amount);
    SUCCESS as i8
}

fn validate_update_tx(vault: &VaultData) -> i8 {
    debug!("Validating vault update...");

    match validate_update(vault) {
        Ok(_) => {},
        Err(e) => { debug!("Vault update validation failed: {:?}", e); return e; }
    }

    debug!("Vault update validated");
    SUCCESS as i8
}

fn extract_withdraw_shares() -> Result<u64, &'static str> {
    use ckb_std::high_level::load_witness;
    use ckb_std::ckb_constants::Source;

    let witness = load_witness(0, Source::Input).map_err(|_| "Failed to load witness")?;
    if witness.len() < 8 {
        return Err("Witness too short for shares");
    }
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&witness[0..8]);
    Ok(u64::from_le_bytes(bytes))
}

fn extract_seed_amount() -> Result<u64, &'static str> {
    use ckb_std::high_level::load_witness;
    use ckb_std::ckb_constants::Source;

    let witness = load_witness(0, Source::Input).map_err(|_| "Failed to load witness")?;
    if witness.len() < 8 {
        return Err("Witness too short for seed amount");
    }
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&witness[0..8]);
    Ok(u64::from_le_bytes(bytes))
}

fn extract_route_amount() -> Result<u64, &'static str> {
    use ckb_std::high_level::load_cell_capacity;
    use ckb_std::ckb_constants::Source;

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
