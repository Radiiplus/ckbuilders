

require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const { FeeEstimator } = require("../../sdk");
const { colors, log, rpcRequest } = require("./cli-helpers");

async function main() {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  ATHEON - Check Pending Transactions                     ║",
    colors.bright,
  );
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    colors.bright,
  );

  const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
  const feeEstimator = new FeeEstimator(RPC_URL);

  try {
    log("\n[Step 1/3] Getting transaction pool info...", colors.blue);
    let txPoolInfo = null;

    try {
      txPoolInfo = await feeEstimator.client.getTxpoolInfo();
    } catch (e) {
      log(
        "  ⚠️  Could not get tx pool info (method may not be available)",
        colors.yellow,
      );
      txPoolInfo = { txs: [] };
    }

    log(
      `  ✓ Pending Transactions: ${txPoolInfo.txs?.length || 0}`,
      colors.green,
    );

    if (!txPoolInfo.txs || txPoolInfo.txs.length === 0) {
      log("\n  ✓ No pending transactions!", colors.green);
      log("\n  You can safely run pool initialization.", colors.cyan);
      return;
    }

    log("\n[Step 2/3] Getting tx pool config...", colors.blue);
    let txPoolConfig = null;
    try {
      txPoolConfig = await feeEstimator.client.getTxpoolConfig();
      log(
        `  ✓ Min Fee Rate: ${txPoolConfig.minFeeRate || 0} shannons/KB`,
        colors.green,
      );
    } catch (e) {
      log("  ⚠️  Could not get tx pool config", colors.yellow);
      log(`    Using default min fee rate: 1000 shannons/KB`, colors.cyan);
    }

    log("\n[Step 3/3] Pending Transactions:", colors.blue);

    for (let i = 0; i < txPoolInfo.txs.length; i++) {
      const tx = txPoolInfo.txs[i];
      log(`\n  [${i + 1}] Transaction:`, colors.cyan);
      log(`    Hash: ${tx.hash?.slice(0, 30)}...`, colors.yellow);
      log(
        `    Fee: ${Number(tx.fee || 0) / 1e8} CKB (${tx.fee || 0} shannons)`,
      );
      log(`    Size: ${tx.size || 0} bytes`);
      log(`    Inputs: ${tx.inputs?.length || 0}`);
      log(`    Outputs: ${tx.outputs?.length || 0}`);

      if (tx.fee && tx.size) {
        const feeRate = Math.round(Number(tx.fee) / (tx.size / 1024));
        log(`    Fee Rate: ~${feeRate} shannons/KB`, colors.cyan);
      }

      if (tx.inputs && tx.inputs.length > 0) {
        log(`    Inputs:`, colors.cyan);
        tx.inputs.slice(0, 3).forEach((inp, j) => {
          const txHash = inp.previous_output?.tx_hash || inp.tx_hash;
          const index = inp.previous_output?.index || inp.index;
          log(
            `      [${j}] ${txHash?.slice(0, 18)}...:${index}`,
            colors.yellow,
          );
        });
        if (tx.inputs.length > 3) {
          log(`      ... and ${tx.inputs.length - 3} more`);
        }
      }
    }

    log("\n" + "─".repeat(60), colors.reset);
    log("\n  Summary:", colors.bright);
    log(`    Total Pending: ${txPoolInfo.txs.length} transaction(s)`);

    const totalFees = txPoolInfo.txs.reduce(
      (sum, tx) => sum + BigInt(tx.fee || 0),
      0n,
    );
    log(`    Total Fees: ${Number(totalFees) / 1e8} CKB`);

    const avgFeeRate =
      txPoolInfo.txs.length > 0
        ? Math.round(
            txPoolInfo.txs.reduce((sum, tx) => {
              const rate =
                tx.fee && tx.size ? Number(tx.fee) / (tx.size / 1024) : 0;
              return sum + rate;
            }, 0) / txPoolInfo.txs.length,
          )
        : 0;
    log(`    Avg Fee Rate: ~${avgFeeRate} shannons/KB`);

    if (txPoolInfo.txs.length > 0) {
      log("\n  ⚠️  RBF Notice:", colors.yellow);
      log(
        "     If you try to spend the same inputs, you'll need to pay",
        colors.yellow,
      );
      log(
        "     at least 10% more fee than the pending transaction.",
        colors.yellow,
      );
      log(
        `     Min RBF fee rate: ~${Math.round(avgFeeRate * 1.1)} shannons/KB`,
        colors.cyan,
      );
    }

    log("");
  } catch (e) {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
  }
}

main();

module.exports = { main };
