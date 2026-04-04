const { ccc } = require("@ckb-ccc/core");

const DCURVE_DATA_SIZE = 256;

const PRICE_MULTIPLIER_DISCOUNT = 95;
const PRICE_MULTIPLIER_BASELINE = 100;
const PRICE_MULTIPLIER_PREMIUM = 105;

const CURVE_STATUS_PENDING = 0;
const CURVE_STATUS_ACTIVE = 1;
const CURVE_STATUS_FILLED = 2;
const CURVE_STATUS_SUCCESS = 3;
const CURVE_STATUS_EXPIRED = 4;
const CURVE_STATUS_REFUNDED = 5;

function calculateCurvePrice(curve) {
  const {
    tokensAllocated,
    tokensSold,
    initialPriceScaled,
    priceMultiplierBps,
  } = curve;

  if (tokensAllocated === 0n || initialPriceScaled === 0n) {
    return initialPriceScaled;
  }

  const priceRatio = 10000n + (tokensSold * 10000n) / tokensAllocated;
  const adjustedPrice = (initialPriceScaled * priceRatio) / 10000n;

  return (adjustedPrice * BigInt(priceMultiplierBps)) / 100n;
}

function calculateTokensForCkb(ckbAmount, curve) {
  const price = calculateCurvePrice(curve);

  if (price === 0n) {
    return 0n;
  }

  return (ckbAmount * 1_000_000_000_000n) / price;
}

function calculateCkbForTokens(tokenAmount, curve) {
  const price = calculateCurvePrice(curve);

  if (price === 0n) {
    return 0n;
  }

  return (tokenAmount * price) / 1_000_000_000_000n;
}

function calculatePriceImpact(ckbAmount, curve) {
  const priceBefore = calculateCurvePrice(curve);
  const tokensReceived = calculateTokensForCkb(ckbAmount, curve);

  const newCurve = { ...curve, tokensSold: curve.tokensSold + tokensReceived };
  const priceAfter = calculateCurvePrice(newCurve);

  const impactBps =
    priceAfter > priceBefore
      ? ((priceAfter - priceBefore) * 10000n) / priceBefore
      : 0n;

  return {
    priceBefore,
    priceAfter,
    impactBps,
    impactPercent: Number(impactBps) / 100,
    tokensReceived,
  };
}

function calculateArbitrageOpportunity(curveA, curveB) {
  const priceA = calculateCurvePrice(curveA);
  const priceB = calculateCurvePrice(curveB);

  if (priceA === 0n || priceB === 0n) {
    return { profitBps: 0n, profitPercent: 0, direction: null, priceA, priceB };
  }

  const profitBps =
    priceA > priceB
      ? ((priceA - priceB) * 10000n) / priceB
      : ((priceB - priceA) * 10000n) / priceA;

  return {
    profitBps,
    profitPercent: Number(profitBps) / 100,
    direction: priceA > priceB ? "B→A" : "A→B",
    priceA,
    priceB,
    buyCurve: priceA > priceB ? curveB : curveA,
    sellCurve: priceA > priceB ? curveA : curveB,
  };
}

function formatPrice(priceScaled) {
  const price = Number(priceScaled) / 1_000_000_000_000;
  return price.toFixed(6);
}

function createCurveConfig(params) {
  if (params.endTime <= params.startTime) {
    throw new Error("End time must be after start time");
  }

  if (params.priceMultiplierBps < 90 || params.priceMultiplierBps > 110) {
    throw new Error("Price multiplier must be between 90-110 bps");
  }

  if (params.targetCkb <= 0n) {
    throw new Error("Target CKB must be positive");
  }

  return {
    curveId: params.curveId,
    launchId: params.launchId,
    dexOperatorLockHash: params.dexOperatorLockHash,
    dexScriptHash: params.dexScriptHash,
    priceMultiplierBps: params.priceMultiplierBps,
    status: CURVE_STATUS_PENDING,
    startTime: params.startTime,
    endTime: params.endTime,
    launchOffsetBlocks: params.launchOffsetBlocks || 0n,
    targetCkb: params.targetCkb,
    currentCkb: 0n,
    tokensAllocated: 0n,
    tokensSold: 0n,
    contributorCount: 0n,
    stakeCkb: params.stakeCkb || 0n,
    feesGenerated: 0n,
    currentPriceScaled: params.initialPriceScaled,
    initialPriceScaled: params.initialPriceScaled,
  };
}

