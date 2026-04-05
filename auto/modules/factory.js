require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const fs = require("fs");
const path = require("path");
const { ccc } = require("../../offckb/node_modules/@ckb-ccc/core");
const {
  SimpleTxBuilder,
  FeeEstimator,
  encodeFactoryData,
} = require("../../sdk");
const {
  colors,
  log,
  rpcRequest,
  getFactoryScriptHash,
  getSecpTxOptions,
} = require("../utils/cli-helpers");

const DEFAULT_FACTORY_FEE_BPS = 500;
const MIN_DEX_FEE_BPS = 10;
const MAX_DEX_FEE_BPS = 500;
const DEFAULT_CREATION_FEE_CKB = 5000n;

async function checkFactoryInitialized(factoryScriptHash) {
  const factoryTxFile = path.join(
    __dirname,
    "..",
    "..",
    "deployments",
    "factory-tx.json",
  );
  if (fs.existsSync(factoryTxFile)) {
    return true;
  }

  const result = await rpcRequest("get_cells", [
    {
      script: { code_hash: factoryScriptHash, hash_type: "type", args: "0x" },
      script_type: "type",
      script_search_mode: "prefix",
    },
    "asc",
    "0xa",
  ]);
  return result.objects && result.objects.length > 0;
}

async function main() {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  Ohrex - Initialize Factory Contract                    ║",
    colors.bright,
  );
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    colors.bright,
  );

  try {
    const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
    const PRIVATE_KEY = process.env.CKB_GENESIS_PRIVKEY_0;

    log("\n[Step 1/4] Connecting to RPC...", colors.blue);
    const tipBlock = await rpcRequest("get_tip_block_number");
    log(`  ✓ Connected (tip block: ${parseInt(tipBlock, 16)})`, colors.green);

    log("\n[Step 2/4] Getting factory script hash...", colors.blue);
    const factoryInfo = getFactoryScriptHash("devnet");
    const factoryScriptHash = factoryInfo.scriptHash;
    log(
      `  ✓ Factory script: ${factoryScriptHash.slice(0, 18)}...`,
      colors.green,
    );

    log("\n[Step 3/4] Checking if factory is initialized...", colors.blue);
    const isInitialized = await checkFactoryInitialized(factoryScriptHash);

    if (isInitialized) {
      log("  ✓ Factory is already initialized!", colors.green);
      return;
    }

    if (!PRIVATE_KEY) {
      log("  ✗ Private key not found", colors.red);
      return;
    }

    log("  ✗ Factory not initialized, initializing now...", colors.yellow);

    log("\n[Step 4/4] Initializing factory...", colors.blue);

    const signer = new ccc.SignerCkbPrivateKey({ rpc: {} }, PRIVATE_KEY);
    const pubKey = signer.publicKey;
    const pubKeyHash = ccc.hexFrom(
      ccc.hashCkb(ccc.bytesFrom(pubKey)).slice(0, 42),
    );

    const factoryData = {
      ownerLockHash: pubKeyHash,
      factoryFeeBps: DEFAULT_FACTORY_FEE_BPS,
      dexCount: 0n,
      totalFeesCollected: 0n,
      minimumDexFeeBps: MIN_DEX_FEE_BPS,
      maximumDexFeeBps: MAX_DEX_FEE_BPS,
      creationFeeCkb: DEFAULT_CREATION_FEE_CKB,
      totalCreationFees: 0n,
      bump: 1n,
    };

    const dataHex = ccc.hexFrom(encodeFactoryData(factoryData));
    const txBuilder = new SimpleTxBuilder(RPC_URL, getSecpTxOptions("devnet"));
    const lockScript = await txBuilder.getLockScript(PRIVATE_KEY);

    const outputs = [{ lock: lockScript, capacity: 600n * 10n ** 8n }];

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

    log("  ✓ Factory initialized!", colors.green);
    log(`    Transaction: ${txHash}`, colors.cyan);
    log(`    Owner: ${pubKeyHash}`, colors.cyan);

    const factoryTxFile = path.join(
      __dirname,
      "..",
      "..",
      "deployments",
      "factory-tx.json",
    );
    fs.writeFileSync(
      factoryTxFile,
      JSON.stringify(
        { txHash, ownerLockHash: pubKeyHash, timestamp: Date.now() },
        null,
        2,
      ),
    );

    log("\n  Waiting for confirmation...", colors.blue);
    await txBuilder.waitForTransaction(txHash);

    const isNowInitialized = await checkFactoryInitialized(factoryScriptHash);
    if (isNowInitialized) {
      log("  ✓ Factory initialization confirmed!", colors.green);
    } else {
      log("  ⚠ Factory initialization not yet visible", colors.yellow);
    }

    return { txHash, ownerLockHash: pubKeyHash };
  } catch (e) {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    process.exit(1);
  }
}

async function runFactoryInit() {
  return await main();
}

if (require.main === module) {
  main();
}

module.exports = {
  checkFactoryInitialized,
  main: runFactoryInit,
};
