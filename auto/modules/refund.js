require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const fs = require("fs");
const path = require("path");
const { ccc } = require("../../offckb/node_modules/@ckb-ccc/core");
const { blake2b } = require("@noble/hashes/blake2.js");
const {
  SimpleTxBuilder,
  decodeLaunchConfig,
  LAUNCH_DATA_SIZE,
  STATUS_EXPIRED,
  STATUS_CANCELLED,
  generateMerkleProof,
  verifyMerkleProof,
  createClaimLeaf,
  decodeRefundClaim,
  encodeRefundClaim,
  createRefundClaim,
  REFUND_DATA_SIZE,
  REFUND_STATUS_ACTIVE,
  REFUND_STATUS_COMPLETED,
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


async function fetchRefundFromChain(launchId) {
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

      
      if (dataBytes.length === REFUND_DATA_SIZE) {
        try {
          const refundClaim = decodeRefundClaim(dataBytes);
          if (refundClaim.launchId === launchId) {
            return refundClaim;
          }
        } catch (e) {
          continue;
        }
      }
    }
  } catch (e) {
    log(
      `  Warning: Error fetching refund from chain: ${e.message}`,
      colors.yellow,
    );
  }

  return null;
}

async function claimRefund(options = {}) {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  ATHEON - Claim Refund (Failed Launch)                     ║",
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
    for (const receipt of receipts) {
      totalContributed += BigInt(receipt.contributedCkb);
    }

    log(
      `  ✓ Total refundable: ${(totalContributed / 100000000n).toString()} CKB`,
      colors.cyan,
    );

    log("\n[Step 4/6] Checking launch status...", colors.blue);

    
    const launchConfig = await fetchLaunchFromChain(launchId);

    if (!launchConfig) {
      log("  ⚠️  Launch not found on-chain", colors.yellow);
      log(
        "  Proceeding with refund based on contribution receipts",
        colors.cyan,
      );
      log("  Note: Verify launch exists before refunding", colors.yellow);
    } else {
      log(`  ✓ Launch found on-chain`, colors.green);
      log(
        `  Token: ${launchConfig.tokenName} (${launchConfig.tokenSymbol})`,
        colors.cyan,
      );
      log(`  Status: ${launchConfig.status}`, colors.cyan);

      
      if (
        launchConfig.status !== STATUS_EXPIRED &&
        launchConfig.status !== STATUS_CANCELLED
      ) {
        const statusNames = {
          0: "PENDING",
          1: "ACTIVE",
          2: "SUCCESS",
          3: "EXPIRED",
          4: "CANCELLED",
        };
        const statusName =
          statusNames[launchConfig.status] || `UNKNOWN(${launchConfig.status})`;
        log(
          `  ✗ Launch is ${statusName}, refund not available yet`,
          colors.red,
        );
        log(
          "  Refunds are only available for expired or cancelled launches",
          colors.yellow,
        );
        return;
      }

      log(
        `  ✓ Launch ${launchConfig.status === STATUS_EXPIRED ? "expired" : "cancelled"} - refund available`,
        colors.green,
      );
    }

    
    const refundClaim = await fetchRefundFromChain(launchId);
    if (refundClaim) {
      log(`  ✓ Refund claim found on-chain`, colors.green);
      log(`  Refund status: ${refundClaim.status}`, colors.cyan);

      if (refundClaim.status !== REFUND_STATUS_ACTIVE) {
        const refundStatusNames = {
          0: "PENDING",
          1: "ACTIVE",
          2: "COMPLETED",
        };
        const refundStatusName =
          refundStatusNames[refundClaim.status] ||
          `UNKNOWN(${refundClaim.status})`;
        log(`  ⚠️  Refund is ${refundStatusName}`, colors.yellow);

        if (refundClaim.status === REFUND_STATUS_COMPLETED) {
          log(
            `  Claims processed: ${refundClaim.claimsProcessed}/${refundClaim.claimCount}`,
            colors.cyan,
          );
          if (refundClaim.claimsProcessed >= refundClaim.claimCount) {
            log(`  ✗ All refund claims have been processed`, colors.red);
            return;
          }
        }
      }
    } else {
      log(
        `  ⚠️  No on-chain refund claim found, proceeding with receipts`,
        colors.yellow,
      );
    }

    log("\n[Step 5/6] Building refund transaction...", colors.blue);
    const txBuilder = new SimpleTxBuilder(RPC_URL, getSecpTxOptions("devnet"));
    const lockScript = await txBuilder.getLockScript(PRIVATE_KEY);

    
    const outputs = [
      {
        lock: lockScript,
        capacity: totalContributed,
      },
    ];

    
    const leaves = receipts.map((r) =>
      createClaimLeaf({
        address: r.contributor,
        amount: BigInt(r.contributedCkb),
        launchId: r.launchId,
      }),
    );

    
    const proofs = receipts.map((receipt, index) => {
      const { proof, root } = generateMerkleProof(leaves, index);
      return { receipt, proof, root, index };
    });

    
    const {
      proof: merkleProof,
      root: merkleRoot,
      index: proofIndex,
    } = proofs[0];

    
    const now = Math.floor(Date.now() / 1000);
    const newRefundClaim = createRefundClaim({
      merkleRoot,
      launchId,
      curveId: receipts[0].curveId || "0x" + "00".repeat(32),
      totalRefundCkb: totalContributed,
      totalRefundTokens: 0n,
      refundStartTime: BigInt(now - 3600), 
      refundEndTime: BigInt(now + 86400 * 7), 
    });

    
    const dataHex = ccc.hexFrom(encodeRefundClaim(newRefundClaim));

    log(`  ✓ Refund data encoded: ${REFUND_DATA_SIZE} bytes`, colors.green);

    log("\n[Step 6/6] Sending refund transaction...", colors.blue);
    const { txHash } = await txBuilder.buildAndSendWithRbfRetry(
      outputs,
      [dataHex],
      PRIVATE_KEY,
      3000,
    );

    log("  ✓ Refund claimed!", colors.green);
    log(`    Transaction: ${txHash}`, colors.cyan);
    log(
      `    Refund amount: ${(totalContributed / 100000000n).toString()} CKB`,
      colors.cyan,
    );

    
    const refundFile = path.join(
      __dirname,
      "..",
      "..",
      "deployments",
      `refund-${txHash.slice(2, 12)}.json`,
    );
    fs.writeFileSync(
      refundFile,
      JSON.stringify(
        {
          txHash,
          launchId,
          refundAmount: totalContributed.toString(),
          receiptCount: receipts.length,
          merkleRoot,
          timestamp: Date.now(),
        },
        null,
        2,
      ),
    );

    log("\n  Waiting for confirmation...", colors.blue);
    await txBuilder.waitForTransaction(txHash);

    log("  ✓ Refund complete!", colors.green);
    log(
      `\n  Your CKB has been returned. Better luck next time!`,
      colors.yellow,
    );

    return { txHash, refundAmount: totalContributed, launchId };
  } catch (e) {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    throw e;
  }
}

async function main() {
  return await claimRefund();
}


if (require.main === module) {
  main().catch((e) => {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    process.exit(1);
  });
}

module.exports = {
  claimRefund,
  main,
};
