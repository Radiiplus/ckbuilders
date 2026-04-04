#![no_std]
#![no_main]
#![allow(dead_code)]
#![allow(unused_variables)]

mod error;
mod config;
mod dcurve;
mod vault;
mod refund;

use ckb_std::{debug, high_level::load_script};
use ckb_std::default_alloc;
use error::*;
use config::*;
use dcurve::*;
use vault::*;
use refund::*;

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

    match determine_operation() {
        Ok(Operation::CreateLaunch) => validate_create_launch(),
        Ok(Operation::Contribute) => validate_contribute(),
        Ok(Operation::Finalize) => validate_finalize(),
        Ok(Operation::ClaimLP) => validate_claim_lp(),
        Ok(Operation::Refund) => validate_refund(),
        Ok(Operation::DistributeFees) => validate_distribute_fees(),
        Err(e) => { debug!("Invalid operation: {:?}", e); return ERROR_INVALID_ARGUMENT as i8; }
    }
}

enum Operation {
    CreateLaunch,
    Contribute,
    Finalize,
    ClaimLP,
    Refund,
    DistributeFees,
}

fn determine_operation() -> Result<Operation, &'static str> {
    use ckb_std::high_level::load_input;
    use ckb_std::high_level::load_cell_data;
    use ckb_std::ckb_constants::Source;

    let mut input_count = 0;
    let mut output_count = 0;

    for i in 0..10 {
        if load_input(i, Source::Input).is_ok() {
            input_count += 1;
        }
        if load_cell_data(i, Source::Output).is_ok() {
            output_count += 1;
        }
    }

    if input_count == 0 || output_count == 0 {
        return Err("Transaction must have inputs and outputs");
    }

    let output_data = load_cell_data(0, Source::Output);

    if let Ok(data) = &output_data {
        if data.len() == 512 {
            let status = data[170];
            return match status {
                0 => Ok(Operation::CreateLaunch),
                1 => Ok(Operation::Contribute),
                2 => Ok(Operation::Finalize),
                3 => Ok(Operation::Refund),
                _ => Err("Invalid launch status"),
            };
        }
    }

    if let Ok(data) = &output_data {
        if data.len() == 256 {
            return Ok(Operation::Contribute);
        }
    }

    if let Ok(data) = &output_data {
        if data.len() == 192 {
            return Ok(Operation::DistributeFees);
        }
    }

    if let Ok(data) = &output_data {
        if data.len() == 128 {
            return Ok(Operation::Refund);
        }
    }

    if input_count == 1 && output_count == 1 {
        Ok(Operation::CreateLaunch)
    } else if input_count >= 1 && output_count >= 2 {
        Ok(Operation::Contribute)
    } else {
        Ok(Operation::Finalize)
    }
}

fn validate_create_launch() -> i8 {
    debug!("Validating launch creation...");

    let launch_data = match config::load_launch_config() {
        Ok(d) => d,
        Err(e) => { debug!("Failed to load launch data: {:?}", e); return ERROR_INVALID_DATA_LENGTH as i8; }
    };

    if launch_data.target_ckb == 0 || launch_data.total_supply == 0 {
        debug!("Invalid launch parameters");
        return ERROR_INVALID_ARGUMENT as i8;
    }

    if launch_data.price_multiplier_bps < 90 || launch_data.price_multiplier_bps > 110 {
        debug!("Invalid price multiplier: {}", launch_data.price_multiplier_bps);
        return ERROR_INVALID_PRICE_MULTIPLIER as i8;
    }

    if launch_data.end_time <= launch_data.start_time {
        debug!("Invalid time window");
        return ERROR_INVALID_LAUNCH_TIME as i8;
    }

    debug!("Launch creation validated successfully");
    SUCCESS as i8
}

fn validate_contribute() -> i8 {
    debug!("Validating contribution...");

    let input_count = count_inputs();
    if input_count == 0 {
        debug!("No inputs in contribution transaction");
        return ERROR_INVALID_ARGUMENT as i8;
    }

    let curve = match dcurve::load_dcurve() {
        Ok(c) => c,
        Err(e) => { debug!("Failed to load curve data: {:?}", e); return ERROR_CURVE_NOT_FOUND as i8; }
    };

    if curve.status != dcurve::CURVE_STATUS_ACTIVE {
        debug!("Curve not active, status: {}", curve.status);
        return ERROR_INVALID_STATE as i8;
    }

    if curve.is_filled() {
        debug!("Curve already filled: {} / {}", curve.current_ckb, curve.target_ckb);
        return ERROR_TARGET_EXCEEDED as i8;
    }

    let total_input_ckb = calculate_total_input_ckb();
    if total_input_ckb == 0 {
        debug!("No CKB input detected");
        return ERROR_INVALID_ARGUMENT as i8;
    }

    let remaining_ckb = curve.target_ckb.saturating_sub(curve.current_ckb);
    if total_input_ckb > remaining_ckb {
        debug!("Contribution {} exceeds remaining capacity {}", total_input_ckb, remaining_ckb);
        return ERROR_TARGET_EXCEEDED as i8;
    }

    debug!("Contribution validated successfully: {} CKB", total_input_ckb);
    SUCCESS as i8
}

