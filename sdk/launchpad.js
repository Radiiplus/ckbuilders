const { ccc } = require("@ckb-ccc/core");
const { validateBytes32, generateLaunchId } = require("./modules/crypto");
const {
  encodeCurveData,
  createCurveConfig,
  calculateTokensForCkb,
  CURVE_STATUS_ACTIVE,
  CURVE_STATUS_FILLED,
} = require("./curve");
const {
  encodeRefundClaim,
  buildWitnessData,
  REFUND_STATUS_ACTIVE,
} = require("./refund");
const { calculateMinimumCapacity } = require("./txbuilder");
const { createClaimLeaf, generateMerkleProof } = require("./modules/merkle");

const LAUNCH_DATA_SIZE = 512;

const STATUS_PENDING = 0;
const STATUS_ACTIVE = 1;
const STATUS_SUCCESS = 2;
const STATUS_EXPIRED = 3;
const STATUS_CANCELLED = 4;

const DEFAULT_PRICE_MULTIPLIER_BPS = 100;

function createLaunchConfig(params, options = {}) {
  if (params.endTime <= params.startTime) {
    throw new Error("End time must be after start time");
  }

  const priceMultiplierBps =
    params.priceMultiplierBps ?? DEFAULT_PRICE_MULTIPLIER_BPS;
  if (priceMultiplierBps < 90 || priceMultiplierBps > 110) {
    throw new Error("Price multiplier must be between 90-110 bps");
  }

  if (params.targetCkb <= 0n) throw new Error("Target CKB must be positive");
  if (params.maxCkb < params.targetCkb)
    throw new Error("Max CKB must be >= target CKB");

  const nameBytes = new TextEncoder().encode(params.tokenName);
  if (nameBytes.length > 32)
    throw new Error("Token name too long (max 32 bytes)");
  const symbolBytes = new TextEncoder().encode(params.tokenSymbol);
  if (symbolBytes.length > 16)
    throw new Error("Token symbol too long (max 16 bytes)");

  validateBytes32(params.launchId, "params.launchId");
  validateBytes32(params.creatorLockHash, "params.creatorLockHash");
  validateBytes32(params.tokenTypeHash, "params.tokenTypeHash");
  validateBytes32(params.dexScriptHash, "params.dexScriptHash");

  if (!options.registryEntryHash)
    throw new Error("options.registryEntryHash is required");
  validateBytes32(options.registryEntryHash, "options.registryEntryHash");

  if (options.stakeCkb === undefined || options.stakeCkb === null)
    throw new Error("options.stakeCkb is required");
  if (typeof options.stakeCkb !== "bigint")
    throw new Error("options.stakeCkb must be a bigint");

  if (options.feeBps === undefined || options.feeBps === null)
    throw new Error("options.feeBps is required");
  if (
    typeof options.feeBps !== "number" ||
    options.feeBps < 0 ||
    options.feeBps > 10000
  ) {
    throw new Error("options.feeBps must be between 0 and 10000");
  }

  return {
    launchId: params.launchId,
    creatorLockHash: params.creatorLockHash,
    tokenTypeHash: params.tokenTypeHash,
    tokenName: params.tokenName,
    tokenSymbol: params.tokenSymbol,
    totalSupply: params.totalSupply,
    targetCkb: params.targetCkb,
    maxCkb: params.maxCkb,
    priceMultiplierBps,
    status: STATUS_PENDING,
    startTime: params.startTime,
    endTime: params.endTime,
    launchOffset: 0n,
    totalContributedCkb: 0n,
    totalTokensAllocated: 0n,
    contributorCount: 0n,
    dexScriptHash: params.dexScriptHash,
    registryEntryHash: options.registryEntryHash,
    stakeCkb: options.stakeCkb,
    feeBps: options.feeBps,
  };
}