function encodeCurveData(curve) {
  const bytes = new Uint8Array(DCURVE_DATA_SIZE);

  bytes.set(ccc.bytesFrom(ccc.hexFrom(curve.curveId)), 0);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(curve.launchId)), 32);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(curve.dexOperatorLockHash)), 64);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(curve.dexScriptHash)), 96);
  bytes.set(ccc.numLeToBytes(curve.priceMultiplierBps, 2), 128);
  bytes[130] = curve.status;
  bytes.set(ccc.numLeToBytes(Number(curve.startTime), 8), 131);
  bytes.set(ccc.numLeToBytes(Number(curve.endTime), 8), 139);
  bytes.set(ccc.numLeToBytes(Number(curve.launchOffsetBlocks), 8), 147);
  bytes.set(ccc.numLeToBytes(Number(curve.targetCkb), 8), 155);
  bytes.set(ccc.numLeToBytes(Number(curve.currentCkb), 8), 163);
  bytes.set(ccc.numLeToBytes(Number(curve.tokensAllocated), 8), 171);
  bytes.set(ccc.numLeToBytes(Number(curve.tokensSold), 8), 179);
  bytes.set(ccc.numLeToBytes(Number(curve.contributorCount), 8), 187);
  bytes.set(ccc.numLeToBytes(Number(curve.stakeCkb), 8), 195);
  bytes.set(ccc.numLeToBytes(Number(curve.feesGenerated), 8), 203);
  bytes.set(ccc.numLeToBytes(Number(curve.currentPriceScaled), 8), 211);
  bytes.set(ccc.numLeToBytes(Number(curve.initialPriceScaled), 8), 219);

  return bytes;
}

function decodeCurveData(bytes) {
  if (bytes.length !== DCURVE_DATA_SIZE) {
    throw new Error(
      `Invalid curve data length: expected ${DCURVE_DATA_SIZE}, got ${bytes.length}`,
    );
  }

  return {
    curveId: ccc.hexFrom(bytes.slice(0, 32)),
    launchId: ccc.hexFrom(bytes.slice(32, 64)),
    dexOperatorLockHash: ccc.hexFrom(bytes.slice(64, 96)),
    dexScriptHash: ccc.hexFrom(bytes.slice(96, 128)),
    priceMultiplierBps: ccc.numLeFromBytes(bytes.slice(128, 130)),
    status: bytes[130],
    startTime: BigInt(ccc.numLeFromBytes(bytes.slice(131, 139))),
    endTime: BigInt(ccc.numLeFromBytes(bytes.slice(139, 147))),
    launchOffsetBlocks: BigInt(ccc.numLeFromBytes(bytes.slice(147, 155))),
    targetCkb: BigInt(ccc.numLeFromBytes(bytes.slice(155, 163))),
    currentCkb: BigInt(ccc.numLeFromBytes(bytes.slice(163, 171))),
    tokensAllocated: BigInt(ccc.numLeFromBytes(bytes.slice(171, 179))),
    tokensSold: BigInt(ccc.numLeFromBytes(bytes.slice(179, 187))),
    contributorCount: BigInt(ccc.numLeFromBytes(bytes.slice(187, 195))),
    stakeCkb: BigInt(ccc.numLeFromBytes(bytes.slice(195, 203))),
    feesGenerated: BigInt(ccc.numLeFromBytes(bytes.slice(203, 211))),
    currentPriceScaled: BigInt(ccc.numLeFromBytes(bytes.slice(211, 219))),
    initialPriceScaled: BigInt(ccc.numLeFromBytes(bytes.slice(219, 227))),
  };
}

function determineCurveStatus(curve, currentTime) {
  if (
    curve.status === CURVE_STATUS_SUCCESS ||
    curve.status === CURVE_STATUS_EXPIRED ||
    curve.status === CURVE_STATUS_REFUNDED
  ) {
    return curve.status;
  }

  if (curve.currentCkb >= curve.targetCkb) {
    return CURVE_STATUS_FILLED;
  }

  if (currentTime > curve.endTime) {
    return CURVE_STATUS_EXPIRED;
  }

  if (currentTime >= curve.startTime && curve.currentCkb < curve.targetCkb) {
    return CURVE_STATUS_ACTIVE;
  }

  return CURVE_STATUS_PENDING;
}

function isCurveActive(curve) {
  return (
    curve.status === CURVE_STATUS_ACTIVE && curve.currentCkb < curve.targetCkb
  );
}

function isCurveFilled(curve) {
  return (
    curve.currentCkb >= curve.targetCkb || curve.status === CURVE_STATUS_FILLED
  );
}

function isCurveExpired(curve, currentTime) {
  return currentTime > curve.endTime;
}

function isWithinContributionWindow(curve, currentTime) {
  return (
    curve.status === CURVE_STATUS_ACTIVE &&
    currentTime >= curve.startTime &&
    currentTime <= curve.endTime &&
    curve.currentCkb < curve.targetCkb
  );
}

module.exports = {
  DCURVE_DATA_SIZE,
  PRICE_MULTIPLIER_DISCOUNT,
  PRICE_MULTIPLIER_BASELINE,
  PRICE_MULTIPLIER_PREMIUM,
  CURVE_STATUS_PENDING,
  CURVE_STATUS_ACTIVE,
  CURVE_STATUS_FILLED,
  CURVE_STATUS_SUCCESS,
  CURVE_STATUS_EXPIRED,
  CURVE_STATUS_REFUNDED,

  calculateCurvePrice,
  calculateTokensForCkb,
  calculateCkbForTokens,
  calculatePriceImpact,
  calculateArbitrageOpportunity,
  formatPrice,

  createCurveConfig,
  encodeCurveData,
  decodeCurveData,
  determineCurveStatus,

  isCurveActive,
  isCurveFilled,
  isCurveExpired,
  isWithinContributionWindow,
};
