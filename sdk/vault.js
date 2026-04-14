const { ccc } = require("@ckb-ccc/core");

// --- Data sizes ---
const VAULT_DATA_SIZE = 512;

// --- Source tags for deposits ---
const VAULT_SOURCE_DEPOSIT = 1; // user deposits to seed pool liquidity
const VAULT_SOURCE_LAUNCH = 2; // launchpad bonding curve proceeds
const VAULT_SOURCE_FEE = 3; // swap fees collected from pools

// --- Operation modes ---
const VAULT_OP_INITIALIZE = 0;
const VAULT_OP_DEPOSIT = 1;
const VAULT_OP_WITHDRAW = 2;
const VAULT_OP_DISTRIBUTE = 3;
const VAULT_OP_COLLECT = 4;
const VAULT_OP_SEED_POOL = 5;
const VAULT_OP_UPDATE = 6;

// --- Default config ---
const DEFAULT_VAULT_CONFIG = {
  minDepositCkb: 100_000_000n, // 1 CKB minimum deposit
  sharePrecision: 18,
};

// --- Contract Type ID size ---
const TYPE_ID_SIZE = 20;

/**
 * Encode vault data into bytes for on-chain storage.
 */
function encodeVaultData(data) {
  const bytes = new Uint8Array(VAULT_DATA_SIZE);

  // Owner (32 bytes)
  const ownerBytes = ccc.bytesFrom(ccc.hexFrom(data.ownerLockHash));
  bytes.set(ownerBytes.slice(0, 32), 0);

  // Registered contract Type IDs (20 bytes each)
  if (data.factoryTypeId) {
    bytes.set(ccc.bytesFrom(ccc.hexFrom(data.factoryTypeId)).slice(0, 20), 32);
  }
  if (data.launchpadTypeId) {
    bytes.set(
      ccc.bytesFrom(ccc.hexFrom(data.launchpadTypeId)).slice(0, 20),
      52
    );
  }
  if (data.registryTypeId) {
    bytes.set(
      ccc.bytesFrom(ccc.hexFrom(data.registryTypeId)).slice(0, 20),
      72
    );
  }

  // Global accounting
  bytes.set(
    ccc.numLeToBytes(Number(data.totalDepositedCkb), 8),
    92
  );
  bytes.set(
    ccc.numLeToBytes(Number(data.totalWithdrawnCkb), 8),
    100
  );
  bytes.set(
    ccc.numLeToBytes(Number(data.totalSharesIssued), 8),
    108
  );
  bytes.set(
    ccc.numLeToBytes(Number(data.totalSharesBurned), 8),
    116
  );

  // Stage Fund
  bytes.set(
    ccc.numLeToBytes(Number(data.stageFundBalance), 8),
    124
  );
  bytes.set(
    ccc.numLeToBytes(Number(data.stageFundPoolCount), 8),
    132
  );

  // Accumulator
  bytes.set(
    ccc.numLeToBytes(Number(data.accumulatorBalance), 8),
    140
  );
  bytes.set(
    ccc.numLeToBytes(Number(data.accumulatorLaunchCount), 8),
    148
  );

  // Fee Router
  bytes.set(
    ccc.numLeToBytes(Number(data.feeRouterBalance), 8),
    156
  );
  bytes.set(
    ccc.numLeToBytes(Number(data.feeRouterDistributed), 8),
    164
  );

  // Revenue tracking
  bytes.set(
    ccc.numLeToBytes(Number(data.totalRevenueCkb), 8),
    172
  );
  bytes.set(
    ccc.numLeToBytes(Number(data.totalOutboundCkb), 8),
    180
  );

  // Pool seeding
  bytes.set(
    ccc.numLeToBytes(Number(data.lastPoolSeedCkb), 8),
    188
  );
  bytes.set(
    ccc.numLeToBytes(Number(data.lastPoolSeedTimestamp), 8),
    196
  );

  // Fee distribution
  bytes.set(
    ccc.numLeToBytes(Number(data.lastDistributionTimestamp), 8),
    204
  );
  bytes.set(
    ccc.numLeToBytes(Number(data.pendingDistributionCkb), 8),
    212
  );

  // Status & bump
  bytes[220] = data.status ?? 0;
  bytes.set(ccc.numLeToBytes(Number(data.bump), 8), 248);

  return bytes;
}

/**
 * Decode vault data from on-chain bytes.
 */
function decodeVaultData(bytes) {
  if (bytes.length !== VAULT_DATA_SIZE) {
    throw new Error(
      `Invalid vault data length: expected ${VAULT_DATA_SIZE}, got ${bytes.length}`
    );
  }
  return {
    // Owner
    ownerLockHash: ccc.hexFrom(bytes.slice(0, 32)),

    // Registered contract Type IDs
    factoryTypeId: ccc.hexFrom(bytes.slice(32, 52)),
    launchpadTypeId: ccc.hexFrom(bytes.slice(52, 72)),
    registryTypeId: ccc.hexFrom(bytes.slice(72, 92)),

    // Global accounting
    totalDepositedCkb: ccc.numLeFromBytes(bytes.slice(92, 100)),
    totalWithdrawnCkb: ccc.numLeFromBytes(bytes.slice(100, 108)),
    totalSharesIssued: ccc.numLeFromBytes(bytes.slice(108, 116)),
    totalSharesBurned: ccc.numLeFromBytes(bytes.slice(116, 124)),

    // Stage Fund
    stageFundBalance: ccc.numLeFromBytes(bytes.slice(124, 132)),
    stageFundPoolCount: ccc.numLeFromBytes(bytes.slice(132, 140)),

    // Accumulator
    accumulatorBalance: ccc.numLeFromBytes(bytes.slice(140, 148)),
    accumulatorLaunchCount: ccc.numLeFromBytes(bytes.slice(148, 156)),

    // Fee Router
    feeRouterBalance: ccc.numLeFromBytes(bytes.slice(156, 164)),
    feeRouterDistributed: ccc.numLeFromBytes(bytes.slice(164, 172)),

    // Revenue tracking
    totalRevenueCkb: ccc.numLeFromBytes(bytes.slice(172, 180)),
    totalOutboundCkb: ccc.numLeFromBytes(bytes.slice(180, 188)),

    // Pool seeding
    lastPoolSeedCkb: ccc.numLeFromBytes(bytes.slice(188, 196)),
    lastPoolSeedTimestamp: ccc.numLeFromBytes(bytes.slice(196, 204)),

    // Fee distribution
    lastDistributionTimestamp: ccc.numLeFromBytes(bytes.slice(204, 212)),
    pendingDistributionCkb: ccc.numLeFromBytes(bytes.slice(212, 220)),

    // Status & bump
    status: bytes[220],
    bump: ccc.numLeFromBytes(bytes.slice(248, 256)),
  };
}