function encodeLaunchConfig(config) {
  const bytes = new Uint8Array(LAUNCH_DATA_SIZE);

  bytes.set(ccc.bytesFrom(ccc.hexFrom(config.launchId)), 0);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(config.creatorLockHash)), 32);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(config.tokenTypeHash)), 64);

  const nameBytes = new TextEncoder().encode(config.tokenName);
  bytes.set(nameBytes, 96);

  const symbolBytes = new TextEncoder().encode(config.tokenSymbol);
  bytes.set(symbolBytes, 128);

  bytes.set(ccc.numLeToBytes(Number(config.totalSupply), 8), 144);
  bytes.set(ccc.numLeToBytes(Number(config.targetCkb), 8), 152);
  bytes.set(ccc.numLeToBytes(Number(config.maxCkb), 8), 160);
  bytes.set(ccc.numLeToBytes(config.priceMultiplierBps, 2), 168);
  bytes[170] = config.status;
  bytes.set(ccc.numLeToBytes(Number(config.startTime), 8), 171);
  bytes.set(ccc.numLeToBytes(Number(config.endTime), 8), 179);
  bytes.set(ccc.numLeToBytes(Number(config.launchOffset), 8), 187);
  bytes.set(ccc.numLeToBytes(Number(config.totalContributedCkb), 8), 195);
  bytes.set(ccc.numLeToBytes(Number(config.totalTokensAllocated), 8), 203);
  bytes.set(ccc.numLeToBytes(Number(config.contributorCount), 8), 211);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(config.dexScriptHash)), 219);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(config.registryEntryHash)), 251);
  bytes.set(ccc.numLeToBytes(Number(config.stakeCkb), 8), 283);
  bytes.set(ccc.numLeToBytes(config.feeBps, 2), 291);

  return bytes;
}

function decodeLaunchConfig(bytes) {
  if (bytes.length !== LAUNCH_DATA_SIZE) {
    throw new Error(
      `Invalid launch config length: expected ${LAUNCH_DATA_SIZE}, got ${bytes.length}`,
    );
  }

  const readString = (start, length) => {
    const slice = bytes.slice(start, start + length);
    const nullIndex = slice.indexOf(0);
    const validSlice = nullIndex === -1 ? slice : slice.slice(0, nullIndex);
    return new TextDecoder().decode(validSlice);
  };

  return {
    launchId: ccc.hexFrom(bytes.slice(0, 32)),
    creatorLockHash: ccc.hexFrom(bytes.slice(32, 64)),
    tokenTypeHash: ccc.hexFrom(bytes.slice(64, 96)),
    tokenName: readString(96, 32),
    tokenSymbol: readString(128, 16),
    totalSupply: BigInt(ccc.numLeFromBytes(bytes.slice(144, 152))),
    targetCkb: BigInt(ccc.numLeFromBytes(bytes.slice(152, 160))),
    maxCkb: BigInt(ccc.numLeFromBytes(bytes.slice(160, 168))),
    priceMultiplierBps: ccc.numLeFromBytes(bytes.slice(168, 170)),
    status: bytes[170],
    startTime: BigInt(ccc.numLeFromBytes(bytes.slice(171, 179))),
    endTime: BigInt(ccc.numLeFromBytes(bytes.slice(179, 187))),
    launchOffset: BigInt(ccc.numLeFromBytes(bytes.slice(187, 195))),
    totalContributedCkb: BigInt(ccc.numLeFromBytes(bytes.slice(195, 203))),
    totalTokensAllocated: BigInt(ccc.numLeFromBytes(bytes.slice(203, 211))),
    contributorCount: BigInt(ccc.numLeFromBytes(bytes.slice(211, 219))),
    dexScriptHash: ccc.hexFrom(bytes.slice(219, 251)),
    registryEntryHash: ccc.hexFrom(bytes.slice(251, 283)),
    stakeCkb: BigInt(ccc.numLeFromBytes(bytes.slice(283, 291))),
    feeBps: ccc.numLeFromBytes(bytes.slice(291, 293)),
  };
}

function isWithinContributionWindow(config, currentTime) {
  return currentTime >= config.startTime && currentTime <= config.endTime;
}

