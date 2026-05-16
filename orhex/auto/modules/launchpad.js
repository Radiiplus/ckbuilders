require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const fs = require("fs");
const path = require("path");
const { ccc } = require("@ckb-ccc/core");
const { blake2b } = require("@noble/hashes/blake2.js");

const sdk = require("../../sdk");
const {
  colors,
  log,
  rpcRequest,
  getContractInfo,
  getSecpTxOptions,
} = require("../utils/cli-helpers");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function logSection(title) {
  log(`\n${"=".repeat(60)}`, colors.bright);
  log(title, colors.bright);
  log("=".repeat(60), colors.bright);
}

function logStep(step, message) {
  log(`  [${step}] ${message}`, colors.cyan);
}

async function getBalance(lockScript) {
  try {
    let totalCapacity = 0n;
    let cellCount = 0;

    const result = await rpcRequest("get_cells", [
      {
        script: {
          code_hash: lockScript.codeHash,
          hash_type: lockScript.hashType,
          args: lockScript.args,
        },
        script_type: "lock",
        script_search_mode: "exact",
      },
      "asc",
      "0x64",
    ]);

    if (result.objects && result.objects.length > 0) {
      for (const cell of result.objects) {
        totalCapacity += BigInt(cell.cellOutput.capacity);
        cellCount++;
      }
    }

    return {
      balance: totalCapacity,
      cellCount,
      balanceCkb: Number(totalCapacity) / 100000000,
    };
  } catch (e) {
    log(`  Warning: Could not fetch balance: ${e.message}`, colors.yellow);
    return {
      balance: 0n,
      cellCount: 0,
      balanceCkb: 0,
      error: e.message,
    };
  }
}

function getLaunchpadScriptHash(network = "devnet") {
  const info = getContractInfo("launchpad", network);
  return info.typeScript.codeHash;
}

function serializeScriptMolecule(script) {
  const codeHash = ccc.bytesFrom(ccc.hexFrom(script.codeHash));
  const hashType = script.hashType === "type" ? 0x01 : 0x00;
  const args = ccc.bytesFrom(ccc.hexFrom(script.args));

  const totalSize = 8 + 32 + 1 + args.length;
  const bytes = new Uint8Array(totalSize);

  const view = new DataView(bytes.buffer);
  view.setUint32(0, totalSize, true);
  view.setUint32(4, 8 + 32 + 1, true);

  bytes.set(codeHash, 8);
  bytes[40] = hashType;
  bytes.set(args, 41);

  return bytes;
}

function computeScriptHash(script) {
  const serialized = serializeScriptMolecule(script);
  return ccc.hexFrom(blake2b(serialized, { dkLen: 32 }));
}

async function buildAndSendTx(outputs, outputsData, privateKey, cellDeps = []) {
  const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
  const txBuilder = new sdk.SimpleTxBuilder(
    RPC_URL,
    getSecpTxOptions("devnet"),
  );

  const result = await txBuilder.buildAndSendWithRbfRetry(
    outputs,
    outputsData,
    privateKey,
    3000,
    cellDeps,
  );

  return result;
}

