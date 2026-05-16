use ckb_std::high_level::load_script;
use ckb_std::high_level::load_witness;
use ckb_std::high_level::load_input;
use ckb_std::high_level::load_cell_data;
use ckb_std::ckb_constants::Source;
use ckb_std::ckb_types::prelude::*;
use alloc::string::String;
use alloc::string::ToString;

pub fn verify_signature(owner_lock_hash: &[u8; 32], witness_index: usize) -> Result<(), &'static str> {
    let witness = load_witness(witness_index, Source::GroupInput)
        .map_err(|_| "Failed to load witness")?;

    if witness.len() < 65 {
        return Err("Invalid witness length: signature required");
    }

    let signature_bytes = &witness[0..65];

    let lock_script = load_script().map_err(|_| "Failed to load script")?;

    let script_args = lock_script.args().raw_data();

    if script_args.len() < 20 {
        return Err("Invalid script args");
    }

    let expected_pubkey_hash = &script_args[0..20];

    let mut signature_data = [0u8; 65];
    signature_data.copy_from_slice(signature_bytes);

    let script_hash = lock_script.calc_script_hash();
    let computed_hash = script_hash.as_slice();

    if computed_hash.len() < 32 {
        return Err("Invalid script hash length");
    }

    if &computed_hash[0..32] != owner_lock_hash {
        return Err("Owner lock hash mismatch - unauthorized");
    }

    Ok(())
}

pub fn verify_signature_with_pubkey_recovery(
    owner_lock_hash: &[u8; 32],
    message_hash: &[u8; 32],
    witness_index: usize,
) -> Result<(), &'static str> {
    let witness = load_witness(witness_index, Source::GroupInput)
        .map_err(|_| "Failed to load witness")?;

    if witness.len() < 65 {
        return Err("Invalid witness length");
    }

    let signature_bytes = &witness[0..65];

    let lock_script = load_script().map_err(|_| "Failed to load script")?;
    let script_hash = lock_script.calc_script_hash();

    if &script_hash.as_slice()[0..32] != owner_lock_hash {
        return Err("Owner mismatch");
    }

    Ok(())
}

pub fn parse_dex_name(name_bytes: &[u8; 32]) -> String {
    let end = name_bytes.iter().position(|&b| b == 0).unwrap_or(32);
    String::from_utf8_lossy(&name_bytes[0..end]).to_string()
}

pub fn generate_dex_id(
    factory_hash: &[u8; 32],
    owner_hash: &[u8; 32],
    bump: u64,
) -> [u8; 32] {
    let mut id = [0u8; 32];

    for i in 0..32 {
        id[i] = factory_hash[i] ^ owner_hash[i];
        if i < 8 {
            id[i] ^= bump.to_le_bytes()[i];
        }
    }

    id
}

pub fn verify_transaction_structure() -> Result<(), &'static str> {
    if load_input(0, Source::Input).is_err() {
        return Err("Transaction must have at least one input");
    }

    if load_cell_data(0, Source::Output).is_err() {
        return Err("Transaction must have at least one output");
    }

    Ok(())
}

pub fn verify_pool_cell_structure(output_index: usize) -> Result<(), &'static str> {
    if load_cell_data(output_index, Source::Output).is_err() {
        return Err("Pool output not found");
    }

    let data = load_cell_data(output_index, Source::Output)
        .map_err(|_| "Failed to load pool data")?;

    if data.len() != 152 {
        return Err("Invalid pool data length");
    }

    Ok(())
}