fn validate_finalize() -> i8 {
    debug!("Validating finalization...");

    let launch = match config::load_launch_config() {
        Ok(l) => l,
        Err(e) => { debug!("Failed to load launch data: {:?}", e); return ERROR_INVALID_DATA_LENGTH as i8; }
    };

    if !is_authorized_operator() {
        debug!("Unauthorized finalization attempt");
        return ERROR_UNAUTHORIZED as i8;
    }

    if !launch.target_reached() {
        debug!("Target not reached: {} / {}", launch.total_contributed_ckb, launch.target_ckb);
        return ERROR_TARGET_NOT_REACHED as i8;
    }

    if launch.total_supply < launch.total_tokens_allocated {
        debug!("Insufficient token supply: {} < {}", launch.total_supply, launch.total_tokens_allocated);
        return ERROR_INVALID_DATA_LENGTH as i8;
    }

    if !is_valid_state_transition(launch.status, config::STATUS_SUCCESS) {
        debug!("Invalid state transition from {}", launch.status);
        return ERROR_INVALID_STATE as i8;
    }

    debug!("Launch finalized successfully");
    SUCCESS as i8
}

fn validate_claim_lp() -> i8 {
    debug!("Validating LP claim...");

    let launch = match config::load_launch_config() {
        Ok(l) => l,
        Err(e) => { debug!("Failed to load launch data: {:?}", e); return ERROR_INVALID_DATA_LENGTH as i8; }
    };

    if !launch.is_success() {
        debug!("Launch not successful, status: {}", launch.status);
        return ERROR_CLAIM_NOT_READY as i8;
    }

    if !verify_claimant_receipt() {
        debug!("Invalid claimant receipt");
        return ERROR_INVALID_MERKLE_PROOF as i8;
    }

    debug!("LP claim validated successfully");
    SUCCESS as i8
}

fn validate_refund() -> i8 {
    debug!("Validating refund...");

    let refund_claim = match refund::load_refund_claim() {
        Ok(r) => r,
        Err(e) => { debug!("Failed to load refund data: {:?}", e); return ERROR_INVALID_DATA_LENGTH as i8; }
    };

    if refund_claim.status != 1 {
        debug!("Refund not active, status: {}", refund_claim.status);
        return ERROR_INVALID_STATE as i8;
    }

    if refund_claim.claims_processed >= refund_claim.claim_count {
        debug!("All refund claims already processed");
        return ERROR_INVALID_STATE as i8;
    }

    if !verify_refund_merkle_proof(&refund_claim) {
        debug!("Invalid refund Merkle proof");
        return ERROR_INVALID_MERKLE_PROOF as i8;
    }

    debug!("Refund validated successfully");
    SUCCESS as i8
}

fn validate_distribute_fees() -> i8 {
    debug!("Validating fee distribution...");

    if !is_authorized_operator() {
        debug!("Unauthorized fee distribution attempt");
        return ERROR_UNAUTHORIZED as i8;
    }

    let vault = match vault::load_fee_vault() {
        Ok(v) => v,
        Err(e) => { debug!("Failed to load vault data: {:?}", e); return ERROR_VAULT_NOT_INITIALIZED as i8; }
    };

    let available_fees = vault.total_fees_collected.saturating_sub(vault.total_fees_distributed);
    if available_fees == 0 {
        debug!("No fees to distribute");
        return ERROR_FEE_DISTRIBUTION_FAILED as i8;
    }

    debug!("Fee distribution validated successfully");
    SUCCESS as i8
}

fn count_inputs() -> u64 {
    use ckb_std::high_level::load_input;
    use ckb_std::ckb_constants::Source;

    let mut count = 0u64;
    for i in 0..255 {
        if load_input(i, Source::Input).is_ok() {
            count += 1;
        } else {
            break;
        }
    }
    count
}

fn calculate_total_input_ckb() -> u64 {
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
    total
}

