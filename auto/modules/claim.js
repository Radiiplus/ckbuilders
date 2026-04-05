require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const fs = require("fs");
const path = require("path");
const { ccc } = require("../../offckb/node_modules/@ckb-ccc/core");
const {
  SimpleTxBuilder,
  FeeEstimator,
  calculateMinimumCapacity,
  decodeLaunchConfig,
  LAUNCH_DATA_SIZE,
  STATUS_SUCCESS,
  STATUS_EXPIRED,
  STATUS_ACTIVE,
  STATUS_PENDING,
} = require("../../sdk");
const {
  colors,
  log,
  rpcRequest,
  findContributionReceipts,
  getSecpTxOptions,
  getContractInfo,
} = require("../utils/cli-helpers");

async function fetchLaunchFromChain(launchId) {
  const launchpadInfo = getContractInfo("launchpad", "devnet");
  const launchTypeScript = launchpadInfo.typeScript;

  try {
    const result = await rpcRequest("get_cells", [
      {
        script: {
          code_hash: launchTypeScript.codeHash,
          hash_type: launchTypeScript.hashType,
          args: launchId.slice(0, 42),
        },
        script_type: "type",
        script_search_mode: "prefix",
      },
      "asc",
      "0x0a",
    ]);

    if (!result.objects || result.objects.length === 0) {
      return null;
    }

    for (const cell of result.objects) {
      const dataHex = cell.data || cell.output_data;
      if (!dataHex || dataHex === "0x") continue;

      const dataBytes = new Uint8Array(
        dataHex
          .slice(2)
          .match(/.{2}/g)
          .map((b) => parseInt(b, 16)),
      );

      if (dataBytes.length !== LAUNCH_DATA_SIZE) continue;

      try {
        const launchConfig = decodeLaunchConfig(dataBytes);

        if (launchConfig.launchId === launchId) {
          return launchConfig;
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    log(
      `  Warning: Error fetching launch from chain: ${e.message}`,
      colors.yellow,
    );
  }

  return null;
}

function calculateLPTokens(receipts, launchInfo) {
  let totalTokens = 0n;
  for (const receipt of receipts) {
    totalTokens += BigInt(receipt.tokensReceived);
  }

  return totalTokens;
}

async function claimLP(options = {}) {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  Ohrex - Claim LP Tokens                                  ║",
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

    log("\n[Step 2/6] Loading launch information...", colors.blue);
    const launchId = options.launchId;

    if (!launchId) {
      log("  ✗ Launch ID required", colors.red);
      return;
    }

    log(`  ✓ Launch ID: ${launchId.slice(0, 30)}...`, colors.cyan);

    log("\n[Step 3/6] Finding contribution receipts...", colors.blue);
    const signer = new ccc.SignerCkbPrivateKey({ rpc: {} }, PRIVATE_KEY);
    const pubKey = signer.publicKey;
    const pubKeyHash = ccc.hexFrom(
      ccc.hashCkb(ccc.bytesFrom(pubKey)).slice(0, 42),
    );

    const receipts = findContributionReceipts(pubKeyHash, launchId);

    if (receipts.length === 0) {
      log("  ✗ No contribution receipts found", colors.red);
      return;
    }

    log(`  ✓ Found ${receipts.length} receipt(s)`, colors.green);

    let totalContributed = 0n;
    let totalTokens = 0n;
    for (const receipt of receipts) {
      totalContributed += BigInt(receipt.contributedCkb);
      totalTokens += BigInt(receipt.tokensReceived);
    }

    log(
      `  ✓ Total contributed: ${(totalContributed / 100000000n).toString()} CKB`,
      colors.cyan,
    );
    log(
      `  ✓ Total tokens: ${(totalTokens / 100000000n).toString()}`,
      colors.cyan,
    );

    log("\n[Step 4/6] Checking launch status...", colors.blue);

    const launchConfig = await fetchLaunchFromChain(launchId);

    if (!launchConfig) {
      log("  ⚠️  Launch not found on-chain", colors.yellow);
      log(
        "  Proceeding with claim based on contribution receipts",
        colors.cyan,
      );
      log("  Note: Verify launch exists before claiming", colors.yellow);
    } else {
      log(`  ✓ Launch found on-chain`, colors.green);
      log(
        `  Token: ${launchConfig.tokenName} (${launchConfig.tokenSymbol})`,
        colors.cyan,
      );
      log(`  Status: ${launchConfig.status}`, colors.cyan);

      if (launchConfig.status !== STATUS_SUCCESS) {
        const statusNames = {
          [STATUS_PENDING]: "PENDING",
          [STATUS_ACTIVE]: "ACTIVE",
          [STATUS_SUCCESS]: "SUCCESS",
          [STATUS_EXPIRED]: "EXPIRED",
        };
        const statusName =
          statusNames[launchConfig.status] || `UNKNOWN(${launchConfig.status})`;
        log(`  ✗ Launch is ${statusName}, cannot claim LP tokens`, colors.red);
        log(
          "  LP tokens can only be claimed for successful launches",
          colors.yellow,
        );
        return;
      }

      log(`  ✓ Launch successful - LP claim available`, colors.green);
    }

    log("\n[Step 5/6] Building LP claim transaction...", colors.blue);
    const txBuilder = new SimpleTxBuilder(RPC_URL, getSecpTxOptions("devnet"));
    const lockScript = await txBuilder.getLockScript(PRIVATE_KEY);

    const poolInfo = getContractInfo("pool", "devnet");
    const lpTokenTypeScript = {
      codeHash: poolInfo.typeScript.codeHash,
      hashType: poolInfo.typeScript.hashType,
      args: launchId,
    };

    log(
      `  ✓ LP token type script: ${lpTokenTypeScript.codeHash.slice(0, 18)}...`,
      colors.green,
    );

    const dataHex = ccc.hexFrom(ccc.numLeToBytes(totalTokens, 16));
    const minCapacity = calculateMinimumCapacity(
      lockScript,
      lpTokenTypeScript,
      dataHex,
    );
    const cellCapacity = minCapacity + 100_000_000n;

    const outputs = [
      {
        lock: lockScript,
        type: lpTokenTypeScript,
        capacity: cellCapacity,
      },
    ];

    const lpTokenAmount = totalTokens;

    log("\n[Step 6/6] Sending transaction...", colors.blue);
    const { txHash } = await txBuilder.buildAndSendWithRbfRetry(
      outputs,
      [dataHex],
      PRIVATE_KEY,
      3000,
    );

    log("  ✓ LP tokens claimed!", colors.green);
    log(`    Transaction: ${txHash}`, colors.cyan);
    log(`    LP tokens: ${(totalTokens / 100000000n).toString()}`, colors.cyan);

    const claimFile = path.join(
      __dirname,
      "..",
      "..",
      "deployments",
      `claim-${txHash.slice(2, 12)}.json`,
    );
    fs.writeFileSync(
      claimFile,
      JSON.stringify(
        {
          txHash,
          launchId,
          totalContributed: totalContributed.toString(),
          lpTokens: totalTokens.toString(),
          receiptCount: receipts.length,
          timestamp: Date.now(),
        },
        null,
        2,
      ),
    );

    log("\n  Waiting for confirmation...", colors.blue);
    await txBuilder.waitForTransaction(txHash);

    log("  ✓ Claim complete!", colors.green);
    log(
      `\n  You can now trade your LP tokens or earn fees from the pool!`,
      colors.green,
    );

    return { txHash, lpTokens: totalTokens, launchId };
  } catch (e) {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    throw e;
  }
}

async function main() {
  return await claimLP();
}

if (require.main === module) {
  main().catch((e) => {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    process.exit(1);
  });
}

module.exports = {
  claimLP,
  main,
  findContributionReceipts,
  calculateLPTokens,
};
