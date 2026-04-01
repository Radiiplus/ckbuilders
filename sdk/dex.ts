import { ccc } from "@ckb-ccc/core";

export interface PoolData {
  poolId: string;
  tokenATypeHash: string;
  tokenBTypeHash: string;
  reserveA: bigint;
  reserveB: bigint;
  feeBps: bigint;
  lpSupply: bigint;
  kLast: bigint;
  bump: bigint;
  createdAt: bigint;
}

export interface PoolState {
  reserveA: bigint;
  reserveB: bigint;
  feeBps: number;
  lpSupply: bigint;
  totalValueLockedA: bigint;
  totalValueLockedB: bigint;
}

export interface SwapResult {
  amountIn: bigint;
  amountOut: bigint;
  fee: bigint;
  priceImpact: number;
  effectivePrice: number;
}

export interface LiquidityResult {
  lpTokens: bigint;
  shareOfPool: number;
  valueA: bigint;
  valueB: bigint;
}

export interface CreatePoolParams {
  dexName: string;
  dexOwnerAddress: string;
  tokenA: string;
  tokenB: string;
  initialLiquidityA: bigint;
  initialLiquidityB: bigint;
  dexFeeBps: number;
  factoryFeeBps: number;
  creatorFeeBps: number;
  enableAutoLaunch?: boolean;
}

export interface CreatePoolResult {
  txHash: string;
  dexId: string;
  dexAddress: string;
  poolAddress: string;
  lpTokenAddress: string;
}

export interface DexInstanceData {
  dexId: string;
  dexNameHash: string;
  ownerLockHash: string;
  dexFeeBps: number;
  factoryFeeBps: number;
  creatorFeeBps: number;
  lpFeeBps: number;
  poolCount: bigint;
  totalVolume: bigint;
  totalFeesPaid: bigint;
  status: number;
  poolScriptHash: string;
  factoryScriptHash: string;
  lastTradeAt: bigint;
  tradeCount: bigint;
  lastTradeVolume: bigint;
}

export const MINIMUM_LIQUIDITY = 1_000n;
export const MAX_FEE_BPS = 1000n;
export const DEFAULT_FEE_BPS = 30n;
export const POOL_DATA_SIZE = 152;
const DEX_INSTANCE_SIZE = 320;

export function encodePoolData(data: PoolData): Uint8Array {
  const bytes = new Uint8Array(POOL_DATA_SIZE);
  bytes.set(ccc.utils.parseHexLike(data.poolId), 0);
  bytes.set(ccc.utils.parseHexLike(data.tokenATypeHash), 32);
  bytes.set(ccc.utils.parseHexLike(data.tokenBTypeHash), 64);
  bytes.set(ccc.num.toUint64LE(data.reserveA), 96);
  bytes.set(ccc.num.toUint64LE(data.reserveB), 104);
  bytes.set(ccc.num.toUint64LE(data.feeBps), 112);
  bytes.set(ccc.num.toUint64LE(data.lpSupply), 120);
  bytes.set(ccc.num.toUint64LE(data.kLast), 128);
  bytes.set(ccc.num.toUint64LE(data.bump), 136);
  bytes.set(ccc.num.toUint64LE(data.createdAt), 144);
  return bytes;
}

export function decodePoolData(bytes: Uint8Array): PoolData {
  if (bytes.length !== POOL_DATA_SIZE) {
    throw new Error(`Invalid pool data length: expected ${POOL_DATA_SIZE}, got ${bytes.length}`);
  }
  return {
    poolId: ccc.utils.hexify(bytes.slice(0, 32)),
    tokenATypeHash: ccc.utils.hexify(bytes.slice(32, 64)),
    tokenBTypeHash: ccc.utils.hexify(bytes.slice(64, 96)),
    reserveA: ccc.num.fromUint64LE(bytes.slice(96, 104)),
    reserveB: ccc.num.fromUint64LE(bytes.slice(104, 112)),
    feeBps: ccc.num.fromUint64LE(bytes.slice(112, 120)),
    lpSupply: ccc.num.fromUint64LE(bytes.slice(120, 128)),
    kLast: ccc.num.fromUint64LE(bytes.slice(128, 136)),
    bump: ccc.num.fromUint64LE(bytes.slice(136, 144)),
    createdAt: ccc.num.fromUint64LE(bytes.slice(144, 152)),
  };
}

