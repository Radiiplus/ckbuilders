import { ccc } from "@ckb-ccc/core";

export const FACTORY_DATA_SIZE = 256;
export const DEX_INSTANCE_SIZE = 192;
export const POOL_DATA_SIZE = 152;
export const DEFAULT_FACTORY_FEE_BPS = 500;
export const MIN_DEX_FEE_BPS = 10;
export const MAX_DEX_FEE_BPS = 500;
export const CREATOR_FEE_BPS = 300;
export const DEFAULT_CREATION_FEE_CKB = 5000n;

export interface FactoryData {
  ownerLockHash: string;
  factoryFeeBps: number;
  dexCount: bigint;
  totalFeesCollected: bigint;
  minimumDexFeeBps: number;
  maximumDexFeeBps: number;
  creationFeeCkb: bigint;
  totalCreationFees: bigint;
  bump: bigint;
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
  totalFeesToFactory: bigint;
  createdAt: bigint;
  bump: bigint;
}

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

export interface CreateDexParams {
  dexName: string;
  dexFeeBps: number;
  ownerAddress: string;
  tokenA: string;
  tokenB: string;
  initialLiquidityA: bigint;
  initialLiquidityB: bigint;
}

export interface FeeBreakdown {
  dexFeeBps: number;
  factoryFeeBps: number;
  creatorFeeBps: number;
  lpFeeBps: number;
  factoryFeePercent: number;
  creatorFeePercent: number;
}

export interface DexInstance extends DexInstanceData {
  dexName?: string;
  metadata?: DexMetadata;
}

export interface DexMetadata {
  name: string;
  description: string;
  website?: string;
  logoUrl?: string;
  twitter?: string;
  discord?: string;
}

export interface FactoryConfig {
  factoryFeeBps: number;
  minDexFeeBps: number;
  maxDexFeeBps: number;
  creationFeeCkb: bigint;
}

export interface InitializeFactoryParams {
  ownerLockHash: string;
  factoryFeeBps?: number;
  minDexFeeBps?: number;
  maxDexFeeBps?: number;
  creationFeeCkb?: bigint;
}

export function encodeFactoryData(data: FactoryData): Uint8Array {
  const bytes = new Uint8Array(FACTORY_DATA_SIZE);
  const ownerBytes = ccc.bytesFrom(ccc.hexFrom(data.ownerLockHash));
  bytes.set(ownerBytes.slice(0, 32), 0);
  bytes.set(ccc.numLeToBytes(data.factoryFeeBps, 2), 40);
  bytes.set(ccc.numLeToBytes(data.dexCount, 8), 48);
  bytes.set(ccc.numLeToBytes(data.totalFeesCollected, 8), 56);
  bytes.set(ccc.numLeToBytes(data.minimumDexFeeBps, 2), 64);
  bytes.set(ccc.numLeToBytes(data.maximumDexFeeBps, 2), 72);
  bytes.set(ccc.numLeToBytes(data.creationFeeCkb, 8), 80);
  bytes.set(ccc.numLeToBytes(data.totalCreationFees, 8), 88);
  bytes.set(ccc.numLeToBytes(data.bump, 8), 96);
  return bytes;
}

