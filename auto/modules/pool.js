require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const fs = require("fs");
const path = require("path");
const { ccc } = require("../../offckb/node_modules/@ckb-ccc/core");
const { SimpleTxBuilder, FeeEstimator, encodePoolData } = require("../../sdk");
const {
  colors,
  log,
  rpcRequest,
  getContractInfo,
  getSecpTxOptions,
} = require("../utils/cli-helpers");

const DEFAULT_POOL_FEE_BPS = 30n;

function getPoolScriptHash(network = "devnet") {
  const info = getContractInfo("pool", network);
  return info.typeScript.codeHash;
}

async function findFactoryCell() {
  const factoryTxFile = path.join(
    __dirname,
    "..",
    "..",
    "deployments",
    "factory-tx.json",
  );
  if (!fs.existsSync(factoryTxFile)) return null;

  const factoryTx = JSON.parse(fs.readFileSync(factoryTxFile, "utf-8"));
  return {
    txHash: factoryTx.txHash,
    index: 0,
    ownerLockHash: factoryTx.ownerLockHash,
  };
}

async function main() {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  ATHEON - Initialize Pool Contract                       ║",
    colors.bright,
  );
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    colors.bright,
  );

  try {
    const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
    const PRIVATE_KEY = process.env.CKB_GENESIS_PRIVKEY_0;

    log("\n[Step 1/6] Connecting to RPC...", colors.blue);
    const tipBlock = await rpcRequest("get_tip_block_number");
    log(`  ✓ Connected (tip block: ${parseInt(tipBlock, 16)})`, colors.green);

    log("\n[Step 2/6] Getting deployment info...", colors.blue);
    const poolScriptHash = getPoolScriptHash("devnet");
    const factoryInfo = getContractInfo("factory", "devnet");
    const factoryScriptHash = factoryInfo.typeScript.codeHash;
    log(`  ✓ Pool script: ${poolScriptHash.slice(0, 18)}...`, colors.green);
    log(
      `  ✓ Factory script: ${factoryScriptHash.slice(0, 18)}...`,
      colors.green,
    );

    if (!PRIVATE_KEY) {
      log("  ✗ Private key not found", colors.red);
      return;
    }

    log("\n[Step 3/6] Finding factory cell...", colors.blue);
    const factoryCell = await findFactoryCell();
    if (!factoryCell) {
      log("  ✗ Factory cell not found! Initialize factory first.", colors.red);
      return;
    }
    log(
      `  ✓ Factory cell found: ${factoryCell.txHash.slice(0, 18)}...`,
      colors.green,
    );

    log("\n[Step 4/6] Preparing pool data...", colors.blue);
    const signer = new ccc.SignerCkbPrivateKey({ rpc: {} }, PRIVATE_KEY);
    const pubKey = signer.publicKey;
    const pubKeyHash = ccc.hexFrom(
      ccc.hashCkb(ccc.bytesFrom(pubKey)).slice(0, 42),
    );

    const bump = BigInt(Date.now());
    const factoryBytes = ccc.bytesFrom(ccc.hexFrom(factoryScriptHash));
    const ownerBytes = ccc.bytesFrom(ccc.hexFrom(pubKeyHash));
    const bumpBytes = ccc.numLeToBytes(Number(bump), 8);
    const poolIdBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      poolIdBytes[i] = factoryBytes[i] ^ ownerBytes[i];
      if (i < 8) poolIdBytes[i] ^= bumpBytes[i];
    }
    const poolId = ccc.hexFrom(poolIdBytes);

    const poolData = {
      poolId,
      tokenATypeHash: "0x" + "00".repeat(32),
      tokenBTypeHash: "0x" + "00".repeat(32),
      reserveA: 0n,
      reserveB: 0n,
      feeBps: DEFAULT_POOL_FEE_BPS,
      lpSupply: 0n,
      kLast: 0n,
      bump,
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
    };

    const dataHex = ccc.hexFrom(encodePoolData(poolData));
    log(`  ✓ Pool ID: ${poolId}`, colors.cyan);

    log("\n[Step 5/6] Building and sending transaction...", colors.blue);
    const txBuilder = new SimpleTxBuilder(RPC_URL, getSecpTxOptions("devnet"));
    const lockScript = await txBuilder.getLockScript(PRIVATE_KEY);

    
    
    const outputs = [{ lock: lockScript, capacity: 250n * 10n ** 8n }];

    
    const feeEstimator = new FeeEstimator(RPC_URL);
    const mockInputs = [
      { previousOutput: { txHash: "0x" + "00".repeat(64), index: "0x0" } },
    ];
    const feeEstimation = await feeEstimator.estimateFee(
      mockInputs,
      outputs,
      3000,
    );

    if (feeEstimation.rbfInfo.hasPending) {
      log(
        "  ⚠️  Pending transaction detected! Adjusting fee for RBF...",
        colors.yellow,
      );
      feeEstimator.logEstimation(feeEstimation, "  [FeeEstimator]");
    } else {
      log(
        `  ✓ Fee estimated: ${Number(feeEstimation.fee) / 1e8} CKB`,
        colors.green,
      );
    }

    log("\n  Sending transaction with RBF retry logic...", colors.blue);
    const { txHash } = await txBuilder.buildAndSendWithRbfRetry(
      outputs,
      [dataHex],
      PRIVATE_KEY,
      3000, 
    );

    log("  ✓ Pool initialization sent!", colors.green);
    log(`    Transaction: ${txHash}`, colors.cyan);

    log("\n[Step 6/6] Waiting for confirmation...", colors.blue);
    await txBuilder.waitForTransaction(txHash);

    log("  ✓ Pool initialization complete!", colors.green);
    log(`    Pool ID: ${poolId}`, colors.cyan);

    return { txHash, poolId };
  } catch (e) {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    process.exit(1);
  }
}

async function runPoolInit() {
  return await main();
}


if (require.main === module) {
  main();
}

module.exports = { getPoolScriptHash, main: runPoolInit };
