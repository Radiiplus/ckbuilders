require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const fs = require("fs");
const path = require("path");
const { ccc } = require("../../offckb/node_modules/@ckb-ccc/core");
const {
  SimpleTxBuilder,
  calculateMinimumCapacity,
  encodeCurveData,
  calculateTokensForCkb,
  decodeCurveData,
  DCURVE_DATA_SIZE,
} = require("../../sdk");
const {
  colors,
  log,
  rpcRequest,
  saveContributionReceipt,
  getSecpTxOptions,
  getContractInfo,
} = require("../utils/cli-helpers");

async function fetchCurveFromChain(curveId) {
  const dexInfo = getContractInfo("dex", "devnet");
  const curveTypeScript = dexInfo.typeScript;

  try {
    const result = await rpcRequest("get_live_cell", [
      {
        txHash: curveId,
        index: "0x0",
        withData: true,
      },
      false,
    ]);

    if (result.cell && result.cell.data && result.cell.data.content) {
      const dataHex = result.cell.data.content;
      const dataBytes = new Uint8Array(
        dataHex
          .slice(2)
          .match(/.{2}/g)
          .map((b) => parseInt(b, 16)),
      );

      if (dataBytes.length === DCURVE_DATA_SIZE) {
        return decodeCurveData(dataBytes);
      }
    }
  } catch (e) {
    log(
      `  Warning: Could not fetch curve cell directly: ${e.message}`,
      colors.yellow,
    );
  }

  return null;
}