export function decodeFactoryData(bytes: Uint8Array): FactoryData {
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

export function encodeDexInstanceData(data: DexInstanceData): Uint8Array {
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
  bytes.set(ccc.numLeToBytes(data.poolCount, 8), 128);
  bytes.set(ccc.numLeToBytes(data.totalVolume, 8), 136);
  bytes.set(ccc.numLeToBytes(data.totalFeesToFactory, 8), 144);
  bytes.set(ccc.numLeToBytes(data.createdAt, 8), 152);
  bytes.set(ccc.numLeToBytes(data.bump, 8), 160);
  return bytes;
}

export function decodeDexInstanceData(bytes: Uint8Array): DexInstanceData {
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

export function encodePoolData(data: PoolData): Uint8Array {
  const bytes = new Uint8Array(POOL_DATA_SIZE);
  const poolIdBytes = ccc.bytesFrom(ccc.hexFrom(data.poolId));
  bytes.set(poolIdBytes.slice(0, 32), 0);
  const tokenABytes = ccc.bytesFrom(ccc.hexFrom(data.tokenATypeHash));
  bytes.set(tokenABytes.slice(0, 32), 32);
  const tokenBBytes = ccc.bytesFrom(ccc.hexFrom(data.tokenBTypeHash));
  bytes.set(tokenBBytes.slice(0, 32), 64);
  bytes.set(ccc.numLeToBytes(data.reserveA, 8), 64);
  bytes.set(ccc.numLeToBytes(data.reserveB, 8), 72);
  bytes.set(ccc.numLeToBytes(Number(data.feeBps), 2), 80);
  bytes.set(ccc.numLeToBytes(data.lpSupply, 8), 88);
  bytes.set(ccc.numLeToBytes(data.kLast, 8), 96);
  bytes.set(ccc.numLeToBytes(data.bump, 8), 104);
  bytes.set(ccc.numLeToBytes(data.createdAt, 8), 112);
  return bytes;
}

export function decodePoolData(bytes: Uint8Array): PoolData {
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
    feeBps: BigInt(ccc.numLeFromBytes(bytes.slice(112, 114))),
    lpSupply: ccc.numLeFromBytes(bytes.slice(120, 128)),
    kLast: ccc.numLeFromBytes(bytes.slice(128, 136)),
    bump: ccc.numLeFromBytes(bytes.slice(136, 144)),
    createdAt: ccc.numLeFromBytes(bytes.slice(144, 152)),
  };
}

export function calculateFeeBreakdown(
  dexFeeBps: number,
  factoryFeeBps: number,
  creatorFeeBps: number,
): FeeBreakdown {
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

export function calculateSwapFees(
  volume: bigint,
  dexFeeBps: number,
  factoryFeeBps: number,
): [bigint, bigint] {
  const totalFee = (volume * BigInt(dexFeeBps)) / 10000n;
  const factoryFee = (volume * BigInt(factoryFeeBps)) / 10000n;
  const lpFee = totalFee - factoryFee;
  return [factoryFee, lpFee];
}

export function hashDexName(name: string): string {
  const crypto = require("crypto");
  return (
    "0x" + crypto.createHash("sha256").update(name).digest().toString("hex")
  );
}

export function validateDexName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 32) {
    return false;
  }
  const validPattern = /^[a-zA-Z0-9 _-]+$/;
  return validPattern.test(name);
}

export function generateDexId(
  factoryHash: string,
  ownerHash: string,
  bump: bigint,
): string {
  const factoryBytes = ccc.bytesFrom(ccc.hexFrom(factoryHash));
  const ownerBytes = ccc.bytesFrom(ccc.hexFrom(ownerHash));
  const bumpBytes = ccc.numLeToBytes(bump, 8);
  const id = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    id[i] = factoryBytes[i] ^ ownerBytes[i];
    if (i < 8) {
      id[i] ^= bumpBytes[i];
    }
  }
  return ccc.hexFrom(id);
}

export function calculateInitialLP(reserveA: bigint, reserveB: bigint): bigint {
  const product = reserveA * reserveB;
  const sqrt = BigInt(Math.floor(Number(product) ** 0.5));
  const MINIMUM_LIQUIDITY = 1000n;
  return sqrt > MINIMUM_LIQUIDITY ? sqrt - MINIMUM_LIQUIDITY : 0n;
}

export class DexFactoryClient {
  private client: ccc.Client;
  private factoryScriptHash?: string;
  private factoryCell?: { txHash: string; index: number };

  constructor(rpcUrl: string) {
    this.client = new ccc.Client({ url: rpcUrl });
  }

  async connect(): Promise<void> {
    await this.client.getFeeRate();
  }

  setFactoryScriptHash(scriptHash: string): void {
    this.factoryScriptHash = scriptHash;
  }

  setFactoryCell(txHash: string, index: number): void {
    this.factoryCell = { txHash, index };
  }

