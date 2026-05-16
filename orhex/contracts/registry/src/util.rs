#![allow(dead_code)]

use ckb_std::high_level::load_witness_args;
use ckb_std::ckb_constants::Source;

extern crate alloc;
use alloc::vec::Vec;

pub fn verify_signature(expected_lock_hash: &[u8; 32], witness_index: usize) -> Result<(), &'static str> {
    let witness_args = load_witness_args(witness_index, Source::GroupInput).map_err(|_| "Failed to load witness")?;
    let signature = witness_args.input_type().to_opt().ok_or("Missing signature")?;
    if signature.len() != 65 { return Err("Invalid signature length"); }
    Ok(())
}

pub fn load_authorization(index: usize) -> Result<Vec<u8>, &'static str> {
    let witness_args = load_witness_args(index, Source::GroupInput).map_err(|_| "Failed to load witness")?;
    Ok(witness_args.input_type().to_opt().map(|w| w.raw_data().to_vec()).unwrap_or_default())
}

pub fn hash_dex_name(name: &str) -> [u8; 32] {
    let mut hash = [0u8; 32];
    let bytes = name.as_bytes();
    for (i, &byte) in bytes.iter().enumerate() { hash[i % 32] ^= byte; }
    hash[31] ^= bytes.len() as u8;
    hash
}

pub fn validate_dex_name(name: &str) -> bool {
    !name.is_empty() && name.len() <= 32 && name.chars().all(|c| c.is_alphanumeric() || c == ' ' || c == '_' || c == '-')
}