export function calculateSwapOutput(
  reserveIn: bigint,
  reserveOut: bigint,
  amountIn: bigint,
  feeBps: bigint = DEFAULT_FEE_BPS
): SwapResult {
  if (amountIn === 0n) {
    throw new Error("Invalid amount: amountIn must be > 0");
  }
  if (reserveIn === 0n || reserveOut === 0n) {
    throw new Error("Invalid reserves: reserves must be > 0");
  }
  const amountInWithFee = amountIn * (10000n - feeBps);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;
  if (denominator === 0n) {
    throw new Error("Calculation error: division by zero");
  }
  const amountOut = numerator / denominator;
  const fee = (amountOut * feeBps) / 10000n;
  if (amountOut === 0n) {
    throw new Error("Insufficient output amount");
  }
  const spotPrice = Number(reserveOut) / Number(reserveIn);
  const effectivePrice = Number(amountOut) / Number(amountIn);
  const priceImpact = ((spotPrice - effectivePrice) / spotPrice) * 100;
  return {
    amountIn,
    amountOut,
    fee,
    priceImpact,
    effectivePrice,
  };
}

export function calculateLiquidityMint(
  reserveA: bigint,
  reserveB: bigint,
  lpSupply: bigint,
  amountA: bigint,
  amountB: bigint
): LiquidityResult {
  let lpTokens: bigint;
  if (lpSupply === 0n) {
    const product = BigInt(Math.floor(Math.sqrt(Number(amountA) * Number(amountB))));
    lpTokens = product - MINIMUM_LIQUIDITY;
    if (lpTokens <= 0n) {
      throw new Error("Insufficient liquidity minted");
    }
  } else {
    const lpA = (amountA * lpSupply) / reserveA;
    const lpB = (amountB * lpSupply) / reserveB;
    lpTokens = lpA < lpB ? lpA : lpB;
  }
  const shareOfPool = lpSupply > 0n
    ? (Number(lpTokens) / (Number(lpSupply) + Number(lpTokens))) * 100
    : 100;
  return {
    lpTokens,
    shareOfPool,
    valueA: amountA,
    valueB: amountB,
  };
}

export function calculateLiquidityRemove(
  reserveA: bigint,
  reserveB: bigint,
  lpSupply: bigint,
  lpAmount: bigint
): { amountA: bigint; amountB: bigint } {
  if (lpAmount > lpSupply) {
    throw new Error("Insufficient LP tokens");
  }
  const amountA = (lpAmount * reserveA) / lpSupply;
  const amountB = (lpAmount * reserveB) / lpSupply;
  return { amountA, amountB };
}

export function calculateK(reserveA: bigint, reserveB: bigint): bigint {
  return reserveA * reserveB;
}

export function validateKInvariant(
  reserveA: bigint,
  reserveB: bigint,
  newReserveA: bigint,
  newReserveB: bigint
): boolean {
  const kBefore = calculateK(reserveA, reserveB);
  const kAfter = calculateK(newReserveA, newReserveB);
  return kAfter >= kBefore;
}

export function calculateInitialLP(amountA: bigint, amountB: bigint): bigint {
  const product = amountA * amountB;
  const sqrt = bigintSqrt(product);
  const lpSupply = sqrt - MINIMUM_LIQUIDITY;
  if (lpSupply <= 0n) {
    throw new Error("Insufficient initial liquidity");
  }
  return lpSupply;
}

