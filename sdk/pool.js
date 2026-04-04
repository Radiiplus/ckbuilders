const { ccc } = require("@ckb-ccc/core");

const MINIMUM_LIQUIDITY = 1_000n;
const MAX_FEE_BPS = 1000n;
const DEFAULT_FEE_BPS = 30n;
const POOL_DATA_SIZE = 152;

function encodePoolData(data) {
  const bytes = new Uint8Array(POOL_DATA_SIZE);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(data.poolId)), 0);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(data.tokenATypeHash)), 32);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(data.tokenBTypeHash)), 64);
  bytes.set(ccc.numLeToBytes(Number(data.reserveA), 8), 96);
  bytes.set(ccc.numLeToBytes(Number(data.reserveB), 8), 104);
  bytes.set(ccc.numLeToBytes(Number(data.feeBps), 2), 112);
  bytes.set(ccc.numLeToBytes(Number(data.lpSupply), 8), 120);
  bytes.set(ccc.numLeToBytes(Number(data.kLast), 8), 128);
  bytes.set(ccc.numLeToBytes(Number(data.bump), 8), 136);
  bytes.set(ccc.numLeToBytes(Number(data.createdAt), 8), 144);
  return bytes;
}

function decodePoolData(bytes) {
  if (bytes.length !== POOL_DATA_SIZE) {
    throw new Error(
      `Invalid pool data length: expected ${POOL_DATA_SIZE}, got ${bytes.length}`,
    );
  }
  return {
    poolId: ccc.hexFrom(bytes.slice(0, 32)),
    tokenATypeHash: ccc.hexFrom(bytes.slice(32, 64)),
    tokenBTypeHash: ccc.hexFrom(bytes.slice(64, 96)),
    reserveA: ccc.numLeFromBytes(bytes.slice(96, 104)),
    reserveB: ccc.numLeFromBytes(bytes.slice(104, 112)),
    feeBps: ccc.numLeFromBytes(bytes.slice(112, 120)),
    lpSupply: ccc.numLeFromBytes(bytes.slice(120, 128)),
    kLast: ccc.numLeFromBytes(bytes.slice(128, 136)),
    bump: ccc.numLeFromBytes(bytes.slice(136, 144)),
    createdAt: ccc.numLeFromBytes(bytes.slice(144, 152)),
  };
}

function calculateSwapOutput(
  reserveIn,
  reserveOut,
  amountIn,
  feeBps = DEFAULT_FEE_BPS,
) {
  if (amountIn === 0n) throw new Error("Invalid amount: amountIn must be > 0");
  if (reserveIn === 0n || reserveOut === 0n)
    throw new Error("Invalid reserves: reserves must be > 0");

  const amountInWithFee = amountIn * (10000n - feeBps);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;

  if (denominator === 0n)
    throw new Error("Calculation error: division by zero");

  const amountOut = numerator / denominator;
  const fee = (amountOut * feeBps) / 10000n;

  if (amountOut === 0n) throw new Error("Insufficient output amount");

  const spotPrice = Number(reserveOut) / Number(reserveIn);
  const effectivePrice = Number(amountOut) / Number(amountIn);
  const priceImpact = ((spotPrice - effectivePrice) / spotPrice) * 100;

  return { amountIn, amountOut, fee, priceImpact, effectivePrice };
}

function calculateLiquidityMint(
  reserveA,
  reserveB,
  lpSupply,
  amountA,
  amountB,
) {
  let lpTokens;

  if (lpSupply === 0n) {
    const product = BigInt(
      Math.floor(Math.sqrt(Number(amountA) * Number(amountB))),
    );
    lpTokens = product - MINIMUM_LIQUIDITY;
    if (lpTokens <= 0n) throw new Error("Insufficient liquidity minted");
  } else {
    const lpA = (amountA * lpSupply) / reserveA;
    const lpB = (amountB * lpSupply) / reserveB;
    lpTokens = lpA < lpB ? lpA : lpB;
  }

  const shareOfPool =
    lpSupply > 0n
      ? (Number(lpTokens) / (Number(lpSupply) + Number(lpTokens))) * 100
      : 100;

  return { lpTokens, shareOfPool, valueA: amountA, valueB: amountB };
}

function calculateLiquidityRemove(reserveA, reserveB, lpSupply, lpAmount) {
  if (lpAmount > lpSupply) throw new Error("Insufficient LP tokens");
  const amountA = (lpAmount * reserveA) / lpSupply;
  const amountB = (lpAmount * reserveB) / lpSupply;
  return { amountA, amountB };
}

function calculateK(reserveA, reserveB) {
  return reserveA * reserveB;
}

function validateKInvariant(reserveA, reserveB, newReserveA, newReserveB) {
  const kBefore = calculateK(reserveA, reserveB);
  const kAfter = calculateK(newReserveA, newReserveB);
  return kAfter >= kBefore;
}

function calculateInitialLP(amountA, amountB) {
  const product = amountA * amountB;
  const sqrt = bigintSqrt(product);
  const lpSupply = sqrt - MINIMUM_LIQUIDITY;
  if (lpSupply <= 0n) throw new Error("Insufficient initial liquidity");
  return lpSupply;
}

