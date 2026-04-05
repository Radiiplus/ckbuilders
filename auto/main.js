require("dotenv").config({
  path: require("path").resolve(__dirname, "..", ".env"),
});

const fs = require("fs");
const path = require("path");
const {
  getFactoryScriptHash,
  displayFactoryHash,
  log,
  colors,
} = require("./utils/cli-helpers");

async function main() {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  Ohrex - Full Protocol Initialization                   ║",
    colors.bright,
  );
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    colors.bright,
  );

  try {
    const deploymentsFile = path.join(
      __dirname,
      "..",
      "deployments",
      "devnet-deployments.json",
    );
    const hasDeployment = fs.existsSync(deploymentsFile);

    if (!hasDeployment) {
      log("\n✗ Deployment not found. Run setup first:", colors.yellow);
      log("  node build/setup.js", colors.cyan);
      return;
    }

    log("\n✓ Deployment exists", colors.green);

    const factoryResult = getFactoryScriptHash("devnet");
    const factoryScriptHash = factoryResult.scriptHash;
    log(
      `\n✓ Factory script: ${factoryScriptHash.slice(0, 18)}...`,
      colors.green,
    );

    const factoryModule = require("./modules/factory");
    const registryModule = require("./modules/registry");
    const dexModule = require("./modules/dex");
    const poolModule = require("./modules/pool");
    const launchpadModule = require("./modules/launchpad");

    log(
      "\n══════════════════════════════════════════════════════════",
      colors.cyan,
    );
    log("Step 1: Initialize Factory", colors.bright);
    log(
      "══════════════════════════════════════════════════════════",
      colors.cyan,
    );

    const isFactoryInitialized =
      await factoryModule.checkFactoryInitialized(factoryScriptHash);

    if (isFactoryInitialized) {
      log("✓ Factory is already initialized", colors.green);
    } else {
      await factoryModule.main();
    }

    log(
      "\n══════════════════════════════════════════════════════════",
      colors.cyan,
    );
    log("Step 2: Create DEX Instance", colors.bright);
    log(
      "══════════════════════════════════════════════════════════",
      colors.cyan,
    );

    let dexResult;
    try {
      dexResult = await dexModule.main();
      log("✓ DEX created", colors.green);
    } catch (e) {
      log("\n  ⚠️  DEX creation skipped", colors.yellow);
      log(`  Reason: ${e.message}`, colors.cyan);
      dexResult = null;
    }

    log(
      "\n══════════════════════════════════════════════════════════",
      colors.cyan,
    );
    log("Step 3: Register DEX with Registry", colors.bright);
    log(
      "══════════════════════════════════════════════════════════",
      colors.cyan,
    );

    try {
      await registryModule.main();
      log("✓ Registry initialized", colors.green);
    } catch (e) {
      log("\n  ⚠️  Registry initialization skipped", colors.yellow);
      log(`  Reason: ${e.message}`, colors.cyan);
    }

    log(
      "\n══════════════════════════════════════════════════════════",
      colors.cyan,
    );
    log("Step 4: Create Pool", colors.bright);
    log(
      "══════════════════════════════════════════════════════════",
      colors.cyan,
    );

    try {
      await poolModule.main();
      log("✓ Pool created", colors.green);
    } catch (e) {
      log("\n  ⚠️  Pool creation skipped", colors.yellow);
      log(`  Reason: ${e.message}`, colors.cyan);
    }

    log(
      "\n══════════════════════════════════════════════════════════",
      colors.cyan,
    );
    log("Step 5: Create Token Launch", colors.bright);
    log(
      "══════════════════════════════════════════════════════════",
      colors.cyan,
    );

    let launchResult;
    let curveId;
    try {
      launchResult = await launchpadModule.createLaunch({
        tokenName: "TestToken",
        tokenSymbol: "TEST",
        totalSupply: 1000000000,
        targetCkb: 50000000000,
        maxCkb: 100000000000,
        priceMultiplierBps: 100,
      });
      log(
        `✓ Launch created: ${launchResult.config.tokenName} (${launchResult.config.tokenSymbol})`,
        colors.green,
      );
      log(`  Launch ID: ${launchResult.launchId.slice(0, 30)}...`, colors.cyan);

      const { ccc } = require("@ckb-ccc/core");
      const launchBytes = ccc.bytesFrom(ccc.hexFrom(launchResult.launchId));
      const dexIdBytes = ccc.bytesFrom(ccc.hexFrom("0x" + "01".repeat(32)));
      const curveHashBytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        curveHashBytes[i] = launchBytes[i] ^ dexIdBytes[i];
      }
      curveId = ccc.hexFrom(curveHashBytes);
      log(`  Curve ID: ${curveId.slice(0, 30)}...`, colors.cyan);
    } catch (e) {
      log("\n  ⚠️  Launch creation failed", colors.yellow);
      log(`  Reason: ${e.message}`, colors.cyan);
      launchResult = null;
      curveId = null;
    }

    log(
      "\n══════════════════════════════════════════════════════════",
      colors.cyan,
    );
    log("Step 6: Contribute to Launch", colors.bright);
    log(
      "══════════════════════════════════════════════════════════",
      colors.cyan,
    );

    let contributeResult;
    if (launchResult && curveId) {
      try {
        const contributeModule = require("./modules/contribute");
        contributeResult = await contributeModule.contributeToCurve({
          curveId,
          launchId: launchResult.launchId,
          contributionCkb: 10000000000,
        });
        log(`✓ Contribution sent`, colors.green);
        log(
          `  Tokens: ${(contributeResult.tokensReceived / 100000000n).toString()}`,
          colors.cyan,
        );
      } catch (e) {
        log("\n  ⚠️  Contribution skipped", colors.yellow);
        log(`  Reason: ${e.message}`, colors.cyan);
        contributeResult = null;
      }
    } else if (!curveId) {
      log("  ⚠️  No curveId available (launch may have failed)", colors.yellow);
    }

    log(
      "\n══════════════════════════════════════════════════════════",
      colors.cyan,
    );
    log("Step 7: Track Arbitrage Opportunities", colors.bright);
    log(
      "══════════════════════════════════════════════════════════",
      colors.cyan,
    );

    if (launchResult) {
      try {
        const arbModule = require("./modules/arb");
        await arbModule.trackArbitrage({ launchId: launchResult.launchId });
      } catch (e) {
        log("\n  ⚠️  Arbitrage tracking skipped", colors.yellow);
        log(`  Reason: ${e.message}`, colors.cyan);
      }
    }

    log(
      "\n╔═══════════════════════════════════════════════════════════╗",
      colors.green,
    );
    log(
      "║  ✓ Full Launchpad Test Complete!                     ║",
      colors.green,
    );
    log(
      "╚═══════════════════════════════════════════════════════════╝\n",
      colors.green,
    );

    if (launchResult) {
      log("Launch Summary:", colors.bright);
      log(
        `  Token: ${launchResult.config.tokenName} (${launchResult.config.tokenSymbol})`,
        colors.cyan,
      );
      log(`  Launch ID: ${launchResult.launchId}`, colors.cyan);
      if (contributeResult) {
        log(
          `  Test Contribution: ${(contributeResult.tokensReceived / 100000000n).toString()} tokens`,
          colors.cyan,
        );
      }
    }

    log("\n📚 Documentation:", colors.bright);
    log("  README.md                  - Project overview & quick start");
    log("  contracts/README.md        - On-chain contract specifications");
    log("  sdk/README.md              - SDK API reference & usage patterns");
    log("  build/README.md            - Devnet setup & deployment guide");
    log("  auto/README.md             - CLI usage & protocol automation");

    log("\n🎮 Interactive Commands:", colors.bright);
    log("  node auto/modules/launchpad.js    - Create another launch");
    log("  node auto/modules/contribute.js   - Contribute to a launch");
    log("  node auto/modules/claim.js        - Claim LP tokens");
    log("  node auto/modules/refund.js       - Claim refund");
    log("  node auto/modules/arb.js          - Track arbitrage");
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    log(`\n✗ Error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { getFactoryScriptHash };
