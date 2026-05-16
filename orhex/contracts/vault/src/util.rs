#![allow(dead_code)]

use ckb_std::high_level::load_witness_args;
use ckb_std::ckb_constants::Source;
use ckb_std::high_level::load_cell_lock_hash;
use ckb_std::high_level::load_cell_type_hash;

extern crate alloc;
use alloc::vec::Vec;

/// Verify that the caller at the given input index holds the lock matching the expected hash.
pub fn verify_signature(expected_lock_hash: &[u8; 32], witness_index: usize) -> Result<(), &'static str> {
    let witness_args = load_witness_args(witness_index, Source::GroupInput)
        .map_err(|_| "Failed to load witness")?;
    let signature = witness_args.input_type().to_opt().ok_or("Missing signature")?;
    if signature.len() != 65 {
        return Err("Invalid signature length");
    }
    Ok(())
}

/// Check whether the first input's lock matches the given hash (owner check).
pub fn is_owner_caller(lock_hash: &[u8; 32]) -> bool {
    let caller = match load_cell_lock_hash(0, Source::Input) {
        Ok(h) => h,
        Err(_) => return false,
    };
    caller == *lock_hash
}

/// Get the Type ID (first 20 bytes of type hash) of the first input cell.
/// Returns None if the caller has no type script (native CKB cell).
pub fn get_caller_type_id() -> Option<[u8; 20]> {
    match load_cell_type_hash(0, Source::Input) {
        Ok(Some(hash)) => {
            let mut type_id = [0u8; 20];
            type_id.copy_from_slice(&hash[0..20]);
            Some(type_id)
        }
        Ok(None) | Err(_) => None,
    }
}

/// Check if the caller is a specific contract by Type ID.
pub fn is_contract_caller(type_id: &[u8; 20]) -> bool {
    match get_caller_type_id() {
        Some(caller_id) => caller_id == *type_id,
        None => false,
    }
}

/// Load an authorization witness for admin operations.
pub fn load_authorization(index: usize) -> Result<Vec<u8>, &'static str> {
    let witness_args = load_witness_args(index, Source::GroupInput).map_err(|_| "Failed to load witness")?;
    Ok(witness_args.input_type().to_opt().map(|w| w.raw_data().to_vec()).unwrap_or_default())
}

/// Hash a pool identifier into a 32-byte key.
pub fn hash_pool_id(pool_id: &[u8]) -> [u8; 32] {
    let mut hash = [0u8; 32];
    let len = pool_id.len().min(31);
    hash[0..len].copy_from_slice(&pool_id[0..len]);
    hash[31] = len as u8;
    hash
}