function bigintSqrt(n) {
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

const VAULT_DATA_SIZE = 192;
const DEFAULT_LP_FEE_BPS = 7000;
const DEFAULT_OPERATOR_FEE_BPS = 2000;
const DEFAULT_PROTOCOL_FEE_BPS = 1000;

function createVault(vaultId, launchId, options = {}) {
  return {
    vaultId,
    launchId,
    totalFeesCollected: 0n,
    totalFeesDistributed: 0n,
    lpCount: 0n,
    totalLpShares: 0n,
    lastDistributionTime: 0n,
    distributionCount: 0n,
    lpFeeBps: options.lpFeeBps || DEFAULT_LP_FEE_BPS,
    operatorFeeBps: options.operatorFeeBps || DEFAULT_OPERATOR_FEE_BPS,
    protocolFeeBps: options.protocolFeeBps || DEFAULT_PROTOCOL_FEE_BPS,
  };
}

function addFees(vault, feeAmount) {
  return { ...vault, totalFeesCollected: vault.totalFeesCollected + feeAmount };
}

function calculateLpShare(vault, lpShares) {
  if (vault.totalLpShares === 0n || lpShares === 0n) return 0n;
  const lpPortion =
    (vault.totalFeesCollected * BigInt(vault.lpFeeBps)) / 10000n;
  return (lpPortion * lpShares) / vault.totalLpShares;
}

function calculateOperatorShare(vault) {
  return (vault.totalFeesCollected * BigInt(vault.operatorFeeBps)) / 10000n;
}

function calculateProtocolShare(vault) {
  return (vault.totalFeesCollected * BigInt(vault.protocolFeeBps)) / 10000n;
}

function recordDistribution(vault, amount, currentTime) {
  return {
    ...vault,
    totalFeesDistributed: vault.totalFeesDistributed + amount,
    lastDistributionTime: currentTime,
    distributionCount: vault.distributionCount + 1n,
  };
}

function getDistributableFees(vault) {
  return vault.totalFeesCollected - vault.totalFeesDistributed;
}

function hasFeesToDistribute(vault) {
  return getDistributableFees(vault) > 0n;
}

function encodeVaultData(vault) {
  const bytes = new Uint8Array(VAULT_DATA_SIZE);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(vault.vaultId)), 0);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(vault.launchId)), 32);
  bytes.set(ccc.numLeToBytes(Number(vault.totalFeesCollected), 8), 64);
  bytes.set(ccc.numLeToBytes(Number(vault.totalFeesDistributed), 8), 72);
  bytes.set(ccc.numLeToBytes(Number(vault.lpCount), 8), 80);
  bytes.set(ccc.numLeToBytes(Number(vault.totalLpShares), 8), 88);
  bytes.set(ccc.numLeToBytes(Number(vault.lastDistributionTime), 8), 96);
  bytes.set(ccc.numLeToBytes(Number(vault.distributionCount), 8), 104);
  bytes.set(ccc.numLeToBytes(vault.lpFeeBps, 2), 112);
  bytes.set(ccc.numLeToBytes(vault.operatorFeeBps, 2), 114);
  bytes.set(ccc.numLeToBytes(vault.protocolFeeBps, 2), 116);
  return bytes;
}

function decodeVaultData(bytes) {
  if (bytes.length !== VAULT_DATA_SIZE) {
    throw new Error("Invalid vault data length");
  }
  return {
    vaultId: ccc.hexFrom(bytes.slice(0, 32)),
    launchId: ccc.hexFrom(bytes.slice(32, 64)),
    totalFeesCollected: BigInt(ccc.numLeFromBytes(bytes.slice(64, 72))),
    totalFeesDistributed: BigInt(ccc.numLeFromBytes(bytes.slice(72, 80))),
    lpCount: BigInt(ccc.numLeFromBytes(bytes.slice(80, 88))),
    totalLpShares: BigInt(ccc.numLeFromBytes(bytes.slice(88, 96))),
    lastDistributionTime: BigInt(ccc.numLeFromBytes(bytes.slice(96, 104))),
    distributionCount: BigInt(ccc.numLeFromBytes(bytes.slice(104, 112))),
    lpFeeBps: ccc.numLeFromBytes(bytes.slice(112, 114)),
    operatorFeeBps: ccc.numLeFromBytes(bytes.slice(114, 116)),
    protocolFeeBps: ccc.numLeFromBytes(bytes.slice(116, 118)),
  };
}

function getFeeBreakdown(vault) {
  const totalFees = vault.totalFeesCollected;
  return {
    totalFees,
    lpPortion: (totalFees * BigInt(vault.lpFeeBps)) / 10000n,
    operatorPortion: (totalFees * BigInt(vault.operatorFeeBps)) / 10000n,
    protocolPortion: (totalFees * BigInt(vault.protocolFeeBps)) / 10000n,
    lpFeePercent: vault.lpFeeBps / 100,
    operatorFeePercent: vault.operatorFeeBps / 100,
    protocolFeePercent: vault.protocolFeeBps / 100,
  };
}

module.exports = {
  MINIMUM_LIQUIDITY,
  MAX_FEE_BPS,
  DEFAULT_FEE_BPS,
  POOL_DATA_SIZE,

  encodePoolData,
  decodePoolData,

  calculateSwapOutput,
  calculateLiquidityMint,
  calculateLiquidityRemove,
  calculateK,
  validateKInvariant,
  calculateInitialLP,

  VAULT_DATA_SIZE,
  DEFAULT_LP_FEE_BPS,
  DEFAULT_OPERATOR_FEE_BPS,
  DEFAULT_PROTOCOL_FEE_BPS,

  createVault,
  addFees,
  calculateLpShare,
  calculateOperatorShare,
  calculateProtocolShare,
  recordDistribution,
  getDistributableFees,
  hasFeesToDistribute,
  encodeVaultData,
  decodeVaultData,
  getFeeBreakdown,
};
