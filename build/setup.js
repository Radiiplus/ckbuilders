require("dotenv").config();

const devnet = require("./modules/devnet");
const wallets = require("./modules/wallets");
const faucet = require("./modules/faucet");
const deployer = require("./modules/deployer");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bright: "\x1b[1m",
  magenta: "\x1b[35m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${"=".repeat(50)}`, colors.bright);
  log(title, colors.bright);
  log("=".repeat(50), colors.bright);
}

async function main() {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  ATHEON Protocol - Devnet (Full)                          ║",
    colors.bright,
  );
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    colors.bright,
  );

  log("Stopping existing processes...", colors.blue);
  devnet.stop();
  await devnet.sleep(2000);

  logSection("1. Starting Devnet");
  log("Starting devnet...", colors.blue);
  await devnet.start();

  log("Waiting for RPC...", colors.blue);
  if (!(await devnet.waitForRPC(30))) {
    log("✗ Devnet failed to start", colors.red);
    process.exit(1);
  }
  log("✓ Devnet is ready", colors.green);
  log(`  RPC: ${devnet.getRPCUrl()}`, colors.cyan);

  logSection("2. Setting up wallets");
  const allWallets = wallets.getOrCreateWallets(4);
  log(`✓ Created ${allWallets.length} wallets`, colors.green);

  allWallets.forEach((w, i) => {
    log(`  [${i}] ${w.label.padEnd(12)} ${w.address}`, colors.cyan);
  });

  logSection("3. Funding wallets");
  const fundingAmount = BigInt(wallets.WALLETS_CONFIG.fundingAmount);
  log(
    `Target: ${(fundingAmount / 100000000n).toString()} CKB per wallet`,
    colors.blue,
  );

  const fundingResults = await faucet.fundWallets(allWallets, fundingAmount);

  fundingResults.forEach((result) => {
    if (result.success) {
      log(
        `  ✓ ${result.label.padEnd(12)} ${(BigInt(result.balance) / 100000000n).toString()} CKB`,
        colors.green,
      );
    } else {
      log(`  ✗ ${result.label.padEnd(12)} ${result.error}`, colors.red);
    }
  });

  logSection("4. Deploying contracts");
  log("Using genesis account for deployment", colors.blue);

  const deploymentResults = await deployer.deployAllContracts(allWallets[0]);

  deploymentResults.forEach((result) => {
    if (result.success) {
      log(
        `  ✓ ${result.contractName.padEnd(15)} ${result.binaryHash.slice(0, 18)}...`,
        colors.green,
      );
    } else {
      log(`  ✗ ${result.contractName.padEnd(15)} ${result.error}`, colors.red);
    }
  });

  logSection("5. Saving deployment info");
  const successfulDeployments = deploymentResults.filter((r) => r.success);

  if (successfulDeployments.length > 0) {
    const deploymentInfo = deployer.saveDeploymentInfo(
      successfulDeployments,
      "devnet",
    );
    log(`✓ Deployment info saved`, colors.green);

    log("\nDeployed contracts:", colors.bright);
    Object.entries(deploymentInfo.contracts).forEach(([name, info]) => {
      log(
        `  ${name.padEnd(15)} ${info.binaryHash.slice(0, 18)}...`,
        colors.cyan,
      );
    });
  }

  logSection("Summary");
  const allContractsDeployed = deploymentResults.every((r) => r.success);

  if (allContractsDeployed) {
    log("✓ All contracts deployed successfully!", colors.green);
  } else {
    const failed = deploymentResults.filter((r) => !r.success);
    log(`⚠ ${failed.length} contract(s) failed to deploy`, colors.yellow);
  }

  log("\n" + "─".repeat(50), colors.bright);
  log("Devnet is running with deployed contracts", colors.green);
  log("─".repeat(50), colors.bright);
  log(`\n  RPC: ${devnet.getRPCUrl()}`, colors.cyan);

  log("\nWallets:");
  allWallets.forEach((w, i) => {
    log(`  [${i}] ${w.label.padEnd(12)} ${w.address}`, colors.cyan);
  });

  log("\nDeployed Contracts:");
  if (allContractsDeployed) {
    const info = deployer.loadDeploymentInfo("devnet");
    if (info) {
      Object.entries(info.contracts).forEach(([name, contract]) => {
        log(
          `  ${name.padEnd(15)} ${contract.binaryHash.slice(0, 18)}...`,
          colors.cyan,
        );
      });
    }
  }

  log("\nPress Ctrl+C to stop\n");

  process.on("SIGINT", () => {
    log("\nStopping devnet...", colors.yellow);
    devnet.stop();
    log("Goodbye!", colors.green);
    process.exit(0);
  });

  setInterval(() => {}, 1000);
}

main().catch((err) => {
  log(`\n✗ Error: ${err.message}`, colors.red);
  console.error(err);
  process.exit(1);
});
