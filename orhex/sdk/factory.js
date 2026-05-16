const { ccc } = require("@ckb-ccc/core");
const {
  hashDexName,
  generateDexId,
  validateBytes32,
} = require("./modules/crypto");
const { encodePoolData, decodePoolData } = require("./pool");

const FACTORY_DATA_SIZE = 256;
const DEX_INSTANCE_SIZE = 192;
const DEX_DATA_SIZE = 256;

const DEX_STATUS_ACTIVE = 0;
const DEX_STATUS_SUSPENDED = 1;
const DEX_STATUS_DELISTED = 2;
const DEFAULT_DEX_FEE_BPS = 30;

const DEFAULT_FACTORY_CONFIG = {
  factoryFeeBps: 500,
  minDexFeeBps: 10,
  maxDexFeeBps: 500,
  creatorFeeBps: 300,
  creationFeeCkb: 5000n,
};

function encodeFactoryData(data) {
  const bytes = new Uint8Array(FACTORY_DATA_SIZE);
  const ownerBytes = ccc.bytesFrom(ccc.hexFrom(data.ownerLockHash));
  bytes.set(ownerBytes.slice(0, 32), 0);
  bytes.set(ccc.numLeToBytes(data.factoryFeeBps, 2), 40);
  bytes.set(ccc.numLeToBytes(Number(data.dexCount), 8), 48);
  bytes.set(ccc.numLeToBytes(Number(data.totalFeesCollected), 8), 56);
  bytes.set(ccc.numLeToBytes(data.minimumDexFeeBps, 2), 64);
  bytes.set(ccc.numLeToBytes(data.maximumDexFeeBps, 2), 72);
  bytes.set(ccc.numLeToBytes(Number(data.creationFeeCkb), 8), 80);
  bytes.set(ccc.numLeToBytes(Number(data.totalCreationFees), 8), 88);
  bytes.set(ccc.numLeToBytes(Number(data.bump), 8), 96);
  return bytes;
}

function decodeFactoryData(bytes) {
  if (bytes.length !== FACTORY_DATA_SIZE) {
    throw new Error(
      `Invalid factory data length: expected ${FACTORY_DATA_SIZE}, got ${bytes.length}`,
    );
  }
  return {
    ownerLockHash: ccc.hexFrom(bytes.slice(0, 32)),
    factoryFeeBps: ccc.numLeFromBytes(bytes.slice(40, 42)),
    dexCount: ccc.numLeFromBytes(bytes.slice(48, 56)),
    totalFeesCollected: ccc.numLeFromBytes(bytes.slice(56, 64)),
    minimumDexFeeBps: ccc.numLeFromBytes(bytes.slice(64, 66)),
    maximumDexFeeBps: ccc.numLeFromBytes(bytes.slice(72, 74)),
    creationFeeCkb: ccc.numLeFromBytes(bytes.slice(80, 88)),
    totalCreationFees: ccc.numLeFromBytes(bytes.slice(88, 96)),
    bump: ccc.numLeFromBytes(bytes.slice(96, 104)),
  };
}

function encodeDexInstanceData(data) {
  const bytes = new Uint8Array(DEX_INSTANCE_SIZE);
  const dexIdBytes = ccc.bytesFrom(ccc.hexFrom(data.dexId));
  bytes.set(dexIdBytes.slice(0, 32), 0);
  const nameHashBytes = ccc.bytesFrom(ccc.hexFrom(data.dexNameHash));
  bytes.set(nameHashBytes.slice(0, 32), 32);
  const ownerBytes = ccc.bytesFrom(ccc.hexFrom(data.ownerLockHash));
  bytes.set(ownerBytes.slice(0, 32), 64);
  bytes.set(ccc.numLeToBytes(data.dexFeeBps, 2), 96);
  bytes.set(ccc.numLeToBytes(data.factoryFeeBps, 2), 104);
  bytes.set(ccc.numLeToBytes(data.creatorFeeBps, 2), 112);
  bytes.set(ccc.numLeToBytes(data.lpFeeBps, 2), 120);
  bytes.set(ccc.numLeToBytes(Number(data.poolCount), 8), 128);
  bytes.set(ccc.numLeToBytes(Number(data.totalVolume), 8), 136);
  bytes.set(ccc.numLeToBytes(Number(data.totalFeesToFactory), 8), 144);
  bytes.set(ccc.numLeToBytes(Number(data.createdAt), 8), 152);
  bytes.set(ccc.numLeToBytes(Number(data.bump), 8), 160);
  return bytes;
}