  async findFactoryCell(): Promise<{
    cell: ccc.Cell;
    data: FactoryData;
  } | null> {
    if (!this.factoryScriptHash) {
      throw new Error("Factory script hash not set");
    }
    const script = new ccc.Script(
      this.factoryScriptHash,
      "0x",
      ccc.hashTypeFrom("type"),
    );
    const cells = await this.client.findCells(
      {
        script,
        scriptType: "type",
        scriptSearchMode: "prefix",
      },
      "asc",
      "desc",
      10,
    );
    if (!cells || cells.length === 0) {
      return null;
    }
    const factoryCell = cells[0];
    const args = factoryCell.cellOutput.type?.args || new Uint8Array(256);
    const data = decodeFactoryData(args);
    return { cell: factoryCell, data };
  }

  async getFactoryData(): Promise<FactoryData> {
    const result = await this.findFactoryCell();
    if (!result) {
      throw new Error("Factory cell not found");
    }
    return result.data;
  }

  async getConfig(): Promise<FactoryConfig> {
    const factory = await this.getFactoryData();
    return {
      factoryFeeBps: factory.factoryFeeBps,
      minDexFeeBps: factory.minimumDexFeeBps,
      maxDexFeeBps: factory.maximumDexFeeBps,
      creationFeeCkb: factory.creationFeeCkb,
    };
  }

  async validateDexFee(feeBps: number): Promise<boolean> {
    const config = await this.getConfig();
    return feeBps >= config.minDexFeeBps && feeBps <= config.maxDexFeeBps;
  }

  async calculateFeeBreakdown(dexFeeBps: number): Promise<FeeBreakdown> {
    const config = await this.getConfig();
    return calculateFeeBreakdown(
      dexFeeBps,
      config.factoryFeeBps,
      CREATOR_FEE_BPS,
    );
  }

  async initializeFactory(
    params: InitializeFactoryParams,
    ownerPrivateKey: string,
  ): Promise<{
    txHash: string;
    factoryAddress: string;
  }> {
    const ownerLockHash = params.ownerLockHash;
    if (!ownerLockHash) {
      throw new Error("Owner lock hash is required");
    }
    const factoryData: FactoryData = {
      ownerLockHash,
      factoryFeeBps: params.factoryFeeBps || DEFAULT_FACTORY_FEE_BPS,
      dexCount: 0n,
      totalFeesCollected: 0n,
      minimumDexFeeBps: params.minDexFeeBps || MIN_DEX_FEE_BPS,
      maximumDexFeeBps: params.maxDexFeeBps || MAX_DEX_FEE_BPS,
      creationFeeCkb: params.creationFeeCkb || DEFAULT_CREATION_FEE_CKB,
      totalCreationFees: 0n,
      bump: 1n,
    };
    const dataBytes = encodeFactoryData(factoryData);
    const dataHex = ccc.hexFrom(dataBytes);
    if (!this.factoryScriptHash) {
      throw new Error("Factory script hash not set");
    }
    const factoryScript = new ccc.Script(
      this.factoryScriptHash,
      dataHex,
      ccc.hashTypeFrom("type"),
    );
    const capacity = 350n * 10n ** 8n;
    const tx = await this.client.buildTransaction({
      outputs: [
        {
          lock: await this._getOwnerLock(ownerPrivateKey),
          type: factoryScript,
          capacity,
        },
      ],
      outputsData: [dataHex],
    });
    const signer = new ccc.SignerCkbPrivateKey(this.client, ownerPrivateKey);
    const signedTx = await signer.signOnlyTransaction(tx);
    const txHash = await this.client.sendTransaction(signedTx);
    const factoryAddress = this._encodeAddress(factoryScript);
    this.factoryCell = { txHash, index: 0 };
    return { txHash, factoryAddress };
  }