/**
 * Create a vault config from registered contract Type IDs.
 */
function createVaultConfig(options = {}) {
  return {
    ownerLockHash: options.ownerLockHash || "0x" + "00".repeat(32),
    factoryTypeId: options.factoryTypeId || "0x" + "00".repeat(20),
    launchpadTypeId: options.launchpadTypeId || "0x" + "00".repeat(20),
    registryTypeId: options.registryTypeId || "0x" + "00".repeat(20),
  };
}

/**
 * Calculate share price in CKB per share.
 */
function calculateSharePrice(vault) {
  const totalShares = vault.totalSharesIssued || 0;
  if (totalShares === 0) return 0;
  const totalValue = getAvailableValue(vault);
  if (totalValue === 0) return 0;
  return totalValue / totalShares;
}

/**
 * Calculate the number of shares to mint for a deposit.
 */
function calculateMintShares(vault, depositCkb) {
  if (depositCkb <= 0) return 0;
  if (vault.totalSharesIssued === 0) {
    // First deposit: 1:1 ratio
    return depositCkb;
  }
  const totalValue = getAvailableValue(vault);
  if (totalValue === 0) return 0;
  return Math.floor(
    (depositCkb * vault.totalSharesIssued) / totalValue
  );
}

/**
 * Calculate CKB value for burning shares.
 */
function calculateBurnShares(vault, shares) {
  if (shares <= 0 || shares > vault.totalSharesIssued) return 0;
  const totalValue = getAvailableValue(vault);
  if (totalValue === 0) return 0;
  return Math.floor(
    (shares * totalValue) / vault.totalSharesIssued
  );
}

/**
 * Total CKB value across all three pots.
 */
function getAvailableValue(vault) {
  return (
    (vault.stageFundBalance || 0) +
    (vault.accumulatorBalance || 0) +
    (vault.feeRouterBalance || 0)
  );
}

/**
 * Get fee breakdown for display.
 */
function getFeeBreakdown(vault) {
  return {
    stageFund: vault.stageFundBalance || 0,
    accumulator: vault.accumulatorBalance || 0,
    feeRouter: vault.feeRouterBalance || 0,
    pendingDistribution: vault.pendingDistributionCkb || 0,
    totalDistributed: vault.feeRouterDistributed || 0,
  };
}

/**
 * Check if the vault is initialized (has registered contracts).
 */
function isInitialized(vault) {
  const factoryTypeId = vault.factoryTypeId || "0x" + "00".repeat(20);
  const launchpadTypeId = vault.launchpadTypeId || "0x" + "00".repeat(20);
  return (
    factoryTypeId !== "0x" + "00".repeat(20) &&
    launchpadTypeId !== "0x" + "00".repeat(20)
  );
}

/**
 * Get registered contract Type IDs.
 */
function getRegisteredContracts(vault) {
  return {
    factory: vault.factoryTypeId || "0x" + "00".repeat(20),
    launchpad: vault.launchpadTypeId || "0x" + "00".repeat(20),
    registry: vault.registryTypeId || "0x" + "00".repeat(20),
  };
}

/**
 * Format CKB amount for display.
 */
function formatCkb(ckb) {
  return (BigInt(ckb) / 100_000_000n).toString();
}

/**
 * Format CKB with decimal places.
 */
function formatCkbDecimal(ckb, decimals = 2) {
  const value = Number(BigInt(ckb)) / 100_000_000;
  return value.toFixed(decimals);
}

module.exports = {
  // Constants
  VAULT_DATA_SIZE,
  VAULT_SOURCE_DEPOSIT,
  VAULT_SOURCE_LAUNCH,
  VAULT_SOURCE_FEE,
  VAULT_OP_INITIALIZE,
  VAULT_OP_DEPOSIT,
  VAULT_OP_WITHDRAW,
  VAULT_OP_DISTRIBUTE,
  VAULT_OP_COLLECT,
  VAULT_OP_SEED_POOL,
  VAULT_OP_UPDATE,
  DEFAULT_VAULT_CONFIG,
  TYPE_ID_SIZE,

  // Encoding/Decoding
  encodeVaultData,
  decodeVaultData,

  // Config
  createVaultConfig,

  // Calculations
  calculateSharePrice,
  calculateMintShares,
  calculateBurnShares,
  getAvailableValue,
  getFeeBreakdown,

  // Status checks
  isInitialized,
  getRegisteredContracts,

  // Formatting
  formatCkb,
  formatCkbDecimal,
};