function decodeDexInstanceData(bytes) {
  if (bytes.length !== DEX_INSTANCE_SIZE) {
    throw new Error(
      `Invalid DEX instance data length: expected ${DEX_INSTANCE_SIZE}, got ${bytes.length}`,
    );
  }
  return {
    dexId: ccc.hexFrom(bytes.slice(0, 32)),
    dexNameHash: ccc.hexFrom(bytes.slice(32, 64)),
    ownerLockHash: ccc.hexFrom(bytes.slice(64, 96)),
    dexFeeBps: ccc.numLeFromBytes(bytes.slice(96, 98)),
    factoryFeeBps: ccc.numLeFromBytes(bytes.slice(104, 106)),
    creatorFeeBps: ccc.numLeFromBytes(bytes.slice(112, 114)),
    lpFeeBps: ccc.numLeFromBytes(bytes.slice(120, 122)),
    poolCount: ccc.numLeFromBytes(bytes.slice(128, 136)),
    totalVolume: ccc.numLeFromBytes(bytes.slice(136, 144)),
    totalFeesToFactory: ccc.numLeFromBytes(bytes.slice(144, 152)),
    createdAt: ccc.numLeFromBytes(bytes.slice(152, 160)),
    bump: ccc.numLeFromBytes(bytes.slice(160, 168)),
  };
}

function encodeDexData(data) {
  const bytes = new Uint8Array(DEX_DATA_SIZE);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(data.dexId)), 0);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(data.ownerLockHash)), 32);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(data.dexNameHash)), 64);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(data.descriptionHash)), 96);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(data.factoryScriptHash)), 128);
  bytes.set(ccc.bytesFrom(ccc.hexFrom(data.registryEntryHash)), 160);
  bytes.set(ccc.numLeToBytes(Number(data.poolCount), 8), 192);
  bytes.set(ccc.numLeToBytes(Number(data.totalVolume), 8), 200);
  bytes.set(ccc.numLeToBytes(Number(data.totalTrades), 8), 208);
  bytes.set(ccc.numLeToBytes(Number(data.totalFeesCollected), 8), 216);
  bytes.set(ccc.numLeToBytes(data.dexFeeBps, 2), 224);
  bytes.set([data.status], 226);
  bytes.set(ccc.numLeToBytes(Number(data.createdAt), 8), 227);
  bytes.set(ccc.numLeToBytes(Number(data.lastActivityAt), 8), 235);
  bytes.set(ccc.numLeToBytes(Number(data.bump), 8), 243);
  return bytes;
}

function decodeDexData(bytes) {
  if (bytes.length !== DEX_DATA_SIZE) {
    throw new Error(
      `Invalid DEX data length: expected ${DEX_DATA_SIZE}, got ${bytes.length}`,
    );
  }
  return {
    dexId: ccc.hexFrom(bytes.slice(0, 32)),
    ownerLockHash: ccc.hexFrom(bytes.slice(32, 64)),
    dexNameHash: ccc.hexFrom(bytes.slice(64, 96)),
    descriptionHash: ccc.hexFrom(bytes.slice(96, 128)),
    factoryScriptHash: ccc.hexFrom(bytes.slice(128, 160)),
    registryEntryHash: ccc.hexFrom(bytes.slice(160, 192)),
    poolCount: ccc.numLeFromBytes(bytes.slice(192, 200)),
    totalVolume: ccc.numLeFromBytes(bytes.slice(200, 208)),
    totalTrades: ccc.numLeFromBytes(bytes.slice(208, 216)),
    totalFeesCollected: ccc.numLeFromBytes(bytes.slice(216, 224)),
    dexFeeBps: ccc.numLeFromBytes(bytes.slice(224, 226)),
    status: bytes[226],
    createdAt: ccc.numLeFromBytes(bytes.slice(227, 235)),
    lastActivityAt: ccc.numLeFromBytes(bytes.slice(235, 243)),
    bump: ccc.numLeFromBytes(bytes.slice(243, 251)),
  };
}