function determineStatus(config, currentTime) {
  if (config.status === STATUS_SUCCESS || config.status === STATUS_CANCELLED) {
    return config.status;
  }
  if (config.totalContributedCkb >= config.targetCkb) return STATUS_SUCCESS;
  if (currentTime > config.endTime) return STATUS_EXPIRED;
  if (currentTime >= config.startTime) return STATUS_ACTIVE;
  return STATUS_PENDING;
}

function isValidTransition(from, to) {
  switch (from) {
    case STATUS_PENDING:
      return to === STATUS_ACTIVE || to === STATUS_EXPIRED;
    case STATUS_ACTIVE:
      return to === STATUS_SUCCESS || to === STATUS_EXPIRED;
    case STATUS_SUCCESS:
    case STATUS_EXPIRED:
    case STATUS_CANCELLED:
      return false;
    default:
      return false;
  }
}

function validateLockScriptHash(lockScriptHash, paramName) {
  if (!lockScriptHash || typeof lockScriptHash !== "string") {
    throw new Error(`${paramName} is required and must be a string`);
  }
  if (!lockScriptHash.startsWith("0x")) {
    throw new Error(`${paramName} must start with 0x`);
  }
  if (lockScriptHash.slice(2).length !== 64) {
    throw new Error(`${paramName} must be 32 bytes (64 hex chars)`);
  }
}

function buildCreateLaunchTx(params, options = {}) {
  const config = createLaunchConfig(params);
  const encodedData = encodeLaunchConfig(config);

  if (!options.lockScriptHash)
    throw new Error("options.lockScriptHash is required");
  validateLockScriptHash(options.lockScriptHash, "options.lockScriptHash");

  let capacity;
  if (options.lockScript) {
    capacity = calculateMinimumCapacity(
      options.lockScript,
      null,
      "0x" + Buffer.from(encodedData).toString("hex"),
    );
  } else {
    const dataSize = encodedData.length;
    capacity = BigInt(Math.ceil((70 + dataSize + 10) * 1e8));
  }

  return {
    outputs: [
      {
        lock: {
          codeHash: options.lockScriptHash,
          hashType: "type",
          args: config.launchId,
        },
        capacity,
      },
    ],
    outputsData: ["0x" + Buffer.from(encodedData).toString("hex")],
    cellDeps: options.cellDeps || [],
    headerDeps: [],
  };
}

function buildContributeTx(curve, ckbAmount, options = {}) {
  const tokensToReceive = calculateTokensForCkb(ckbAmount, curve);
  if (tokensToReceive === 0n)
    throw new Error("Invalid contribution: would receive 0 tokens");

  const remainingCkb = curve.targetCkb - curve.currentCkb;
  if (ckbAmount > remainingCkb) {
    throw new Error(
      `Contribution ${ckbAmount} exceeds remaining capacity ${remainingCkb}`,
    );
  }

  const updatedCurve = {
    ...curve,
    currentCkb: curve.currentCkb + ckbAmount,
    tokensSold: curve.tokensSold + tokensToReceive,
    contributorCount: curve.contributorCount + 1n,
  };
  if (updatedCurve.currentCkb >= updatedCurve.targetCkb) {
    updatedCurve.status = CURVE_STATUS_FILLED;
  }

  const encodedData = encodeCurveData(updatedCurve);

  if (!options.lockScriptHash)
    throw new Error("options.lockScriptHash is required");
  validateLockScriptHash(options.lockScriptHash, "options.lockScriptHash");

  let capacity;
  if (options.lockScript) {
    capacity = calculateMinimumCapacity(
      options.lockScript,
      null,
      "0x" + Buffer.from(encodedData).toString("hex"),
    );
  } else {
    capacity = BigInt(Math.ceil((70 + encodedData.length + 10) * 1e8));
  }

  return {
    outputs: [
      {
        lock: {
          codeHash: options.lockScriptHash,
          hashType: "type",
          args: curve.curveId,
        },
        capacity,
      },
    ],
    outputsData: ["0x" + Buffer.from(encodedData).toString("hex")],
    cellDeps: options.cellDeps || [],
    headerDeps: [],
    estimatedInputCkb: ckbAmount,
    estimatedOutputTokens: tokensToReceive,
  };
}

