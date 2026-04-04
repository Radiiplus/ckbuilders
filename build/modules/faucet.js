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

      const match = result.match(/Balance:\s*([\d.]+)\s*CKB/i);
      if (match) {
        const ckbAmount = parseFloat(match[1]);
        return BigInt(Math.floor(ckbAmount * 100000000));
      }

      return 0n;
    } catch (e) {
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
    return currentBalance;
  }

  const GENESIS_PRIVKEY = GENESIS_ACCOUNTS[0].privkey;

  console.log(`  Transferring ${amountNeededCKB} CKB from genesis account...`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      execSync(
        `npx offckb transfer --network devnet --privkey ${GENESIS_PRIVKEY} ${addressToUse} ${amountNeededCKB} 2>&1`,
        { encoding: "utf-8", timeout },
      );

      await sleep(1000);
      await rpcRequest("generate_block", []);
      await sleep(1000);

      const finalBalance = await getBalance(addressToUse);
      console.log(
        `  Final balance: ${(finalBalance / 100000000n).toString()} CKB`,
      );

      return finalBalance;
    } catch (e) {
      if (attempt === 3) {
        console.error(`  Transfer failed after 3 attempts: ${e.message}`);
        throw e;
      }
      console.log(`  Transfer attempt ${attempt} failed, retrying...`);
      await sleep(3000);
      try {
        await rpcRequest("generate_block", []);
      } catch (_) {}
      await sleep(1000);
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
  const GENESIS_PRIVKEY = GENESIS_ACCOUNTS[0].privkey;

  console.log(
    `  Transferring ${(amount / 100000000n).toString()} CKB from genesis account to ${toAddress.slice(0, 10)}...`,
  );

  try {
    const amountCKB = (amount / 100000000n).toString();
    execSync(
      `npx offckb transfer --network devnet --privkey ${GENESIS_PRIVKEY} ${toAddress} ${amountCKB} 2>&1`,
      {
        stdio: "pipe",
      },
    );
    console.log("  Transfer complete");
  } catch (e) {
    console.error("  Transfer failed:", e.message);
    console.log("  Mining additional blocks...");
    await rpcRequest("generate_block", []);
    await sleep(1000);
  }
}

async function fundWallets(wallets, amountPerWallet) {
  const results = [];

  for (const wallet of wallets) {
    try {
      const balance = await fundWallet(
        wallet.address,
        wallet.fullAddress,
        amountPerWallet,
      );
      results.push({
        label: wallet.label,
        address: wallet.address,
        balance: balance.toString(),
        success: true,
      });
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
    for (let i = 0; i < n; i++) {
      await rpcRequest("generate_block", []);
      await sleep(1000);
    }
  },
  getBlockAssemblerAddress,
  sleep,
  GENESIS_ACCOUNTS,
};