function calculateFeeBreakdown(dexFeeBps, factoryFeeBps, creatorFeeBps) {
  const factoryCut = Math.floor((dexFeeBps * factoryFeeBps) / 10000);
  const creatorCut = Math.floor((dexFeeBps * creatorFeeBps) / 10000);
  const lpCut = dexFeeBps - factoryCut - creatorCut;

  return {
    dexFeeBps,
    factoryFeeBps: factoryCut,
    creatorFeeBps: creatorCut,
    lpFeeBps: lpCut,
    factoryFeePercent: dexFeeBps > 0 ? (factoryCut / dexFeeBps) * 100 : 0,
    creatorFeePercent: dexFeeBps > 0 ? (creatorCut / dexFeeBps) * 100 : 0,
  };
}

function calculateSwapFees(volume, dexFeeBps, factoryFeeBps) {
  const totalFee = (volume * BigInt(dexFeeBps)) / 10000n;
  const factoryFee = (volume * BigInt(factoryFeeBps)) / 10000n;
  const lpFee = totalFee - factoryFee;
  return [factoryFee, lpFee];
}

function createFactoryConfig(options = {}) {
  return {
    factoryFeeBps:
      options.factoryFeeBps ?? DEFAULT_FACTORY_CONFIG.factoryFeeBps,
    minDexFeeBps: options.minDexFeeBps ?? DEFAULT_FACTORY_CONFIG.minDexFeeBps,
    maxDexFeeBps: options.maxDexFeeBps ?? DEFAULT_FACTORY_CONFIG.maxDexFeeBps,
    creatorFeeBps:
      options.creatorFeeBps ?? DEFAULT_FACTORY_CONFIG.creatorFeeBps,
    creationFeeCkb:
      options.creationFeeCkb ?? DEFAULT_FACTORY_CONFIG.creationFeeCkb,
  };
}

function validateDexName(name) {
  if (!name || name.length === 0 || name.length > 32) {
    return false;
  }
  const validPattern = /^[a-zA-Z0-9 _-]+$/;
  return validPattern.test(name);
}

function calculateInitialLP(reserveA, reserveB) {
  const product = reserveA * reserveB;
  const sqrt = BigInt(Math.floor(Number(product) ** 0.5));
  const MINIMUM_LIQUIDITY = 1000n;
  return sqrt > MINIMUM_LIQUIDITY ? sqrt - MINIMUM_LIQUIDITY : 0n;
}

function checkActivityRequirements(
  tradeCount,
  totalVolume,
  lastTradeAt,
  currentTime,
  options = {},
) {
  const ACTIVITY_PERIOD = options.activityPeriod ?? 2_592_000n;
  const MIN_VOLUME = options.minVolume ?? 10_000n * 10n ** 8n;
  const MIN_TRADES = options.minTrades ?? 5n;

  const timeSinceLastTrade = currentTime - lastTradeAt;

  if (timeSinceLastTrade > ACTIVITY_PERIOD) {
    return { isActive: false, reason: "No trades in 30 days" };
  }
  if (tradeCount < MIN_TRADES) {
    return {
      isActive: false,
      reason: `Insufficient trades: ${tradeCount} < ${MIN_TRADES}`,
    };
  }
  if (totalVolume < MIN_VOLUME) {
    return {
      isActive: false,
      reason: `Insufficient volume: ${totalVolume} < ${MIN_VOLUME}`,
    };
  }
  return { isActive: true };
}

module.exports = {
  FACTORY_DATA_SIZE,
  DEX_INSTANCE_SIZE,
  DEX_DATA_SIZE,
  DEFAULT_FACTORY_CONFIG,
  DEFAULT_DEX_FEE_BPS,
  DEX_STATUS_ACTIVE,
  DEX_STATUS_SUSPENDED,
  DEX_STATUS_DELISTED,

  createFactoryConfig,

  encodeFactoryData,
  decodeFactoryData,

  encodeDexInstanceData,
  decodeDexInstanceData,

  encodeDexData,
  decodeDexData,

  encodePoolData,
  decodePoolData,

  calculateFeeBreakdown,
  calculateSwapFees,
  calculateInitialLP,

  hashDexName,
  generateDexId,
  validateBytes32,
  validateDexName,
  checkActivityRequirements,
};
