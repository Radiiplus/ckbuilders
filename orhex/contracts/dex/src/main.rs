#![no_std]
#![no_main]
#![allow(dead_code)]
#![allow(unused_variables)]

mod error;
mod dex;
mod util;

use ckb_std::{debug, high_level::load_script};
use ckb_std::default_alloc;
use error::*;
use dex::*;
use util::*;

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

    let dex_data = match load_dex_data() {
        Ok(d) => d,
        Err(e) => { debug!("Failed to load DEX data: {:?}", e); return ERROR_INVALID_DATA_LENGTH as i8; }
    };

    match determine_operation() {
        Ok(Operation::CreatePool) => validate_create_pool(&dex_data),
        Ok(Operation::RemovePool) => validate_remove_pool(&dex_data),
        Ok(Operation::UpdateDex) => validate_update_dex(&dex_data),
        Ok(Operation::RecordTrade) => validate_record_trade(&dex_data),
        Err(e) => { debug!("Invalid operation: {:?}", e); return ERROR_INVALID_OPERATION as i8; }
    }
}

enum Operation {
    CreatePool,
    RemovePool,
    UpdateDex,
    RecordTrade
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

    if output_count >= 2 {
        Ok(Operation::CreatePool)
    } else if input_count > output_count {
        Ok(Operation::RemovePool)
    } else if input_count == output_count && input_count == 1 {
        Ok(Operation::UpdateDex)
    } else {
        Ok(Operation::RecordTrade)
    }
}

fn validate_create_pool(dex: &DexData) -> i8 {
    debug!("Validating pool creation");

    let sig_result = verify_signature(&dex.owner_lock_hash, 0);
    if sig_result.is_err() {
        debug!("Unauthorized pool creation: {:?}", sig_result);
        return ERROR_UNAUTHORIZED as i8;
    }

    if let Err(e) = verify_transaction_structure() {
        debug!("Invalid transaction structure: {:?}", e);
        return ERROR_INVALID_ARGUMENT as i8;
    }

    let pool_data = match load_pool_data() {
        Ok(p) => p,
        Err(e) => { debug!("Failed to load pool data: {:?}", e); return ERROR_INVALID_ARGUMENT as i8; }
    };

    if pool_data[0..32].iter().all(|&b| b == 0) {
        debug!("Token A not set");
        return ERROR_INVALID_ARGUMENT as i8;
    }

    if pool_data[32..64].iter().all(|&b| b == 0) {
        debug!("Token B not set");
        return ERROR_INVALID_ARGUMENT as i8;
    }

    if pool_data[0..32] == pool_data[32..64] {
        debug!("Tokens must be different");
        return ERROR_INVALID_ARGUMENT as i8;
    }

    debug!("Pool creation valid");
    debug!("  DEX: {}", dex.dex_name_hash.iter().take(8).fold(String::new(), |mut acc, b| {
        acc.push_str(&format!("{:02x}", b));
        acc
    }));

    SUCCESS as i8
}

fn validate_remove_pool(dex: &DexData) -> i8 {
    debug!("Validating pool removal");

    let sig_result = verify_signature(&dex.owner_lock_hash, 0);
    if sig_result.is_err() {
        debug!("Unauthorized");
        return ERROR_UNAUTHORIZED as i8;
    }

    debug!("Pool removal valid");
    SUCCESS as i8
}

fn validate_update_dex(dex: &DexData) -> i8 {
    debug!("Validating DEX update");

    let sig_result = verify_signature(&dex.owner_lock_hash, 0);
    if sig_result.is_err() {
        debug!("Unauthorized");
        return ERROR_UNAUTHORIZED as i8;
    }

    debug!("DEX update valid");
    SUCCESS as i8
}

fn validate_record_trade(_dex: &DexData) -> i8 {
    debug!("Validating trade recording");
    SUCCESS as i8
}
