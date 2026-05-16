const { ccc } = require("@ckb-ccc/core");
const crypto = require("crypto");

function hashToBytes32(input) {
  if (typeof input !== "string" || input.length === 0) {
    throw new Error("Input must be a non-empty string");
  }
  return "0x" + crypto.createHash("sha256").update(input).digest("hex");
}

function hashDexName(name) {
  return hashToBytes32(name);
}

function generateUniqueId(inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error("Inputs must be a non-empty array");
  }

  const hash = crypto.createHash("sha256");

  for (const input of inputs) {
    if (typeof input === "string") {
      if (input.startsWith("0x")) {
        const bytes = ccc.bytesFrom(input);
        hash.update(Buffer.from(bytes));
      } else {
        hash.update(Buffer.from(input, "utf8"));
      }
    } else if (input instanceof Uint8Array) {
      hash.update(Buffer.from(input));
    } else if (typeof input === "bigint") {
      const bytes = ccc.numLeToBytes(Number(input), 8);
      hash.update(Buffer.from(bytes));
    } else if (typeof input === "number") {
      const bytes = ccc.numLeToBytes(input, 8);
      hash.update(Buffer.from(bytes));
    } else {
      throw new Error(`Unsupported input type: ${typeof input}`);
    }
  }

  return "0x" + hash.digest("hex");
}

function generateDexId(factoryHash, ownerHash, bump) {
  return generateUniqueId([factoryHash, ownerHash, bump]);
}

function generateLaunchId(creatorLockHash, bump) {
  return generateUniqueId([creatorLockHash, bump]);
}

function generateCurveId(launchId, dexOperatorLockHash, bump) {
  return generateUniqueId([launchId, dexOperatorLockHash, bump]);
}

function generatePoolId(tokenATypeHash, tokenBTypeHash, bump) {
  return generateUniqueId([tokenATypeHash, tokenBTypeHash, bump]);
}

function validateBytes32(value, name = "value") {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string`);
  }
  if (!value.startsWith("0x")) {
    throw new Error(`${name} must start with 0x`);
  }
  const hexPart = value.slice(2);
  if (hexPart.length !== 64) {
    throw new Error(
      `${name} must be 32 bytes (64 hex chars), got ${hexPart.length / 2} bytes`,
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    throw new Error(`${name} must be valid hex`);
  }
}

module.exports = {
  hashToBytes32,
  hashDexName,
  generateUniqueId,
  generateDexId,
  generateLaunchId,
  generateCurveId,
  generatePoolId,
  validateBytes32,
};
