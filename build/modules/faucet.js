require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const http = require("http");
const { execSync } = require("child_process");

const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";

const GENESIS_ACCOUNTS = [
  {
    address:
      process.env.CKB_GENESIS_ADDRESS_0 ||
      "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqvwg2cen8extgq8s5puft8vf40px3f599cytcyd8",
    privkey:
      process.env.CKB_GENESIS_PRIVKEY_0 ||
      "0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6",
  },
  {
    address:
      process.env.CKB_GENESIS_ADDRESS_1 ||
      "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew",
    privkey:
      process.env.CKB_GENESIS_PRIVKEY_1 ||
      "0x9f315d5a9618a39fdc487c7a67a8581d40b045bd7a42d83648ca80ef3b2cb4a1",
  },
];

function rpcRequest(method, params = []) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method,
      params,
    });

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 8114,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": postData.length,
        },
        timeout: 5000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const response = JSON.parse(data);
            if (response.error) {
              reject(
                new Error(
                  response.error.message || JSON.stringify(response.error),
                ),
              );
            } else {
              resolve(response.result);
            }
          } catch (e) {
            reject(e);
          }
        });
      },
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("RPC timeout"));
    });
    req.write(postData);
    req.end();
  });
}

async function getBalance(address, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = execSync(
        `npx offckb balance ${address} --network devnet 2>&1`,
        { encoding: "utf-8", timeout: 30000 },
      );

      // Try multiple regex patterns to match different offckb output formats
      const match =
        result.match(/Balance:\s*([\d.]+)\s*CKB/i) ||
        result.match(/([\d.]+)\s*CKB/) ||
        result.match(/total:\s*([\d.]+)/i);

      if (match) {
        const ckbAmount = parseFloat(match[1]);
        if (!isNaN(ckbAmount)) {
          return BigInt(Math.floor(ckbAmount * 100000000));
        }
      }

      // Log the raw output for debugging if parsing fails
      if (i === 0) {
        console.log(`  [DEBUG] Balance output: ${result.trim().slice(0, 200)}`);
      }

      return 0n;
    } catch (e) {
      if (i === 0) {
        console.log(`  [DEBUG] Balance command error: ${e.message}`);
      }
      if (i === retries - 1) {
        console.error("Error getting balance:", e.message);
        return 0n;
      }
      await sleep(1000);
    }
  }
  return 0n;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fundWallet(address, fullAddress, amount, timeout = 120000) {
  console.log(`  Funding ${address}...`);

  const addressToUse = fullAddress || address;

  const currentBalance = await getBalance(addressToUse);
  const targetBalance = currentBalance + BigInt(amount);

  const currentCKB = (currentBalance / 100000000n).toString();
  const targetCKB = (targetBalance / 100000000n).toString();

  console.log(`  Current balance: ${currentCKB} CKB`);
  console.log(`  Target balance: ${targetCKB} CKB`);

  const amountNeeded = targetBalance - currentBalance;
  const amountNeededCKB = (amountNeeded / 100000000n).toString();

  if (amountNeeded <= 0n) {
    console.log(`  ✓ Already funded`);
    return { success: true, balance: currentBalance.toString() };
  }
  console.log(`  Depositing ${amountNeededCKB} CKB from devnet genesis...`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Use offckb transfer with genesis key - more reliable than deposit
      // which has race conditions with rapid successive calls
      const transferOutput = execSync(
        `npx offckb transfer --network devnet --privkey 0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6 ${addressToUse} ${amountNeededCKB}`,
        { encoding: "utf-8", timeout, stdio: ["pipe", "pipe", "pipe"] },
      );
      console.log(`  Transfer output: ${transferOutput.trim().slice(0, 100)}`);

      // Wait for the transaction to be confirmed
      // offckb devnet auto-mines, but we need to poll for confirmation
      let confirmed = false;
      for (let i = 0; i < 10; i++) {
        await sleep(2000);
        const finalBalance = await getBalance(addressToUse);
        if (finalBalance >= targetBalance) {
          console.log(
            `  Final balance: ${(finalBalance / 100000000n).toString()} CKB`,
          );
          return { success: true, balance: finalBalance.toString() };
        }
      }

      const finalBalance = await getBalance(addressToUse);
      throw new Error(
        `Balance insufficient after deposit: ${finalBalance} < ${targetBalance}`,
      );
    } catch (e) {
      if (attempt === 3) {
        console.error(`  ✗ Deposit failed after 3 attempts: ${e.message}`);
        const finalBalance = await getBalance(addressToUse);
        return {
          success: false,
          error: e.message,
          balance: finalBalance.toString(),
        };
      }
      console.log(`  Deposit attempt ${attempt} failed, retrying...`);
      await sleep(5000);
    }
  }
}

function getBlockAssemblerAddress() {
  try {
    const walletPath = require("path").join(
      __dirname,
      "..",
      "..",
      "deployments",
      "devnet-wallet",
      "wallet.json",
    );
    const fs = require("fs");
    if (fs.existsSync(walletPath)) {
      const wallet = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
      return wallet.argsHash;
    }
  } catch (e) {}

  const walletsPath = require("path").join(
    __dirname,
    "..",
    "..",
    "deployments",
    "devnet-wallets",
    "wallets.json",
  );
  const fs = require("fs");
  if (fs.existsSync(walletsPath)) {
    const data = JSON.parse(fs.readFileSync(walletsPath, "utf-8"));
    if (data.wallets && data.wallets.length > 0) {
      return data.wallets[0].address;
    }
  }

  return null;
}

async function transferToAddress(toAddress, amount) {
  console.log(
    `  Depositing ${(amount / 100000000n).toString()} CKB to ${toAddress.slice(0, 10)}...`,
  );

  try {
    const amountCKB = (amount / 100000000n).toString();
    execSync(
      `npx offckb deposit --network devnet ${toAddress} ${amountCKB} 2>&1`,
      {
        stdio: "pipe",
      },
    );
    console.log("  Deposit complete");
  } catch (e) {
    console.error("  Deposit failed:", e.message);
  }
}

async function fundWallets(wallets, amountPerWallet) {
  const results = [];

  for (const wallet of wallets) {
    try {
      const result = await fundWallet(
        wallet.address,
        wallet.fullAddress,
        amountPerWallet,
      );
      results.push({
        label: wallet.label,
        address: wallet.address,
        balance: result.balance,
        success: result.success,
        error: result.error,
      });
      // Add delay between wallet funding to prevent race conditions
      await sleep(2000);
    } catch (e) {
      results.push({
        label: wallet.label,
        address: wallet.address,
        error: e.message,
        success: false,
      });
    }
  }

  return results;
}

async function checkWalletsFunded(wallets, minAmount = 100000000000n) {
  const results = [];

  for (const wallet of wallets) {
    const balance = await getBalance(wallet.address);
    results.push({
      label: wallet.label,
      address: wallet.address,
      balance: balance.toString(),
      isFunded: balance >= minAmount,
    });
  }

  return results;
}

module.exports = {
  rpcRequest,
  getBalance,
  fundWallet,
  fundWallets,
  checkWalletsFunded,
  waitForBlocks: async (n) => {
    // In offckb devnet, blocks are auto-mined when transactions are submitted
    // Just wait for the blockchain to process
    await sleep(n * 2000);
  },
  getBlockAssemblerAddress,
  sleep,
  GENESIS_ACCOUNTS,
};
