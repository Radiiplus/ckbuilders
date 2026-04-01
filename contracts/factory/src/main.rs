// DEX Factory - Main Entry Point
#![no_std]
#![no_main]
#![allow(dead_code)]
#![allow(unused_variables)]

mod error;
mod factory;
mod util;

use ckb_std::{debug, high_level::load_script};
use ckb_std::default_alloc;
use error::*;
use factory::*;
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

    let factory_data = match load_factory_data() {
        Ok(f) => f,
        Err(e) => { debug!("Failed to load factory data: {:?}", e); return ERROR_INVALID_DATA_LENGTH as i8; }
    };

    match determine_operation() {
        Ok(Operation::CreateDex) => validate_create_dex(&factory_data),
        Ok(Operation::UpdateFactory) => validate_update_factory(&factory_data),
        Ok(Operation::CollectFees) => validate_collect_fees(&factory_data),
        Ok(Operation::UpdateDex) => validate_update_dex(&factory_data),
        Err(e) => { debug!("Invalid operation: {:?}", e); return ERROR_INVALID_OPERATION as i8; }
    }
}

enum Operation { CreateDex, UpdateFactory, CollectFees, UpdateDex }

fn determine_operation() -> Result<Operation, &'static str> {
    Ok(Operation::CreateDex)
}

fn validate_create_dex(factory: &FactoryData) -> i8 {
    debug!("Validating DEX creation");
    let dex_data = match load_dex_instance_data() {
        Ok(d) => d,
        Err(e) => { debug!("Failed to load DEX instance: {:?}", e); return ERROR_INVALID_DEX_FEE as i8; }
    };
    if !factory.validate_dex_fee(dex_data.dex_fee_bps) {
        debug!("DEX fee out of bounds");
        return ERROR_INVALID_DEX_FEE as i8;
    }
    let (expected_factory_fee, expected_creator_fee, expected_lp_fee) = factory.get_fee_breakdown(dex_data.dex_fee_bps);
    if dex_data.factory_fee_bps != expected_factory_fee {
        debug!("Factory fee mismatch");
        return ERROR_INVALID_FEE_PERCENTAGE as i8;
    }
    if dex_data.creator_fee_bps != expected_creator_fee {
        debug!("Creator fee mismatch");
        return ERROR_INVALID_FEE_PERCENTAGE as i8;
    }
    if dex_data.lp_fee_bps != expected_lp_fee {
        debug!("LP fee mismatch");
        return ERROR_INVALID_FEE_PERCENTAGE as i8;
    }
    if expected_factory_fee == 0 || expected_creator_fee == 0 || expected_lp_fee == 0 {
        debug!("Fees too low");
        return ERROR_INVALID_FEE_PERCENTAGE as i8;
    }
    if dex_data.owner_lock_hash.iter().all(|&b| b == 0) {
        debug!("DEX owner not set");
        return ERROR_INVALID_OWNER as i8;
    }
    if dex_data.dex_id.iter().all(|&b| b == 0) {
        debug!("DEX ID not set");
        return ERROR_INVALID_DEX_NAME as i8;
    }
    match verify_creation_fee_paid(factory) {
        Ok(_) => {},
        Err(e) => { debug!("Creation fee failed: {:?}", e); return ERROR_INSUFFICIENT_FEE_BALANCE as i8; }
    }
    debug!("✓ DEX creation valid");
    SUCCESS as i8
}

fn validate_update_factory(factory: &FactoryData) -> i8 {
    debug!("Validating factory update");
    match verify_signature(&factory.owner_lock_hash, 0) {
        Ok(_) => {},
        Err(e) => { debug!("Unauthorized: {:?}", e); return ERROR_UNAUTHORIZED as i8; }
    }
    debug!("✓ Factory update authorized");
    SUCCESS as i8
}

fn validate_collect_fees(factory: &FactoryData) -> i8 {
    debug!("Validating fee collection");
    match verify_signature(&factory.owner_lock_hash, 0) {
        Ok(_) => {},
        Err(e) => { debug!("Unauthorized: {:?}", e); return ERROR_UNAUTHORIZED as i8; }
    }
    debug!("✓ Fee collection authorized");
    SUCCESS as i8
}

fn validate_update_dex(factory: &FactoryData) -> i8 {
    debug!("Validating DEX update");
    let dex_data = match load_dex_instance_data() {
        Ok(d) => d,
        Err(e) => { debug!("Failed to load DEX: {:?}", e); return ERROR_DEX_NOT_FOUND as i8; }
    };
    match verify_signature(&dex_data.owner_lock_hash, 0) {
        Ok(_) => {},
        Err(e) => { debug!("Unauthorized: {:?}", e); return ERROR_UNAUTHORIZED as i8; }
    }
    let (expected_factory_fee, expected_creator_fee, expected_lp_fee) = factory.get_fee_breakdown(dex_data.dex_fee_bps);
    if dex_data.factory_fee_bps != expected_factory_fee || dex_data.creator_fee_bps != expected_creator_fee || dex_data.lp_fee_bps != expected_lp_fee {
        debug!("Fee mismatch");
        return ERROR_INVALID_FEE_PERCENTAGE as i8;
    }
    debug!("✓ DEX update valid");
    SUCCESS as i8
}
