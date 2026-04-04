require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const { ccc } = require("@ckb-ccc/core");
const { colors, log, rpcRequest } = require("../utils/cli-helpers");
const {
  calculateCurvePrice,
  calculateArbitrageOpportunity,
  formatPrice,
  decodeCurveData,
  DCURVE_DATA_SIZE,
  PRICE_MULTIPLIER_DISCOUNT,
  PRICE_MULTIPLIER_BASELINE,
  PRICE_MULTIPLIER_PREMIUM,
} = require("../../sdk");


async function getActiveCurves(launchId) {
  log("  Scanning on-chain for curve cells...", colors.cyan);

  try {
    
    
    const PRIVATE_KEY = process.env.CKB_GENESIS_PRIVKEY_0;
    if (!PRIVATE_KEY) {
      log("  ⚠️  CKB_GENESIS_PRIVKEY_0 not set", colors.yellow);
      return [];
    }

    const signer = new ccc.SignerCkbPrivateKey({ rpc: {} }, PRIVATE_KEY);
    const pubKey = signer.publicKey;
    const pubKeyHash = ccc.hexFrom(
      ccc.hashCkb(ccc.bytesFrom(pubKey)).slice(0, 42),
    );

    log(`  Scanning address: ${pubKeyHash}`, colors.cyan);

    
    
    const result = await rpcRequest("get_cells", [
      {
        script: {
          code_hash:
            "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
          hash_type: "type",
          args: pubKeyHash,
        },
        script_type: "lock",
        script_search_mode: "exact",
      },
      "asc",
      "0x200", 
    ]);

    if (!result.objects || result.objects.length === 0) {
      log("  No cells found for scanning", colors.yellow);
      return [];
    }

    log(
      `  Scanning ${result.objects.length} cell(s) for curve data...`,
      colors.cyan,
    );

    const curves = [];
    for (const cell of result.objects) {
      try {
        
        const dataHex = cell.data || cell.output_data;
        if (!dataHex || dataHex === "0x") continue;

        const dataBytes = new Uint8Array(
          dataHex
            .slice(2)
            .match(/.{2}/g)
            .map((b) => parseInt(b, 16)),
        );

        
        if (dataBytes.length !== DCURVE_DATA_SIZE) continue;

        const curveData = decodeCurveData(dataBytes);

        
        if (curveData.launchId !== launchId) continue;

        
        if (curveData.status === 1) {
          
          curves.push({
            curveId: curveData.curveId,
            launchId: curveData.launchId,
            dexName: `Curve ${curveData.curveId.slice(2, 8)}...`,
            tokensAllocated: curveData.tokensAllocated,
            tokensSold: curveData.tokensSold,
            initialPriceScaled: curveData.initialPriceScaled,
            priceMultiplierBps: curveData.priceMultiplierBps,
            currentCkb: curveData.currentCkb,
            targetCkb: curveData.targetCkb,
            status: curveData.status,
          });
        }
      } catch (e) {
        
        continue;
      }
    }

    log(`  Decoded ${curves.length} active curve(s)`, colors.green);
    return curves;
  } catch (e) {
    log(`  Error scanning curves: ${e.message}`, colors.red);
    return [];
  }
}