function buildFinalizeTx(launchConfig, options = {}) {
  if (launchConfig.totalContributedCkb < launchConfig.targetCkb) {
    throw new Error("Target not reached, cannot finalize");
  }
  if (!isValidTransition(launchConfig.status, STATUS_SUCCESS)) {
    throw new Error(
      `Invalid state transition from ${launchConfig.status} to SUCCESS`,
    );
  }

  const updatedConfig = { ...launchConfig, status: STATUS_SUCCESS };
  const encodedData = encodeLaunchConfig(updatedConfig);

  if (!options.creatorLockHash)
    throw new Error("options.creatorLockHash is required");
  validateLockScriptHash(options.creatorLockHash, "options.creatorLockHash");

  let capacity;
  if (options.lockScript) {
    capacity = calculateMinimumCapacity(
      options.lockScript,
      null,
      "0x" + Buffer.from(encodedData).toString("hex"),
    );
  } else {
    capacity = BigInt(Math.ceil((70 + encodedData.length + 10) * 1e8));
  }

  return {
    outputs: [
      {
        lock: {
          codeHash: options.creatorLockHash,
          hashType: "type",
          args: launchConfig.launchId,
        },
        capacity,
      },
    ],
    outputsData: ["0x" + Buffer.from(encodedData).toString("hex")],
    cellDeps: options.cellDeps || [],
    headerDeps: [],
  };
}

function buildClaimLpTx(launchConfig, claimParams, options = {}) {
  if (launchConfig.status !== STATUS_SUCCESS) {
    throw new Error("Launch not successful, cannot claim LP tokens");
  }

  const leafHash = createClaimLeaf({
    address: claimParams.claimantAddress,
    amount: claimParams.claimAmount,
    launchId: launchConfig.launchId,
  });
  const proof = generateMerkleProof(
    claimParams.merkleLeaves,
    claimParams.claimantIndex,
  );
  const witnessData = buildWitnessData(leafHash, proof);

  if (!options.claimantLockHash)
    throw new Error("options.claimantLockHash is required");
  validateLockScriptHash(options.claimantLockHash, "options.claimantLockHash");

  const lpTokenData = "0x";
  const capacity = options.lockScript
    ? calculateMinimumCapacity(options.lockScript, null, lpTokenData)
    : BigInt(Math.ceil((70 + 10) * 1e8));

  return {
    outputs: [
      {
        lock: {
          codeHash: options.claimantLockHash,
          hashType: "type",
          args: launchConfig.launchId,
        },
        capacity,
      },
    ],
    outputsData: [lpTokenData],
    witnesses: [witnessData],
    cellDeps: options.cellDeps || [],
    headerDeps: [],
  };
}

function buildRefundTx(refundClaim, claimParams, options = {}) {
  if (refundClaim.status !== REFUND_STATUS_ACTIVE) {
    throw new Error("Refund not active, cannot claim");
  }

  const leafHash = createClaimLeaf({
    address: claimParams.claimantAddress,
    amount: claimParams.claimAmount,
    launchId: refundClaim.launchId,
  });
  const proof = generateMerkleProof(
    claimParams.merkleLeaves,
    claimParams.claimantIndex,
  );
  const witnessData = buildWitnessData(leafHash, proof);

  const updatedRefund = {
    ...refundClaim,
    claimsProcessed: refundClaim.claimsProcessed + 1n,
  };
  if (updatedRefund.claimsProcessed >= updatedRefund.claimCount) {
    updatedRefund.status = REFUND_STATUS_ACTIVE + 1;
  }

  const encodedData = encodeRefundClaim(updatedRefund);

  if (!options.claimantLockHash)
    throw new Error("options.claimantLockHash is required");
  validateLockScriptHash(options.claimantLockHash, "options.claimantLockHash");

  let capacity;
  if (options.lockScript) {
    capacity = calculateMinimumCapacity(
      options.lockScript,
      null,
      "0x" + Buffer.from(encodedData).toString("hex"),
    );
  } else {
    capacity = BigInt(Math.ceil((70 + encodedData.length + 10) * 1e8));
  }

  return {
    outputs: [
      {
        lock: {
          codeHash: options.claimantLockHash,
          hashType: "type",
          args: refundClaim.launchId,
        },
        capacity,
      },
    ],
    outputsData: ["0x" + Buffer.from(encodedData).toString("hex")],
    witnesses: [witnessData],
    cellDeps: options.cellDeps || [],
    headerDeps: [],
  };
}

