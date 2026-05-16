const { ccc } = require("@ckb-ccc/core");
const { blake2b } = require("@noble/hashes/blake2.js");

const HASH_SIZE = 32;
const MAX_PROOF_DEPTH = 16;

function hashPair(left, right) {
  const combined = new Uint8Array(HASH_SIZE * 2);
  combined.set(left, 0);
  combined.set(right, HASH_SIZE);
  return blake2b(combined, { dkLen: HASH_SIZE });
}

function generateMerkleRoot(leaves) {
  if (leaves.length === 0) {
    throw new Error("Cannot generate root from empty leaves");
  }

  let level = [...leaves];

  while (level.length > 1) {
    const nextLevel = [];

    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        nextLevel.push(hashPair(level[i], level[i + 1]));
      } else {
        nextLevel.push(level[i]);
      }
    }

    level = nextLevel;
  }

  return level[0];
}

function generateMerkleProof(leaves, index) {
  if (leaves.length === 0) {
    throw new Error("Cannot generate proof from empty leaves");
  }

  if (index < 0 || index >= leaves.length) {
    throw new Error(`Index ${index} out of range [0, ${leaves.length - 1}]`);
  }

  const proof = [];
  let level = [...leaves];
  let idx = index;

  while (level.length > 1) {
    const nextLevel = [];

    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        nextLevel.push(hashPair(level[i], level[i + 1]));

        if (i === idx || i + 1 === idx) {
          const siblingIndex = i === idx ? i + 1 : i;
          proof.push({
            hash: level[siblingIndex],
            position: i === idx ? "right" : "left",
          });
        }
      } else {
        nextLevel.push(level[i]);
      }
    }

    level = nextLevel;
    idx = Math.floor(idx / 2);
  }

  return {
    proof,
    root: level[0],
    index,
  };
}

function verifyMerkleProof(leaf, proof) {
  let currentHash = leaf;
  let index = proof.index;

  for (const step of proof.proof) {
    if (step.position === "right") {
      currentHash = hashPair(currentHash, step.hash);
    } else {
      currentHash = hashPair(step.hash, currentHash);
    }
    index = Math.floor(index / 2);
  }

  const rootBytes =
    proof.root instanceof Uint8Array ? proof.root : ccc.bytesFrom(proof.root);

  return currentHash.every((byte, i) => byte === rootBytes[i]);
}

function serializeClaim(claim) {
  if (!claim.address || typeof claim.address !== "string") {
    throw new Error("claim.address is required and must be a string");
  }
  if (claim.amount === undefined || claim.amount === null) {
    throw new Error("claim.amount is required");
  }
  if (!claim.launchId || typeof claim.launchId !== "string") {
    throw new Error("claim.launchId is required and must be a string");
  }

  const encoder = new TextEncoder();

  const addressBytes = ccc.bytesFrom(claim.address);

  const amountStr = claim.amount.toString();
  const amountBytes = encoder.encode(amountStr);

  const launchIdBytes = ccc.bytesFrom(claim.launchId);

  const totalLength =
    addressBytes.length + 1 + amountBytes.length + 1 + launchIdBytes.length;
  const result = new Uint8Array(totalLength);

  let offset = 0;
  result.set(addressBytes, offset);
  offset += addressBytes.length;
  result[offset++] = 0x00;
  result.set(amountBytes, offset);
  offset += amountBytes.length;
  result[offset++] = 0x00;
  result.set(launchIdBytes, offset);

  return result;
}

function createClaimLeaf(claim) {
  const serialized = serializeClaim(claim);
  return blake2b(serialized, { dkLen: HASH_SIZE });
}

function generateBatchProofs(claims) {
  const leaves = claims.map((claim) => createClaimLeaf(claim));
  const root = generateMerkleRoot(leaves);

  return claims.map((claim, index) => {
    const { proof } = generateMerkleProof(leaves, index);
    return {
      claim,
      proof: {
        proof,
        root,
        index,
      },
      leaf: leaves[index],
    };
  });
}

function encodeProof(proof) {
  const proofLength = Math.min(proof.proof.length, MAX_PROOF_DEPTH);
  const bytes = new Uint8Array(1 + proofLength * HASH_SIZE);

  bytes[0] = proofLength;

  for (let i = 0; i < proofLength; i++) {
    const hash =
      proof.proof[i].hash instanceof Uint8Array
        ? proof.proof[i].hash
        : ccc.bytesFrom(proof.proof[i].hash);
    bytes.set(hash, 1 + i * HASH_SIZE);
  }

  return bytes;
}

function decodeProof(bytes) {
  const proofLength = bytes[0];
  const proof = [];

  for (let i = 0; i < proofLength; i++) {
    const hash = bytes.slice(1 + i * HASH_SIZE, 1 + (i + 1) * HASH_SIZE);
    proof.push({
      hash,
      position: i % 2 === 0 ? "right" : "left",
    });
  }

  return {
    proof,
    root: bytes.slice(1 + proofLength * HASH_SIZE),
    index: 0,
  };
}

function formatProof(proof) {
  return {
    root: ccc.hexFrom(proof.root),
    index: proof.index,
    proofLength: proof.proof.length,
    proof: proof.proof.map((step, i) => ({
      index: i,
      hash: ccc.hexFrom(step.hash),
      position: step.position,
    })),
  };
}

module.exports = {
  hashPair,
  generateMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  serializeClaim,
  createClaimLeaf,
  generateBatchProofs,
  encodeProof,
  decodeProof,
  formatProof,
  HASH_SIZE,
  MAX_PROOF_DEPTH,
};