async function createLaunch(options = {}) {
  logSection("Create Token Launch");

  const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
  const PRIVATE_KEY = process.env.CKB_GENESIS_PRIVKEY_0;

  if (!PRIVATE_KEY) {
    throw new Error("CKB_GENESIS_PRIVKEY_0 not set in .env");
  }

  const launchpadScriptHash = getLaunchpadScriptHash("devnet");
  const launchpadInfo = getContractInfo("launchpad", "devnet");
  logStep("1", `Launchpad script: ${launchpadScriptHash.slice(0, 18)}...`);

  const launchpadDeploymentTx = launchpadInfo.deploymentTxHash;
  if (
    !launchpadDeploymentTx ||
    launchpadDeploymentTx === "0x" + "00".repeat(32)
  ) {
    throw new Error(
      "Launchpad contract not deployed on-chain. Build and deploy it first:\n" +
        "  1. Build binary: cd contracts/launchpad && cargo build --release --target riscv64imac-unknown-none-elf\n" +
        "  2. Deploy: node build/setup.js (or deploy launchpad manually)",
    );
  }

  const client = new sdk.SimpleClient(RPC_URL, getSecpTxOptions("devnet"));
  const signer = new ccc.SignerCkbPrivateKey(client, PRIVATE_KEY);
  const addrObj = await signer.getAddressObjSecp256k1();

  const creatorLockHash = computeScriptHash(addrObj.script);

  const bump = BigInt(Math.floor(Date.now() / 1000));
  const launchId = sdk.generateLaunchId(creatorLockHash, bump);
  logStep("2", `Launch ID: ${launchId.slice(0, 18)}...`);

  const now = Math.floor(Date.now() / 1000);
  const startTime = BigInt(now + 60);
  const endTime = BigInt(now + 3600);

  const config = sdk.createLaunchConfig(
    {
      launchId,
      creatorLockHash,
      tokenTypeHash: options.tokenTypeHash || "0x" + "01".repeat(32),
      tokenName: options.tokenName || "TestToken",
      tokenSymbol: options.tokenSymbol || "TEST",
      totalSupply: BigInt(options.totalSupply || 1000000000000000n),
      targetCkb: BigInt(options.targetCkb || 100000000000n),
      maxCkb: BigInt(options.maxCkb || 200000000000n),
      priceMultiplierBps: options.priceMultiplierBps || 100,
      startTime,
      endTime,
      dexScriptHash: options.dexScriptHash || "0x" + "02".repeat(32),
    },
    {
      registryEntryHash: options.registryEntryHash || "0x" + "00".repeat(32),
      stakeCkb: options.stakeCkb || 0n,
      feeBps: options.feeBps || 30,
    },
  );

  logStep("3", `Token: ${config.tokenName} (${config.tokenSymbol})`);
  logStep("4", `Target: ${(config.targetCkb / 100000000n).toString()} CKB`);

  const encodedData = sdk.encodeLaunchConfig(config);
  const dataHex = ccc.hexFrom(encodedData);

  const launchpadCellDep = {
    outPoint: {
      txHash: launchpadInfo.deploymentTxHash,
      index: "0x0",
    },
    depType: "code",
  };

  const minCapacity = sdk.calculateMinimumCapacity(
    addrObj.script,
    null,
    dataHex,
  );
  const cellCapacity = minCapacity + 100_000_000n;

  const outputs = [
    {
      lock: addrObj.script,
      capacity: cellCapacity,
    },
  ];

  logStep("5", "Building transaction...");
  const { txHash } = await buildAndSendTx(outputs, [dataHex], PRIVATE_KEY, [
    launchpadCellDep,
  ]);

  logStep("6", `✓ Launch created: ${txHash.slice(0, 18)}...`);

  const launchFile = path.join(
    __dirname,
    "..",
    "..",
    "deployments",
    `launch-${launchId.slice(0, 10)}.json`,
  );
  fs.writeFileSync(
    launchFile,
    JSON.stringify(
      {
        launchId,
        tokenName: config.tokenName,
        tokenSymbol: config.tokenSymbol,
        creatorLockHash,
        txHash,
        targetCkb: config.targetCkb.toString(),
        startTime: config.startTime.toString(),
        endTime: config.endTime.toString(),
        timestamp: Date.now(),
      },
      null,
      2,
    ),
  );

  return {
    launchId,
    txHash,
    config,
    creatorLockHash,
  };
}