async function searchCurveByLaunchId(launchId, curveIdHint) {
  const dexInfo = getContractInfo("dex", "devnet");
  const curveTypeScript = dexInfo.typeScript;

  try {
    const result = await rpcRequest("get_cells", [
      {
        script: {
          code_hash: curveTypeScript.codeHash,
          hash_type: curveTypeScript.hashType,
          args: launchId.slice(0, 42),
        },
        script_type: "type",
        script_search_mode: "prefix",
      },
      "asc",
      "0x10",
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

      if (dataBytes.length !== DCURVE_DATA_SIZE) continue;

      try {
        const curveData = decodeCurveData(dataBytes);

        if (!curveIdHint || curveData.curveId === curveIdHint) {
          return curveData;
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    log(`  Warning: Error searching for curve: ${e.message}`, colors.yellow);
  }

  return null;
}

async function contributeToCurve(options = {}) {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  Ohrex - Contribute to Bonding Curve                    ║",
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

    log("\n[Step 2/5] Loading curve information...", colors.blue);
    const curveId = options.curveId;
    const launchId = options.launchId;
    const contributionCkb = BigInt(options.contributionCkb || 10000000000n);

    if (!curveId || !launchId) {
      log("  ✗ Curve ID and Launch ID required", colors.red);
      return;
    }

    log(`  ✓ Curve ID: ${curveId.slice(0, 30)}...`, colors.cyan);
    log(`  ✓ Launch ID: ${launchId.slice(0, 30)}...`, colors.cyan);
    log(
      `  ✓ Contributing: ${(contributionCkb / 100000000n).toString()} CKB`,
      colors.cyan,
    );

    log("\n[Step 2.5/5] Fetching curve data from chain...", colors.blue);
    let curve = await searchCurveByLaunchId(launchId, curveId);

    if (!curve) {
      log(
        "  ⚠️  Curve not found on-chain, using provided parameters",
        colors.yellow,
      );

      curve = {
        curveId,
        launchId,
        tokensAllocated: BigInt(options.tokensAllocated || 1000000000n),
        tokensSold: BigInt(options.tokensSold || 0n),
        initialPriceScaled: BigInt(options.initialPriceScaled || 100000000000n),
        priceMultiplierBps: options.priceMultiplierBps || 100,
        targetCkb: BigInt(options.targetCkb || 100000000000n),
        currentCkb: BigInt(options.currentCkb || 0n),
        status: options.curveStatus || 1,
      };
      log(`  Using curve from options:`, colors.cyan);
    } else {
      log(`  ✓ Curve fetched from chain`, colors.green);
    }

    log(`  Curve status: ${curve.status}`, colors.cyan);
    log(
      `  Tokens allocated: ${(curve.tokensAllocated / 100000000n).toString()}`,
      colors.cyan,
    );
    log(
      `  Tokens sold: ${(curve.tokensSold / 100000000n).toString()}`,
      colors.cyan,
    );

    const tokensReceived = calculateTokensForCkb(contributionCkb, curve);
    log(
      `  ✓ Estimated tokens: ${(tokensReceived / 100000000n).toString()}`,
      colors.green,
    );

    log("\n[Step 3/5] Building contribution transaction...", colors.blue);
    const txBuilder = new SimpleTxBuilder(RPC_URL, getSecpTxOptions("devnet"));
    const lockScript = await txBuilder.getLockScript(PRIVATE_KEY);

    const signer = new ccc.SignerCkbPrivateKey({ rpc: {} }, PRIVATE_KEY);
    const pubKey = signer.publicKey;
    const pubKeyHash = ccc.hexFrom(
      ccc.hashCkb(ccc.bytesFrom(pubKey)).slice(0, 42),
    );

    const updatedCurve = {
      curveId: curve.curveId,
      launchId: curve.launchId,
      dexOperatorLockHash: curve.dexOperatorLockHash || pubKeyHash,
      dexScriptHash: curve.dexScriptHash || "0x" + "00".repeat(32),
      priceMultiplierBps: curve.priceMultiplierBps,
      status: curve.status,
      startTime: curve.startTime || 0n,
      endTime: curve.endTime || 0n,
      launchOffsetBlocks: curve.launchOffsetBlocks || 0n,
      targetCkb: curve.targetCkb || 100000000000n,
      currentCkb: (curve.currentCkb || 0n) + contributionCkb,
      tokensAllocated: curve.tokensAllocated,
      tokensSold: curve.tokensSold + tokensReceived,
      contributorCount: (curve.contributorCount || 0n) + 1n,
      stakeCkb: curve.stakeCkb || 0n,
      feesGenerated: curve.feesGenerated || 0n,
      currentPriceScaled: curve.currentPriceScaled || curve.initialPriceScaled,
      initialPriceScaled: curve.initialPriceScaled,
    };

    const curveDataHex = ccc.hexFrom(encodeCurveData(updatedCurve));

    const curveCellCapacity = calculateMinimumCapacity(
      lockScript,
      null,
      curveDataHex,
    );

    log(
      `  ✓ Curve data size: ${(curveDataHex.length - 2) / 2} bytes`,
      colors.cyan,
    );
    log(
      `  ✓ Curve cell capacity: ${(curveCellCapacity / 100000000n).toString()} CKB`,
      colors.cyan,
    );
    log(
      `  ✓ Curve ID embedded in data: ${updatedCurve.curveId.slice(0, 18)}...`,
      colors.cyan,
    );

    const outputs = [
      {
        lock: lockScript,
        capacity: curveCellCapacity + 100_000_000n,
      },
    ];

    log("\n[Step 4/5] Sending transaction...", colors.blue);
    const { txHash } = await txBuilder.buildAndSendWithRbfRetry(
      outputs,
      [curveDataHex],
      PRIVATE_KEY,
      3000,
    );

    log("  ✓ Contribution sent!", colors.green);
    log(`    Transaction: ${txHash}`, colors.cyan);
    log(`    Curve cell created with DEX type script`, colors.cyan);
    log(`    Tokens: ${tokensReceived.toString()}`, colors.cyan);

    const receiptFile = saveContributionReceipt(
      {
        txHash,
        curveId: curve.curveId,
        launchId,
        contributedCkb: contributionCkb.toString(),
        tokensReceived: tokensReceived.toString(),
        timestamp: Date.now(),
      },
      txHash,
    );
    log(`  ✓ Receipt saved: ${receiptFile}`, colors.cyan);

    log("\n[Step 5/5] Waiting for confirmation...", colors.blue);
    await txBuilder.waitForTransaction(txHash);

    log("  ✓ Contribution complete!", colors.green);
    log(
      `\n  Keep your receipt file safe - you'll need it to claim LP tokens!`,
      colors.yellow,
    );

    return { txHash, tokensReceived, curveId, launchId };
  } catch (e) {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    throw e;
  }
}

async function main() {
  return await contributeToCurve();
}

if (require.main === module) {
  main().catch((e) => {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    process.exit(1);
  });
}

module.exports = {
  contributeToCurve,
  main,
};