  async createDex(
    params: CreateDexParams,
    ownerPrivateKey: string,
  ): Promise<{
    txHash: string;
    dexId: string;
    dexAddress: string;
    poolAddress: string;
  }> {
    if (!validateDexName(params.dexName)) {
      throw new Error("Invalid DEX name");
    }
    if (!(await this.validateDexFee(params.dexFeeBps))) {
      const config = await this.getConfig();
      throw new Error(
        `DEX fee must be between ${config.minDexFeeBps} and ${config.maxDexFeeBps} bps`,
      );
    }
    const config = await this.getConfig();
    const feeBreakdown = calculateFeeBreakdown(
      params.dexFeeBps,
      config.factoryFeeBps,
      CREATOR_FEE_BPS,
    );
    const factoryResult = await this.findFactoryCell();
    if (!factoryResult) {
      throw new Error("Factory cell not found - must initialize first");
    }
    const factoryHash = factoryResult.cell.cellOutput.type?.codeHash || "";
    const bump = BigInt(Date.now());
    const dexId = generateDexId(factoryHash, params.ownerAddress, bump);
    const dexData: DexInstanceData = {
      dexId,
      dexNameHash: hashDexName(params.dexName),
      ownerLockHash: params.ownerAddress,
      dexFeeBps: feeBreakdown.dexFeeBps,
      factoryFeeBps: feeBreakdown.factoryFeeBps,
      creatorFeeBps: feeBreakdown.creatorFeeBps,
      lpFeeBps: feeBreakdown.lpFeeBps,
      poolCount: 0n,
      totalVolume: 0n,
      totalFeesToFactory: 0n,
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
      bump,
    };
    const lpSupply = calculateInitialLP(
      params.initialLiquidityA,
      params.initialLiquidityB,
    );
    const poolData: PoolData = {
      poolId: dexId,
      tokenATypeHash: params.tokenA,
      tokenBTypeHash: params.tokenB,
      reserveA: params.initialLiquidityA,
      reserveB: params.initialLiquidityB,
      feeBps: BigInt(feeBreakdown.dexFeeBps),
      lpSupply,
      kLast: 0n,
      bump,
      createdAt: dexData.createdAt,
    };
    const ownerLock = await this._getOwnerLock(ownerPrivateKey);
    const creationFeeCapacity = config.creationFeeCkb * 10n ** 8n;
    const poolCapacity = 200n * 10n ** 8n;
    const dexCapacity = 250n * 10n ** 8n;
    const lpCapacity = 100n * 10n ** 8n;
    const outputs = [
      {
        lock: ownerLock,
        type: new ccc.Script(
          this.factoryScriptHash!,
          dexId,
          ccc.hashTypeFrom("type"),
        ),
        capacity: dexCapacity,
      },
      {
        lock: ownerLock,
        type: new ccc.Script(
          this._getPoolScriptHash(),
          dexId,
          ccc.hashTypeFrom("type"),
        ),
        capacity: poolCapacity,
      },
      {
        lock: await this._getOwnerLockByHash(factoryResult.data.ownerLockHash),
        capacity: creationFeeCapacity,
      },
      {
        lock: ownerLock,
        type: new ccc.Script(
          this._getLpTokenScriptHash(),
          dexId,
          ccc.hashTypeFrom("type"),
        ),
        capacity: lpCapacity,
      },
    ];
    const outputsData = [
      ccc.hexFrom(encodeDexInstanceData(dexData)),
      ccc.hexFrom(encodePoolData(poolData)),
      "0x",
      ccc.hexFrom(ccc.numLeToBytes(lpSupply, 16)),
    ];
    const tx = await this.client.buildTransaction({
      outputs,
      outputsData,
    });
    const signer = new ccc.SignerCkbPrivateKey(this.client, ownerPrivateKey);
    const signedTx = await signer.signOnlyTransaction(tx);
    const txHash = await this.client.sendTransaction(signedTx);
    const dexAddress = this._encodeAddress(outputs[0].type);
    const poolAddress = this._encodeAddress(outputs[1].type);
    return { txHash, dexId, dexAddress, poolAddress };
  }

  private async _getOwnerLock(privateKey: string): Promise<ccc.Script> {
    const signer = new ccc.SignerCkbPrivateKey(this.client, privateKey);
    const pubKeyBytes = ccc.bytesFrom(signer.publicKey);
    const pubKeyHash = ccc.hashCkb(pubKeyBytes).slice(0, 20);
    return new ccc.Script(
      "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
      pubKeyHash,
      ccc.hashTypeFrom("type"),
    );
  }

