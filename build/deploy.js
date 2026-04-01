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
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function main() {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  ATHEON Protocol - Contract Deployment                    ║",
    colors.bright,
  );
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    colors.bright,
  );

  log("Checking devnet status...", colors.blue);
  if (!(await devnet.checkRPC())) {
    log("Devnet is not running. Starting devnet...", colors.blue);
    await devnet.start();
    await devnet.waitForRPC(30);
    log("✓ Devnet is ready", colors.green);
  } else {
    log("✓ Devnet is running", colors.green);
  }

  log("\nLoading wallets...", colors.blue);
  const allWallets = wallets.getOrCreateWallets(4);
  log(`✓ Loaded ${allWallets.length} wallets`, colors.green);

  log("\nChecking wallet balances...", colors.blue);
  const fundingStatus = await faucet.checkWalletsFunded(allWallets);

  let needsFunding = false;
  fundingStatus.forEach((status) => {
    const ckbBalance = (BigInt(status.balance) / 100000000n).toString();
    if (status.isFunded) {
      log(`  ✓ ${status.label.padEnd(12)} ${ckbBalance} CKB`, colors.green);
    } else {
      log(
        `  ✗ ${status.label.padEnd(12)} ${ckbBalance} CKB (needs funding)`,
        colors.yellow,
      );
      needsFunding = true;
    }
  });

  if (needsFunding) {
    log("\nFunding wallets...", colors.blue);
    const fundingAmount = BigInt(wallets.WALLETS_CONFIG.fundingAmount);
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
  }

  log("\nDeploying contracts...", colors.blue);
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

  const successfulDeployments = deploymentResults.filter((r) => r.success);
  if (successfulDeployments.length > 0) {
    deployer.saveDeploymentInfo(successfulDeployments, "devnet");
    log("\n✓ Deployment info saved", colors.green);
  }

  log("\n" + "─".repeat(50), colors.bright);
  const allContractsDeployed = deploymentResults.every((r) => r.success);

  if (allContractsDeployed) {
    log("✓ All contracts deployed successfully!", colors.green);
  } else {
    const failed = deploymentResults.filter((r) => !r.success);
    log(`⚠ ${failed.length} contract(s) failed to deploy`, colors.yellow);
  }

  log("─".repeat(50), colors.bright);

  process.exit(allContractsDeployed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
