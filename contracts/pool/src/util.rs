#![allow(dead_code)]

use ckb_std::high_level::load_witness_args;
use ckb_std::ckb_constants::Source;

extern crate alloc;
use alloc::vec::Vec;

pub fn load_authorization(index: usize) -> Result<Vec<u8>, &'static str> {
    let witness_args = load_witness_args(index, Source::GroupInput).map_err(|_| "Failed to load witness")?;
    Ok(witness_args.input_type().to_opt().map(|w| w.raw_data().to_vec()).unwrap_or_default())
}