async function trackArbitrage(options = {}) {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  ATHEON - Arbitrage Tracker                                ║",
    colors.bright,
  );
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    colors.bright,
  );

  try {
    const launchId = options.launchId;

    if (!launchId) {
      log("\n  ✗ Launch ID required", colors.red);
      return;
    }

    log(`\n[Tracking] Launch: ${launchId.slice(0, 30)}...`, colors.cyan);

    log("\n[Step 1/3] Fetching active curves...", colors.blue);
    const curves = await getActiveCurves(launchId);
    log(`  ✓ Found ${curves.length} active curves`, colors.green);

    if (curves.length === 0) {
      log("\n  ⚠️  No active curves found for this launch", colors.yellow);
      log("  This could mean:", colors.yellow);
      log("    - No curves have been created yet", colors.cyan);
      log("    - All curves are in pending/expired status", colors.cyan);
      log("    - The launch ID is invalid on-chain", colors.cyan);
      return { curves: [], opportunitiesFound: 0 };
    }

    log("\n[Step 2/3] Calculating prices...", colors.blue);
    log("\n  Current Bonding Curve Prices:", colors.bright);
    log("  " + "─".repeat(50), colors.cyan);

    for (const curve of curves) {
      const price = calculateCurvePrice(curve);
      const progress = (curve.tokensSold * 100n) / curve.tokensAllocated;

      const multiplierLabel =
        curve.priceMultiplierBps === PRICE_MULTIPLIER_DISCOUNT
          ? "📉 DISCOUNT"
          : curve.priceMultiplierBps === PRICE_MULTIPLIER_PREMIUM
            ? "📈 PREMIUM"
            : "➡️  BASELINE";

      log(`  ${curve.dexName.padEnd(25)} ${multiplierLabel}`, colors.cyan);
      log(`    Price: ${formatPrice(price)} CKB/token`, colors.cyan);
      log(`    Progress: ${progress.toString()}% sold`, colors.cyan);
      log(`    Curve ID: ${curve.curveId.slice(0, 20)}...`, colors.cyan);
      log("");
    }

    log("\n[Step 3/3] Finding arbitrage opportunities...", colors.blue);
    log("\n  Arbitrage Opportunities:", colors.bright);
    log("  " + "─".repeat(50), colors.cyan);

    let opportunitiesFound = 0;

    for (let i = 0; i < curves.length; i++) {
      for (let j = i + 1; j < curves.length; j++) {
        const opp = calculateArbitrageOpportunity(curves[i], curves[j]);

        if (opp.profitBps > 50n) {
          
          opportunitiesFound++;

          const profitPercent = Number(opp.profitBps) / 100;
          const emoji =
            profitPercent > 5 ? "🔥" : profitPercent > 2 ? "⚡" : "💰";

          log(
            `  ${emoji} ${opp.direction}: ${profitPercent.toFixed(2)}% profit`,
            colors.green,
          );
          log(
            `     Buy on ${opp.direction.includes("A") ? curves[i].dexName : curves[j].dexName}`,
            colors.cyan,
          );
          log(
            `     Sell on ${opp.direction.includes("A") ? curves[j].dexName : curves[i].dexName}`,
            colors.cyan,
          );
          log(
            `     Price diff: ${formatPrice(opp.priceA)} vs ${formatPrice(opp.priceB)}`,
            colors.cyan,
          );
          log("");
        }
      }
    }

    if (opportunitiesFound === 0) {
      log("  No significant arbitrage opportunities found", colors.yellow);
      log("  (Minimum 0.5% profit required after fees)", colors.yellow);
    } else {
      log(`  ✓ Found ${opportunitiesFound} opportunity(ies)!`, colors.green);
    }

    
    log("\n" + "═".repeat(50), colors.bright);
    log("  Summary:", colors.bright);
    log("  " + "─".repeat(50), colors.cyan);
    log(`  Total curves tracked: ${curves.length}`, colors.cyan);
    log(
      `  Best arbitrage: ${opportunitiesFound > 0 ? "Available" : "None"}`,
      colors.cyan,
    );
    log(`  Launch status: Active`, colors.green);

    log("\n  Tip: Arbitrage helps equalize prices across DEXs", colors.yellow);
    log("  and generates trading fees for LP holders!", colors.yellow);

    return { curves, opportunitiesFound };
  } catch (e) {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    throw e;
  }
}

async function main() {
  
  const launchId = process.argv[2] || "0x" + "11".repeat(32);
  return await trackArbitrage({ launchId });
}


if (require.main === module) {
  main().catch((e) => {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    process.exit(1);
  });
}

module.exports = {
  trackArbitrage,
  main,
  getActiveCurves,
  PRICE_MULTIPLIER_DISCOUNT,
  PRICE_MULTIPLIER_BASELINE,
  PRICE_MULTIPLIER_PREMIUM,
};