function bigintSqrt(n: bigint): bigint {
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

export function hashDexName(name: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(name);
  const hash = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    hash[i % 32] ^= bytes[i];
  }
  hash[31] ^= bytes.length;
  return ccc.utils.hexify(hash);
}

export function generateDexId(
  factoryHash: string,
  ownerHash: string,
  bump: bigint
): string {
  const factoryBytes = ccc.utils.parseHexLike(factoryHash);
  const ownerBytes = ccc.utils.parseHexLike(ownerHash);
  const bumpBytes = ccc.num.toUint64LE(bump);
  const id = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    id[i] = factoryBytes[i] ^ ownerBytes[i];
    if (i < 8) {
      id[i] ^= bumpBytes[i];
    }
  }
  return ccc.utils.hexify(id);
}

function encodeDexInstanceData(data: DexInstanceData): Uint8Array {
  const bytes = new Uint8Array(DEX_INSTANCE_SIZE);
  return bytes;
}

export function checkActivityRequirements(
  tradeCount: bigint,
  totalVolume: bigint,
  lastTradeAt: bigint,
  currentTime: bigint
): {
  isActive: boolean;
  reason?: string;
} {
  const ACTIVITY_PERIOD = 2_592_000n;
  const MIN_VOLUME = 10_000n * 10n**8n;
  const MIN_TRADES = 5n;
  const timeSinceLastTrade = currentTime - lastTradeAt;
  if (timeSinceLastTrade > ACTIVITY_PERIOD) {
    return {
      isActive: false,
      reason: "No trades in 30 days",
    };
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

export class DexPoolClient {
  private client: ccc.Client;

  constructor(rpcUrl: string) {
    this.client = new ccc.Client({ url: rpcUrl });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async getPoolData(cell: ccc.Cell): Promise<PoolData> {
    const data = cell.cellOutput.type?.args;
    if (!data) {
      throw new Error("Pool cell has no type script");
    }
    return decodePoolData(data);
  }

  async getPoolState(poolAddress: string): Promise<PoolState> {
    const cell = await this.client.getLiveCell(poolAddress);
    if (!cell) {
      throw new Error("Pool cell not found");
    }
    const data = await this.getPoolData(cell);
    return {
      reserveA: data.reserveA,
      reserveB: data.reserveB,
      feeBps: Number(data.feeBps),
      lpSupply: data.lpSupply,
      totalValueLockedA: data.reserveA,
      totalValueLockedB: data.reserveB,
    };
  }

  async calculateSwap(
    poolAddress: string,
    amountIn: bigint,
    isAToB: boolean
  ): Promise<SwapResult> {
    const state = await this.getPoolState(poolAddress);
    const { reserveA, reserveB, feeBps } = state;
    const reserveIn = isAToB ? reserveA : reserveB;
    const reserveOut = isAToB ? reserveB : reserveA;
    return calculateSwapOutput(reserveIn, reserveOut, amountIn, BigInt(feeBps));
  }

  async createPool(
    tokenATypeHash: string,
    tokenBTypeHash: string,
    feeBps: bigint = DEFAULT_FEE_BPS
  ): Promise<{ tx: ccc.Transaction; poolId: string }> {
    const bump = BigInt(Date.now());
    const poolId = this.generatePoolId(tokenATypeHash, tokenBTypeHash, bump);
    const poolData: PoolData = {
      poolId,
      tokenATypeHash,
      tokenBTypeHash,
      reserveA: 0n,
      reserveB: 0n,
      feeBps,
      lpSupply: 0n,
      kLast: 0n,
      bump,
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
    };
    throw new Error("Not implemented - requires full transaction building");
  }

  private generatePoolId(
    tokenA: string,
    tokenB: string,
    bump: bigint
  ): string {
    const aBytes = ccc.utils.parseHexLike(tokenA);
    const bBytes = ccc.utils.parseHexLike(tokenB);
    const bumpBytes = ccc.num.toUint64LE(bump);
    const id = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      id[i] = aBytes[i] ^ bBytes[i];
      if (i < 8) {
        id[i] ^= bumpBytes[i];
      }
    }
    return ccc.utils.hexify(id);
  }
}

export async function createPool(
  client: ccc.Client,
  signer: ccc.Signer,
  params: CreatePoolParams
): Promise<CreatePoolResult> {
  await client.connect();
  const bump = BigInt(Date.now());
  const dexId = generateDexId(
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    params.dexOwnerAddress,
    bump
  );
  const lpSupply = calculateInitialLP(
    params.initialLiquidityA,
    params.initialLiquidityB
  );
  const lpFeeBps = params.dexFeeBps - params.factoryFeeBps - params.creatorFeeBps;
  const poolData: PoolData = {
    poolId: dexId,
    tokenATypeHash: params.tokenA,
    tokenBTypeHash: params.tokenB,
    reserveA: params.initialLiquidityA,
    reserveB: params.initialLiquidityB,
    feeBps: BigInt(params.dexFeeBps),
    lpSupply,
    kLast: 0n,
    bump,
    createdAt: BigInt(Math.floor(Date.now() / 1000)),
  };
  const dexData: DexInstanceData = {
    dexId,
    dexNameHash: hashDexName(params.dexName),
    ownerLockHash: params.dexOwnerAddress,
    dexFeeBps: params.dexFeeBps,
    factoryFeeBps: params.factoryFeeBps,
    creatorFeeBps: params.creatorFeeBps,
    lpFeeBps: lpFeeBps,
    poolCount: 1n,
    totalVolume: 0n,
    totalFeesPaid: 0n,
    status: 1,
    poolScriptHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    factoryScriptHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    lastTradeAt: 0n,
    tradeCount: 0n,
    lastTradeVolume: 0n,
  };
  const tx = await ccc.Transaction.create(
    {
      outputs: [
        {
          lock: ccc.Script.from(params.dexOwnerAddress),
          type: ccc.Script.fromTypeHash("0x0000000000000000000000000000000000000000000000000000000000000000"),
          capacity: 250n * 10n**8n,
          data: encodeDexInstanceData(dexData),
        },
        {
          lock: ccc.Script.from(params.dexOwnerAddress),
          type: ccc.Script.fromTypeHash("0x0000000000000000000000000000000000000000000000000000000000000000"),
          capacity: 200n * 10n**8n,
          data: encodePoolData(poolData),
        },
        {
          lock: ccc.Script.from(params.dexOwnerAddress),
          type: ccc.Script.fromTypeHash("0x0000000000000000000000000000000000000000000000000000000000000000"),
          capacity: 100n * 10n**8n,
          data: ccc.num.toUint128LE(lpSupply),
        },
      ],
    },
    client
  );
  tx.addCellDep({
    codeHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    depType: "code",
  });
  tx.addCellDep({
    codeHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    depType: "code",
  });
  tx.addCellDep({
    codeHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    depType: "code",
  });
  const requiredCapacity = 550n * 10n**8n;
  await tx.addRequiredCapacity(
    ccc.Address.from(params.dexOwnerAddress),
    requiredCapacity
  );
  const signedTx = await signer.signTransaction(tx);
  const txHash = await client.sendTransaction(signedTx);
  const dexAddress = ccc.Address.fromScript(
    ccc.Script.fromTypeHash("0x0000000000000000000000000000000000000000000000000000000000000000"),
    dexId
  );
  const poolAddress = ccc.Address.fromScript(
    ccc.Script.fromTypeHash("0x0000000000000000000000000000000000000000000000000000000000000000"),
    poolData.poolId
  );
  const lpTokenAddress = ccc.Address.fromScript(
    ccc.Script.fromTypeHash("0x0000000000000000000000000000000000000000000000000000000000000000"),
    dexId
  );
  return {
    txHash,
    dexId,
    dexAddress,
    poolAddress,
    lpTokenAddress,
  };
}