fn is_authorized_operator() -> bool {
    use ckb_std::high_level::load_cell_lock_hash;
    use ckb_std::ckb_constants::Source;

    let caller_lock_hash = match load_cell_lock_hash(0, Source::Input) {
        Ok(hash) => hash,
        Err(_) => return false,
    };

    let launch = match config::load_launch_config() {
        Ok(l) => l,
        Err(_) => return false,
    };

    caller_lock_hash == launch.creator_lock_hash
}

fn is_valid_state_transition(from: u8, to: u8) -> bool {
    match from {
        config::STATUS_PENDING => to == config::STATUS_ACTIVE || to == config::STATUS_EXPIRED,
        config::STATUS_ACTIVE => to == config::STATUS_SUCCESS || to == config::STATUS_EXPIRED,
        config::STATUS_SUCCESS => false,
        config::STATUS_EXPIRED => false,
        config::STATUS_CANCELLED => false,
        _ => false,
    }
}

fn verify_claimant_receipt() -> bool {
    use ckb_std::high_level::load_witness;
    use ckb_std::ckb_constants::Source;

    let launch = match config::load_launch_config() {
        Ok(l) => l,
        Err(_) => return false,
    };

    let witness_bytes = match load_witness(0, Source::Input) {
        Ok(w) => w,
        Err(_) => return false,
    };

    if witness_bytes.len() < 65 {
        debug!("Witness too short for Merkle proof");
        return false;
    }

    let mut leaf_hash = [0u8; 32];
    leaf_hash.copy_from_slice(&witness_bytes[0..32]);

    let proof_length = witness_bytes[32] as usize;
    if proof_length == 0 || proof_length > 32 {
        debug!("Invalid proof length: {}", proof_length);
        return false;
    }

    let expected_len = 33 + proof_length * 32;
    if witness_bytes.len() < expected_len {
        debug!("Witness too short: expected {}, got {}", expected_len, witness_bytes.len());
        return false;
    }

    let mut proof_hashes: alloc::vec::Vec<[u8; 32]> = alloc::vec::Vec::new();
    for i in 0..proof_length {
        let mut hash = [0u8; 32];
        let offset = 33 + i * 32;
        hash.copy_from_slice(&witness_bytes[offset..offset + 32]);
        proof_hashes.push(hash);
    }

    let index_offset = 33 + proof_length * 32;
    if witness_bytes.len() < index_offset + 8 {
        debug!("Missing index in witness");
        return false;
    }
    let mut index_bytes = [0u8; 8];
    index_bytes.copy_from_slice(&witness_bytes[index_offset..index_offset + 8]);
    let index = u64::from_le_bytes(index_bytes);

    let refund = refund::RefundClaim::new(
        launch.registry_entry_hash,
        launch.launch_id,
        [0u8; 32],
        0, 0, 0, 0,
    );

    refund.verify_merkle_proof(&leaf_hash, &proof_hashes, index)
}

fn verify_refund_merkle_proof(refund_claim: &refund::RefundClaim) -> bool {
    use ckb_std::high_level::load_witness;
    use ckb_std::ckb_constants::Source;

    let witness_bytes = match load_witness(0, Source::Input) {
        Ok(w) => w,
        Err(_) => return false,
    };

    if witness_bytes.len() < 65 {
        debug!("Witness too short for refund proof");
        return false;
    }

    let mut leaf_hash = [0u8; 32];
    leaf_hash.copy_from_slice(&witness_bytes[0..32]);

    let proof_length = witness_bytes[32] as usize;
    if proof_length == 0 || proof_length > 32 {
        debug!("Invalid refund proof length: {}", proof_length);
        return false;
    }

    let expected_len = 33 + proof_length * 32;
    if witness_bytes.len() < expected_len {
        debug!("Witness too short for refund proof hashes");
        return false;
    }

    let mut proof_hashes: alloc::vec::Vec<[u8; 32]> = alloc::vec::Vec::new();
    for i in 0..proof_length {
        let mut hash = [0u8; 32];
        let offset = 33 + i * 32;
        hash.copy_from_slice(&witness_bytes[offset..offset + 32]);
        proof_hashes.push(hash);
    }

    let index_offset = 33 + proof_length * 32;
    if witness_bytes.len() < index_offset + 8 {
        debug!("Missing index in refund witness");
        return false;
    }
    let mut index_bytes = [0u8; 8];
    index_bytes.copy_from_slice(&witness_bytes[index_offset..index_offset + 8]);
    let index = u64::from_le_bytes(index_bytes);

    refund_claim.verify_merkle_proof(&leaf_hash, &proof_hashes, index)
}
