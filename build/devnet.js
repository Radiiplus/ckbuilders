require("dotenv").config();

const devnet = require("./modules/devnet");
const wallets = require("./modules/wallets");
const faucet = require("./modules/faucet");

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
    "║  ATHEON Protocol - Devnet Setup                           ║",
    colors.bright,
  );
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    colors.bright,
  );

  log("Stopping existing processes...", colors.blue);
  devnet.stop();
  await devnet.sleep(2000);

  log("\nStarting devnet...", colors.blue);
  await devnet.start();

  log("Waiting for RPC...", colors.blue);
  if (!(await devnet.waitForRPC(30))) {
    log("✗ Devnet failed to start", colors.red);
    process.exit(1);
  }
  log("✓ Devnet is ready", colors.green);
  log(`  RPC: ${devnet.getRPCUrl()}`, colors.cyan);

  log("\nSetting up wallets...", colors.blue);
  const allWallets = wallets.getOrCreateWallets(4);
  log(`✓ Created ${allWallets.length} wallets`, colors.green);

  allWallets.forEach((w, i) => {
    log(`  [${i}] ${w.label.padEnd(12)} ${w.address}`, colors.cyan);
  });

  log("\nFunding wallets...", colors.blue);
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

  log("\n" + "─".repeat(50), colors.bright);
  log("Devnet is running", colors.green);
  log("─".repeat(50), colors.bright);
  log(`\n  RPC: ${devnet.getRPCUrl()}`, colors.cyan);

  log("\nWallets:");
  allWallets.forEach((w, i) => {
    log(`  [${i}] ${w.label.padEnd(12)} ${w.address}`, colors.cyan);
  });

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