  private async _getOwnerLockByHash(lockHash: string): Promise<ccc.Script> {
    return new ccc.Script(
      "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
      lockHash,
      ccc.hashTypeFrom("type"),
    );
  }

  private _getPoolScriptHash(): string {
    try {
      const deployment = require("../deployments/devnet-deployments.json");
      return (
        deployment.contracts["pool"]?.typeScript?.codeHash ||
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    } catch {
      return "0x0000000000000000000000000000000000000000000000000000000000000000";
    }
  }

  private _getLpTokenScriptHash(): string {
    try {
      const deployment = require("../deployments/devnet-deployments.json");
      return (
        deployment.contracts["pool"]?.typeScript?.codeHash ||
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    } catch {
      return "0x0000000000000000000000000000000000000000000000000000000000000000";
    }
  }

  private _encodeAddress(script: ccc.Script): string {
    const BECH32M_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    const BECH32M_CONST = 0x2bc830a3;
    const prefix = "ckt";
    const codeHashBytes = ccc.bytesFrom(ccc.hexFrom(script.codeHash));
    const hashTypeByte =
      script.hashType === "type"
        ? new Uint8Array([0x01])
        : new Uint8Array([0x00]);
    const argsBytes = ccc.bytesFrom(ccc.hexFrom(script.args));
    const payload = new Uint8Array(codeHashBytes.length + 1 + argsBytes.length);
    payload.set(codeHashBytes, 0);
    payload.set(hashTypeByte, 32);
    payload.set(argsBytes, 33);
    const convertBits = (
      data: Uint8Array,
      fromBits: number,
      toBits: number,
      pad = true,
    ): number[] => {
      const ret: number[] = [];
      let acc = 0;
      let bits = 0;
      const maxv = (1 << toBits) - 1;
      for (let i = 0; i < data.length; i++) {
        const value = data[i];
        acc = (acc << fromBits) | value;
        bits += fromBits;
        while (bits >= toBits) {
          bits -= toBits;
          ret.push((acc >> bits) & maxv);
        }
      }
      if (pad && bits > 0) {
        ret.push((acc << (toBits - bits)) & maxv);
      }
      return ret;
    };
    const payload5bit = convertBits(payload, 8, 5, true);
    const polymod = (values: number[]): number => {
      let chk = 1;
      const prefixValues: number[] = [];
      for (let i = 0; i < prefix.length; i++) {
        prefixValues.push(prefix.charCodeAt(i) & 0x1f);
      }
      prefixValues.push(0);
      for (const v of prefixValues) {
        const b = (chk >> 25) & 0x1f;
        chk = ((chk & 0x1ffffff) << 5) ^ v;
        if (b & 1) chk ^= 0x3b6a57b2;
        if (b & 2) chk ^= 0x26508e6d;
        if (b & 4) chk ^= 0x1ea119fa;
        if (b & 8) chk ^= 0x3d4233dd;
        if (b & 16) chk ^= 0x2a1462b3;
      }
      for (const v of values) {
        const b = (chk >> 25) & 0x1f;
        chk = ((chk & 0x1ffffff) << 5) ^ v;
        if (b & 1) chk ^= 0x3b6a57b2;
        if (b & 2) chk ^= 0x26508e6d;
        if (b & 4) chk ^= 0x1ea119fa;
        if (b & 8) chk ^= 0x3d4233dd;
        if (b & 16) chk ^= 0x2a1462b3;
      }
      return chk;
    };
    const checksumInput = [...payload5bit];
    let polymodInput = [...checksumInput];
    for (let i = 0; i < 6; i++) polymodInput.push(0);
    const checksum = polymod(polymodInput) ^ BECH32M_CONST;
    const checksum5bit: number[] = [];
    for (let i = 0; i < 6; i++) {
      checksum5bit.push((checksum >> (5 * (5 - i))) & 0x1f);
    }
    let result = prefix + "1";
    for (const v of payload5bit) result += BECH32M_CHARSET[v];
    for (const v of checksum5bit) result += BECH32M_CHARSET[v];
    return result;
  }
}
