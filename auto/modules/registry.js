require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const fs = require("fs");
const path = require("path");
const { ccc } = require("../../offckb/node_modules/@ckb-ccc/core");
const { SimpleTxBuilder, FeeEstimator } = require("../../sdk");
const {
  colors,
  log,
  rpcRequest,
  getContractInfo,
  getSecpTxOptions,
} = require("../utils/cli-helpers");

const REGISTRY_DATA_SIZE = 256;
const DEFAULT_CREATION_FEE_CKB = 5000n;
const DEFAULT_RE_LISTING_FEE_CKB = 1000n;
const DEFAULT_RESERVATION_FEE_CKB = 500n;
const MANUAL_LAUNCH_FEE_BPS = 100;
const AUTO_LAUNCH_FEE_BPS = 300;

function encodeRegistryData(data) {
  const bytes = new Uint8Array(REGISTRY_DATA_SIZE);
  const ownerBytes = ccc.bytesFrom(ccc.hexFrom(data.ownerLockHash));
  bytes.set(ownerBytes.slice(0, 32), 0);
  bytes.set(ccc.numLeToBytes(Number(data.creationFeeCkb), 8), 32);
  bytes.set(ccc.numLeToBytes(Number(data.reListingFeeCkb), 8), 40);
  bytes.set(ccc.numLeToBytes(Number(data.reservationFeeCkb), 8), 48);
  bytes.set(ccc.numLeToBytes(Number(data.totalRegistrations), 8), 56);
  bytes.set(ccc.numLeToBytes(Number(data.totalFeesCollected), 8), 64);
  bytes.set(ccc.numLeToBytes(data.manualLaunchFeeBps, 2), 72);
  bytes.set(ccc.numLeToBytes(data.autoLaunchFeeBps, 2), 80);
  bytes.set(ccc.numLeToBytes(Number(data.activityCheckPeriod), 8), 88);
  bytes.set(ccc.numLeToBytes(Number(data.minTradeVolumeCkb), 8), 96);
  bytes.set(ccc.numLeToBytes(Number(data.minTradeCount), 8), 104);
  bytes.set(ccc.numLeToBytes(Number(data.bump), 8), 112);
  return bytes;
}

function getRegistryScriptHash(network = "devnet") {
  const info = getContractInfo("registry", network);
  return info.typeScript.codeHash;
}

async function checkRegistryInitialized() {
  const registryTxFile = path.join(
    __dirname,
    "..",
    "..",
    "deployments",
    "registry-tx.json",
  );
  return fs.existsSync(registryTxFile);
}

async function main() {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  Ohrex - Initialize Registry Contract                   ║",
    colors.bright,
  );
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    colors.bright,
  );

  try {
    const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
    const PRIVATE_KEY = process.env.CKB_GENESIS_PRIVKEY_0;

    log("\n[Step 1/5] Connecting to RPC...", colors.blue);
    const tipBlock = await rpcRequest("get_tip_block_number");
    log(`  ✓ Connected (tip block: ${parseInt(tipBlock, 16)})`, colors.green);

    log("\n[Step 2/5] Getting registry script hash...", colors.blue);
    const registryScriptHash = getRegistryScriptHash("devnet");
    log(
      `  ✓ Registry script: ${registryScriptHash.slice(0, 18)}...`,
      colors.green,
    );

    log("\n[Step 3/5] Checking if registry is initialized...", colors.blue);
    const isInitialized = await checkRegistryInitialized();

    if (isInitialized) {
      log("  ✓ Registry is already initialized!", colors.green);
      return;
    }

    if (!PRIVATE_KEY) {
      log("  ✗ Private key not found", colors.red);
      return;
    }

    log("  ✗ Registry not initialized, initializing now...", colors.yellow);

    log("\n[Step 4/5] Preparing registry data...", colors.blue);

    const signer = new ccc.SignerCkbPrivateKey({ rpc: {} }, PRIVATE_KEY);
    const pubKey = signer.publicKey;
    const pubKeyHash = ccc.hexFrom(
      ccc.hashCkb(ccc.bytesFrom(pubKey)).slice(0, 42),
    );

    const registryData = {
      ownerLockHash: pubKeyHash,
      creationFeeCkb: DEFAULT_CREATION_FEE_CKB,
      reListingFeeCkb: DEFAULT_RE_LISTING_FEE_CKB,
      reservationFeeCkb: DEFAULT_RESERVATION_FEE_CKB,
      totalRegistrations: 0n,
      totalFeesCollected: 0n,
      manualLaunchFeeBps: MANUAL_LAUNCH_FEE_BPS,
      autoLaunchFeeBps: AUTO_LAUNCH_FEE_BPS,
      activityCheckPeriod: 2592000n,
      minTradeVolumeCkb: 10000n,
      minTradeCount: 5n,
      bump: BigInt(Date.now()),
    };

    const dataHex = ccc.hexFrom(encodeRegistryData(registryData));
    log(`  ✓ Registry owner: ${pubKeyHash}`, colors.cyan);
    log(`  ✓ Creation fee: ${DEFAULT_CREATION_FEE_CKB} CKB`, colors.cyan);
    log(`  ✓ Reservation fee: ${DEFAULT_RESERVATION_FEE_CKB} CKB`, colors.cyan);

    log("\n[Step 5/5] Building and sending transaction...", colors.blue);
    const txBuilder = new SimpleTxBuilder(RPC_URL, getSecpTxOptions("devnet"));
    const lockScript = await txBuilder.getLockScript(PRIVATE_KEY);

    const outputs = [
      {
        lock: lockScript,
        capacity: 1000n * 10n ** 8n,
      },
    ];

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

    log("  ✓ Registry initialized!", colors.green);
    log(`    Transaction: ${txHash}`, colors.cyan);
    log(`    Owner: ${pubKeyHash}`, colors.cyan);

    const registryTxFile = path.join(
      __dirname,
      "..",
      "..",
      "deployments",
      "registry-tx.json",
    );
    fs.writeFileSync(
      registryTxFile,
      JSON.stringify(
        { txHash, ownerLockHash: pubKeyHash, timestamp: Date.now() },
        null,
        2,
      ),
    );

    log("\n  Waiting for confirmation...", colors.blue);
    await txBuilder.waitForTransaction(txHash);

    log("  ✓ Registry initialization complete!", colors.green);

    return { txHash, ownerLockHash: pubKeyHash };
  } catch (e) {
    throw e;
  }
}

async function runRegistryInit() {
  return await main();
}

if (require.main === module) {
  main();
}

module.exports = {
  getRegistryScriptHash,
  checkRegistryInitialized,
  main: runRegistryInit,
};
