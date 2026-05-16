const { ccc } = require("@ckb-ccc/core");
const merkle = require("./modules/merkle");

const REFUND_DATA_SIZE = 162;
const HASH_SIZE = merkle.HASH_SIZE;

const REFUND_STATUS_PENDING = 0;
const REFUND_STATUS_ACTIVE = 1;
const REFUND_STATUS_COMPLETED = 2;

function createRefundClaim(params) {
  if (params.refundEndTime <= params.refundStartTime) {
    throw new Error("Refund end time must be after start time");
  }

  if (!params.merkleRoot || params.merkleRoot.length !== 66) {
    throw new Error("Invalid merkle root format (expected 32-byte hex string)");
  }

  return {
    merkleRoot: params.merkleRoot,
    launchId: params.launchId,
    curveId: params.curveId,
    totalRefundCkb: params.totalRefundCkb,
    totalRefundTokens: params.totalRefundTokens,
    claimCount: 0n,
    claimsProcessed: 0n,
    status: REFUND_STATUS_PENDING,
    refundStartTime: params.refundStartTime,
    refundEndTime: params.refundEndTime,
  };
}

function encodeRefundClaim(claim) {
  const bytes = new Uint8Array(REFUND_DATA_SIZE);

  bytes.set(ccc.bytesFrom(ccc.hexFrom(claim.merkleRoot)), 0);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(claim.launchId)), 32);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(claim.curveId)), 64);
  bytes.set(ccc.numLeToBytes(Number(claim.totalRefundCkb), 8), 96);
  bytes.set(ccc.numLeToBytes(Number(claim.totalRefundTokens), 8), 104);
  bytes.set(ccc.numLeToBytes(Number(claim.claimCount), 8), 112);
  bytes.set(ccc.numLeToBytes(Number(claim.claimsProcessed), 8), 120);
  bytes[128] = claim.status;
  bytes.set(ccc.numLeToBytes(Number(claim.refundStartTime), 8), 129);
  bytes.set(ccc.numLeToBytes(Number(claim.refundEndTime), 8), 137);

  return bytes;
}

function decodeRefundClaim(bytes) {
  if (bytes.length !== REFUND_DATA_SIZE) {
    throw new Error(
      `Invalid refund data length: expected ${REFUND_DATA_SIZE}, got ${bytes.length}`,
    );
  }

  return {
    merkleRoot: ccc.hexFrom(bytes.slice(0, 32)),
    launchId: ccc.hexFrom(bytes.slice(32, 64)),
    curveId: ccc.hexFrom(bytes.slice(64, 96)),
    totalRefundCkb: BigInt(ccc.numLeFromBytes(bytes.slice(96, 104))),
    totalRefundTokens: BigInt(ccc.numLeFromBytes(bytes.slice(104, 112))),
    claimCount: BigInt(ccc.numLeFromBytes(bytes.slice(112, 120))),
    claimsProcessed: BigInt(ccc.numLeFromBytes(bytes.slice(120, 128))),
    status: bytes[128],
    refundStartTime: BigInt(ccc.numLeFromBytes(bytes.slice(129, 137))),
    refundEndTime: BigInt(ccc.numLeFromBytes(bytes.slice(137, 145))),
  };
}

function buildWitnessData(leafHash, proof) {
  const proofLength = Math.min(proof.proof.length, 32);
  const totalSize = 32 + 1 + proofLength * 32 + 8;
  const bytes = new Uint8Array(totalSize);

  bytes.set(leafHash, 0);

  bytes[32] = proofLength;

  for (let i = 0; i < proofLength; i++) {
    const hash =
      proof.proof[i].hash instanceof Uint8Array
        ? proof.proof[i].hash
        : ccc.bytesFrom(proof.proof[i].hash);
    bytes.set(hash, 33 + i * 32);
  }

  const indexBytes = ccc.numLeToBytes(proof.index, 8);
  bytes.set(indexBytes, 33 + proofLength * 32);

  return bytes;
}

function determineRefundStatus(claim, currentTime) {
  if (claim.status === REFUND_STATUS_COMPLETED) {
    return claim.status;
  }

  if (claim.claimsProcessed >= claim.claimCount && claim.claimCount > 0n) {
    return REFUND_STATUS_COMPLETED;
  }

  if (
    currentTime >= claim.refundStartTime &&
    currentTime <= claim.refundEndTime
  ) {
    return REFUND_STATUS_ACTIVE;
  }

  if (currentTime > claim.refundEndTime) {
    return REFUND_STATUS_COMPLETED;
  }

  return REFUND_STATUS_PENDING;
}

function isRefundActive(claim, currentTime) {
  return (
    claim.status === REFUND_STATUS_ACTIVE &&
    currentTime >= claim.refundStartTime &&
    currentTime <= claim.refundEndTime &&
    claim.claimsProcessed < claim.claimCount
  );
}

module.exports = {
  REFUND_DATA_SIZE,
  HASH_SIZE,
  REFUND_STATUS_PENDING,
  REFUND_STATUS_ACTIVE,
  REFUND_STATUS_COMPLETED,

  createRefundClaim,
  encodeRefundClaim,
  decodeRefundClaim,
  buildWitnessData,
  determineRefundStatus,
  isRefundActive,

  hashPair: merkle.hashPair,
  generateMerkleRoot: merkle.generateMerkleRoot,
  generateMerkleProof: merkle.generateMerkleProof,
  verifyMerkleProof: merkle.verifyMerkleProof,
  createClaimLeaf: merkle.createClaimLeaf,
  generateBatchProofs: merkle.generateBatchProofs,
};
