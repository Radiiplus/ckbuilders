const merkle = require("./modules/merkle");

module.exports = {
  hashPair: merkle.hashPair,
  generateMerkleRoot: merkle.generateMerkleRoot,
  generateMerkleProof: merkle.generateMerkleProof,
  verifyMerkleProof: merkle.verifyMerkleProof,
  serializeClaim: merkle.serializeClaim,
  createClaimLeaf: merkle.createClaimLeaf,
  generateBatchProofs: merkle.generateBatchProofs,
  encodeProof: merkle.encodeProof,
  decodeProof: merkle.decodeProof,
  formatProof: merkle.formatProof,
  HASH_SIZE: merkle.HASH_SIZE,
  MAX_PROOF_DEPTH: merkle.MAX_PROOF_DEPTH,
};
