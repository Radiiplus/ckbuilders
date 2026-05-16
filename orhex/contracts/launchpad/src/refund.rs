#![allow(dead_code)]

use ckb_std::high_level::load_cell_data;
use ckb_std::ckb_constants::Source;
use blake2b_ref::Blake2bBuilder;

pub const REFUND_DATA_SIZE: usize = 128;
pub const MERKLE_ROOT_SIZE: usize = 32;

fn blake2b_256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Blake2bBuilder::new(32).build();
    hasher.update(data);
    let mut hash = [0u8; 32];
    hasher.finalize(&mut hash);
    hash
}

#[repr(C)]
#[derive(Debug)]
pub struct RefundClaim {
    pub merkle_root: [u8; 32],
    pub launch_id: [u8; 32],
    pub curve_id: [u8; 32],
    pub total_refund_ckb: u64,
    pub total_refund_tokens: u64,
    pub claim_count: u64,
    pub claims_processed: u64,
    pub status: u8,
    pub refund_start_time: u64,
    pub refund_end_time: u64,
    pub reserved: [u8; 17],
}

impl RefundClaim {
    pub fn new(
        merkle_root: [u8; 32],
        launch_id: [u8; 32],
        curve_id: [u8; 32],
        total_refund_ckb: u64,
        total_refund_tokens: u64,
        refund_start_time: u64,
        refund_end_time: u64,
    ) -> Self {
        Self {
            merkle_root,
            launch_id,
            curve_id,
            total_refund_ckb,
            total_refund_tokens,
            claim_count: 0,
            claims_processed: 0,
            status: 0,
            refund_start_time,
            refund_end_time,
            reserved: [0u8; 17],
        }
    }

    pub fn to_bytes(&self) -> [u8; REFUND_DATA_SIZE] {
        let mut bytes = [0u8; REFUND_DATA_SIZE];
        bytes[0..32].copy_from_slice(&self.merkle_root);
        bytes[32..64].copy_from_slice(&self.launch_id);
        bytes[64..96].copy_from_slice(&self.curve_id);
        bytes[96..104].copy_from_slice(&self.total_refund_ckb.to_le_bytes());
        bytes[104..112].copy_from_slice(&self.total_refund_tokens.to_le_bytes());
        bytes[112..120].copy_from_slice(&self.claim_count.to_le_bytes());
        bytes[120..128].copy_from_slice(&self.claims_processed.to_le_bytes());
        bytes[128..129].copy_from_slice(&self.status.to_le_bytes());
        bytes[129..137].copy_from_slice(&self.refund_start_time.to_le_bytes());
        bytes[137..145].copy_from_slice(&self.refund_end_time.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() != REFUND_DATA_SIZE {
            return Err("Invalid refund data length");
        }

        let mut merkle_root = [0u8; 32];
        merkle_root.copy_from_slice(&bytes[0..32]);

        let mut launch_id = [0u8; 32];
        launch_id.copy_from_slice(&bytes[32..64]);

        let mut curve_id = [0u8; 32];
        curve_id.copy_from_slice(&bytes[64..96]);

        let total_refund_ckb = u64::from_le_bytes(bytes[96..104].try_into().unwrap());
        let total_refund_tokens = u64::from_le_bytes(bytes[104..112].try_into().unwrap());
        let claim_count = u64::from_le_bytes(bytes[112..120].try_into().unwrap());
        let claims_processed = u64::from_le_bytes(bytes[120..128].try_into().unwrap());
        let status = bytes[128];
        let refund_start_time = u64::from_le_bytes(bytes[129..137].try_into().unwrap());
        let refund_end_time = u64::from_le_bytes(bytes[137..145].try_into().unwrap());

        Ok(Self {
            merkle_root,
            launch_id,
            curve_id,
            total_refund_ckb,
            total_refund_tokens,
            claim_count,
            claims_processed,
            status,
            refund_start_time,
            refund_end_time,
            reserved: [0u8; 17],
        })
    }

    pub fn verify_merkle_proof(
        &self,
        leaf_hash: &[u8; 32],
        proof: &[[u8; 32]],
        index: u64,
    ) -> bool {
        if proof.is_empty() {
            return *leaf_hash == self.merkle_root;
        }

        let mut current_hash = *leaf_hash;
        let mut idx = index;

        for proof_hash in proof {
            let mut data = [0u8; 64];
            if idx % 2 == 0 {
                data[0..32].copy_from_slice(&current_hash);
                data[32..64].copy_from_slice(proof_hash);
            } else {
                data[0..32].copy_from_slice(proof_hash);
                data[32..64].copy_from_slice(&current_hash);
            }

            current_hash = blake2b_256(&data);
            idx /= 2;
        }

        current_hash == self.merkle_root
    }

    pub fn is_active(&self) -> bool {
        self.status == 1
    }

    pub fn is_completed(&self) -> bool {
        self.status == 2 || self.claims_processed >= self.claim_count
    }
}

#[repr(C)]
pub struct MerkleProof {
    pub index: u64,
    pub proof_hashes: [[u8; 32]; 16],
    pub proof_length: u8,
}

impl MerkleProof {
    pub fn new() -> Self {
        Self {
            index: 0,
            proof_hashes: [[0u8; 32]; 16],
            proof_length: 0,
        }
    }

    pub fn verify(&self, leaf: &[u8; 32], root: &[u8; 32]) -> bool {
        let mut current_hash = *leaf;
        let mut index = self.index;

        for i in 0..self.proof_length as usize {
            let proof_hash = self.proof_hashes[i];

            let mut data = [0u8; 64];
            if index % 2 == 0 {
                data[0..32].copy_from_slice(&current_hash);
                data[32..64].copy_from_slice(&proof_hash);
            } else {
                data[0..32].copy_from_slice(&proof_hash);
                data[32..64].copy_from_slice(&current_hash);
            }

            current_hash = blake2b_256(&data);
            index /= 2;
        }

        current_hash == *root
    }

    fn hash_pair(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
        let mut data = [0u8; 64];
        data[0..32].copy_from_slice(left);
        data[32..64].copy_from_slice(right);
        blake2b_256(&data)
    }
}

pub fn load_refund_claim() -> Result<RefundClaim, &'static str> {
    let data = load_cell_data(0, Source::GroupOutput)
        .map_err(|_| "Failed to load cell data")?;
    RefundClaim::from_bytes(&data)
}
