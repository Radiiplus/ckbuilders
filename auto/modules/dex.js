require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const fs = require("fs");
const path = require("path");
const { ccc } = require("../../offckb/node_modules/@ckb-ccc/core");
const { blake2b } = require("@noble/hashes/blake2.js");
const {
  SimpleTxBuilder,
  FeeEstimator,
  encodeDexData,
  generateDexId,
  hashDexName,
} = require("../../sdk");
const {
  colors,
  log,
  rpcRequest,
  getContractInfo,
  getSecpTxOptions,
} = require("../utils/cli-helpers");

async function checkDexExists(dexId) {
  const dexTxFile = path.join(
    __dirname,
    "..",
    "..",
    "deployments",
    `dex-${dexId.slice(0, 10)}.json`,
  );
  return fs.existsSync(dexTxFile);
}

async function main() {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  ATHEON - Create DEX Instance                              ║",
    colors.bright,
  );
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    colors.bright,
  );

  try {
    const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
    const PRIVATE_KEY = process.env.CKB_GENESIS_PRIVKEY_0;
    const DEX_NAME = process.env.DEX_NAME || "MyDEX";

    log("\n[Step 1/5] Connecting to RPC...", colors.blue);
    const tipBlock = await rpcRequest("get_tip_block_number");
    log(`  ✓ Connected (tip block: ${parseInt(tipBlock, 16)})`, colors.green);

    log("\n[Step 2/5] Getting factory script hash...", colors.blue);
    const factoryInfo = getContractInfo("factory", "devnet");
    const factoryScriptHash = factoryInfo.typeScript.codeHash;
    log(
      `  ✓ Factory script: ${factoryScriptHash.slice(0, 18)}...`,
      colors.green,
    );

    log("\n[Step 3/5] Checking DEX script...", colors.blue);
    try {
      const dexInfo = getContractInfo("dex", "devnet");
      const dexScriptHash = dexInfo.typeScript.codeHash;
      log(`  ✓ DEX script: ${dexScriptHash.slice(0, 18)}...`, colors.green);
    } catch (e) {
      log("  ✗ DEX contract not deployed yet!", colors.red);
      log("  Run: node build/setup.js to deploy contracts", colors.cyan);
      return;
    }

    if (!PRIVATE_KEY) {
      log("  ✗ Private key not found", colors.red);
      return;
    }

    log("\n[Step 4/5] Creating DEX instance...", colors.blue);
    log(`  DEX Name: ${DEX_NAME}`, colors.cyan);

    const signer = new ccc.SignerCkbPrivateKey({ rpc: {} }, PRIVATE_KEY);
    const pubKey = signer.publicKey;
    const pubKeyHash = ccc.hexFrom(
      ccc.hashCkb(ccc.bytesFrom(pubKey)).slice(0, 42),
    );

    const bump = BigInt(Date.now());
    const dexId = generateDexId(factoryScriptHash, pubKeyHash, bump);
    const dexNameHash = hashDexName(DEX_NAME);

    
    const descriptionHash = ccc.hexFrom(
      blake2b(Buffer.from(DEX_NAME, "utf-8"), { dkLen: 32 }),
    );

    log(`  ✓ DEX ID: ${dexId.slice(0, 30)}...`, colors.cyan);
    log(`  ✓ Owner: ${pubKeyHash}`, colors.cyan);
    log(
      `  ✓ Description hash: ${descriptionHash.slice(0, 18)}...`,
      colors.cyan,
    );

    const dexData = {
      dexId,
      ownerLockHash: pubKeyHash,
      dexNameHash,
      descriptionHash,
      factoryScriptHash,
      registryEntryHash: "0x" + "00".repeat(32), 
      poolCount: 0n,
      totalVolume: 0n,
      totalTrades: 0n,
      totalFeesCollected: 0n,
      dexFeeBps: 30,
      status: 0,
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
      lastActivityAt: 0n,
      bump,
    };

    const dataHex = ccc.hexFrom(encodeDexData(dexData));

    const txBuilder = new SimpleTxBuilder(RPC_URL, getSecpTxOptions("devnet"));
    const lockScript = await txBuilder.getLockScript(PRIVATE_KEY);

    const outputs = [{ lock: lockScript, capacity: 500n * 10n ** 8n }];

    log("\n[Step 5/5] Sending transaction...", colors.blue);
    const { txHash } = await txBuilder.buildAndSendWithRbfRetry(
      outputs,
      [dataHex],
      PRIVATE_KEY,
      3000,
    );

    log("  ✓ DEX created!", colors.green);
    log(`    Transaction: ${txHash}`, colors.cyan);
    log(`    DEX ID: ${dexId}`, colors.cyan);
    log(`    Owner: ${pubKeyHash}`, colors.cyan);

    
    const dexTxFile = path.join(
      __dirname,
      "..",
      "..",
      "deployments",
      `dex-${dexId.slice(0, 10)}.json`,
    );
    fs.writeFileSync(
      dexTxFile,
      JSON.stringify(
        {
          dexId,
          dexName: DEX_NAME,
          ownerLockHash: pubKeyHash,
          txHash,
          factoryScriptHash,
          createdAt: dexData.createdAt.toString(),
          timestamp: Date.now(),
        },
        null,
        2,
      ),
    );

    log("\n  Waiting for confirmation...", colors.blue);
    await txBuilder.waitForTransaction(txHash);

    log("  ✓ DEX initialization complete!", colors.green);
    log(`\n  Next steps:`, colors.bright);
    log(`    1. Register DEX with registry (when ready)`, colors.cyan);
    log(`    2. Create pools for this DEX`, colors.cyan);
    log(`    3. Start trading!`, colors.cyan);

    return { dexId, dexName: DEX_NAME, ownerLockHash: pubKeyHash, txHash };
  } catch (e) {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    process.exit(1);
  }
}

async function runDexCreate() {
  return await main();
}


if (require.main === module) {
  main();
}

module.exports = {
  checkDexExists,
  main: runDexCreate,
};