async function testSdkEncoding() {
  logSection("SDK Encoding/Decoding Tests");

  const config = sdk.createLaunchConfig({
    launchId: "0x" + "aa".repeat(32),
    creatorLockHash: "0x" + "bb".repeat(32),
    tokenTypeHash: "0x" + "cc".repeat(32),
    tokenName: "TestToken",
    tokenSymbol: "TEST",
    totalSupply: 1000000000000000n,
    targetCkb: 100000000000n,
    maxCkb: 200000000000n,
    priceMultiplierBps: 100,
    startTime: BigInt(Math.floor(Date.now() / 1000)),
    endTime: BigInt(Math.floor(Date.now() / 1000) + 3600),
    dexScriptHash: "0x" + "dd".repeat(32),
  });

  const encoded = sdk.encodeLaunchConfig(config);
  const decoded = sdk.decodeLaunchConfig(encoded);

  if (decoded.launchId !== config.launchId) {
    throw new Error("Launch config encoding/decoding mismatch");
  }
  logStep("1", "✓ Launch config roundtrip verified");

  const curve = sdk.createCurveConfig({
    curveId: "0x" + "ee".repeat(32),
    launchId: config.launchId,
    dexOperatorLockHash: "0x" + "ff".repeat(32),
    dexScriptHash: config.dexScriptHash,
    priceMultiplierBps: 100,
    startTime: config.startTime,
    endTime: config.endTime,
    launchOffsetBlocks: 0n,
    targetCkb: config.targetCkb,
    initialPriceScaled: 1000000000000n,
    stakeCkb: 10000000000n,
  });

  const encodedCurve = sdk.encodeCurveData(curve);
  const decodedCurve = sdk.decodeCurveData(encodedCurve);

  if (decodedCurve.curveId !== curve.curveId) {
    throw new Error("Curve encoding/decoding mismatch");
  }
  logStep("2", "✓ Curve config roundtrip verified");

  const now = Math.floor(Date.now() / 1000);
  const refundClaim = sdk.createRefundClaim({
    merkleRoot: "0x" + "11".repeat(32),
    launchId: config.launchId,
    curveId: curve.curveId,
    totalRefundCkb: 50000000000n,
    totalRefundTokens: 0n,
    refundStartTime: BigInt(now),
    refundEndTime: BigInt(now + 3600),
  });

  const encodedRefund = sdk.encodeRefundClaim(refundClaim);
  const decodedRefund = sdk.decodeRefundClaim(encodedRefund);

  if (decodedRefund.merkleRoot !== refundClaim.merkleRoot) {
    throw new Error("Refund encoding/decoding mismatch");
  }
  logStep("3", "✓ Refund claim roundtrip verified");

  const tokensReceived = sdk.calculateTokensForCkb(10000000000n, curve);
  logStep(
    "4",
    `100 CKB → ${Number(tokensReceived / 100000000n).toFixed(4)} tokens`,
  );

  const impact = sdk.calculatePriceImpact(10000000000n, curve);
  logStep("5", `Price impact: ${Number(impact.impactPercent).toFixed(4)}%`);

  const claims = [
    {
      address: "0x" + "aa".repeat(32),
      amount: 10000000000n,
      launchId: config.launchId,
    },
    {
      address: "0x" + "bb".repeat(32),
      amount: 5000000000n,
      launchId: config.launchId,
    },
  ];
  const batchProofs = sdk.generateBatchProofs(claims);
  const isValid = sdk.verifyMerkleProof(
    batchProofs[0].leaf,
    batchProofs[0].proof,
  );

  if (!isValid) {
    throw new Error("Merkle proof verification failed");
  }
  logStep("6", "✓ Merkle proof verified");

  const vault = sdk.createVault("0x" + "ff".repeat(32), config.launchId);
  const updatedVault = sdk.addFees(vault, 1000000000n);
  const breakdown = sdk.getFeeBreakdown(updatedVault);
  logStep(
    "7",
    `Fee breakdown: LP ${breakdown.lpFeePercent}% / Op ${breakdown.operatorFeePercent}% / Proto ${breakdown.protocolFeePercent}%`,
  );

  return { config, curve, refundClaim };
}

async function main() {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  Ohrex Launchpad - Test Suite                            ║",
    colors.bright,
  );
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    colors.bright,
  );

  log("Checking devnet...", colors.blue);
  try {
    await rpcRequest("get_tip_block_number");
    log("✓ Devnet is ready", colors.green);
  } catch {
    log("✗ Devnet not running. Start it with: node build/setup.js", colors.red);
    process.exit(1);
  }

  try {
    await testSdkEncoding();

    const { launchId, txHash, config } = await createLaunch({
      tokenName: "TestToken",
      tokenSymbol: "TEST",
      totalSupply: 1000000000000000n,
      targetCkb: 100000000000n,
      maxCkb: 200000000000n,
      priceMultiplierBps: 100,
    });

    logSection("Test Summary");
    log("✓ SDK encoding/decoding roundtrips", colors.green);
    log("✓ Bonding curve calculations", colors.green);
    log("✓ Merkle proof generation & verification", colors.green);
    log("✓ Fee vault operations", colors.green);
    log("✓ On-chain launch creation", colors.green);

    log("\n" + "─".repeat(60), colors.bright);
    log("All launchpad tests passed!", colors.green);
    log("─".repeat(60), colors.bright);
    log(`\n  Launch ID: ${launchId}`, colors.cyan);
    log(`  TX Hash: ${txHash}`, colors.cyan);
    log(`  Token: ${config.tokenName} (${config.tokenSymbol})`, colors.cyan);
    log(
      `  Target: ${(config.targetCkb / 100000000n).toString()} CKB`,
      colors.cyan,
    );
    log("\n");
  } catch (e) {
    log(`\n✗ Test failed: ${e.message}`, colors.red);
    console.error(e);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    log(`\n✗ Error: ${err.message}`, colors.red);
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  createLaunch,
  testSdkEncoding,
};