function buildDistributeFeesTx(vault, options = {}) {
  const availableFees = vault.totalFeesCollected - vault.totalFeesDistributed;
  if (availableFees <= 0n) throw new Error("No fees to distribute");

  const lpShare = (vault.totalFeesCollected * BigInt(vault.lpFeeBps)) / 10000n;
  const operatorShare =
    (vault.totalFeesCollected * BigInt(vault.operatorFeeBps)) / 10000n;
  const protocolShare =
    (vault.totalFeesCollected * BigInt(vault.protocolFeeBps)) / 10000n;

  const outputs = [];
  const outputsData = [];
  const minFeeCapacity = BigInt(Math.ceil((70 + 10) * 1e8));

  if (lpShare > 0n) {
    if (!options.lpLockHash)
      throw new Error("options.lpLockHash is required when lpShare > 0");
    validateLockScriptHash(options.lpLockHash, "options.lpLockHash");
    outputs.push({
      lock: {
        codeHash: options.lpLockHash,
        hashType: "type",
        args: vault.launchId,
      },
      capacity: lpShare > minFeeCapacity ? lpShare : minFeeCapacity,
    });
    outputsData.push("0x");
  }

  if (operatorShare > 0n) {
    if (!options.operatorLockHash)
      throw new Error(
        "options.operatorLockHash is required when operatorShare > 0",
      );
    validateLockScriptHash(
      options.operatorLockHash,
      "options.operatorLockHash",
    );
    outputs.push({
      lock: {
        codeHash: options.operatorLockHash,
        hashType: "type",
        args: vault.launchId,
      },
      capacity: operatorShare > minFeeCapacity ? operatorShare : minFeeCapacity,
    });
    outputsData.push("0x");
  }

  if (protocolShare > 0n) {
    if (!options.protocolLockHash)
      throw new Error(
        "options.protocolLockHash is required when protocolShare > 0",
      );
    validateLockScriptHash(
      options.protocolLockHash,
      "options.protocolLockHash",
    );
    outputs.push({
      lock: {
        codeHash: options.protocolLockHash,
        hashType: "type",
        args: vault.launchId,
      },
      capacity: protocolShare > minFeeCapacity ? protocolShare : minFeeCapacity,
    });
    outputsData.push("0x");
  }

  return {
    outputs,
    outputsData,
    cellDeps: options.cellDeps || [],
    headerDeps: [],
    breakdown: {
      lpShare,
      operatorShare,
      protocolShare,
      totalDistributed: lpShare + operatorShare + protocolShare,
    },
  };
}

module.exports = {
  LAUNCH_DATA_SIZE,
  STATUS_PENDING,
  STATUS_ACTIVE,
  STATUS_SUCCESS,
  STATUS_EXPIRED,
  STATUS_CANCELLED,
  DEFAULT_PRICE_MULTIPLIER_BPS,

  createLaunchConfig,
  encodeLaunchConfig,
  decodeLaunchConfig,
  isWithinContributionWindow,
  determineStatus,
  isValidTransition,
  generateLaunchId,

  buildCreateLaunchTx,
  buildContributeTx,
  buildFinalizeTx,
  buildClaimLpTx,
  buildRefundTx,
  buildDistributeFeesTx,
  validateLockScriptHash,

  encodeCurveData,
  createCurveConfig,
  calculateTokensForCkb,
  CURVE_STATUS_ACTIVE,
  CURVE_STATUS_FILLED,
};
