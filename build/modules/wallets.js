require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bech32Lib = require("bech32");

const LOCK_CODE_HASH =
  process.env.LOCK_CODE_HASH ||
  "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8";
const LOCK_CODE_HASH_HEX = LOCK_CODE_HASH.slice(2);

const WALLETS_CONFIG = {
  count: 4,
  labels: ["treasury", "liquidity", "user1", "user2"],
  fundingAmount: 1000000000000n,
};

function generateCkbAddress(args, hrp = "ckt") {
  const argsHex = args.startsWith("0x") ? args.slice(2) : args;
  const argsBytes = Buffer.from(argsHex, "hex");

  const witnessVersion = Buffer.from([0x00]);
  const codeHashBytes = Buffer.from(LOCK_CODE_HASH_HEX, "hex");
  const hashTypeByte = Buffer.from([0x01]);

  const scriptData = Buffer.concat([
    witnessVersion,
    codeHashBytes,
    hashTypeByte,
    argsBytes,
  ]);

  const words = bech32Lib.bech32m.toWords(scriptData);
  return bech32Lib.bech32m.encode(hrp, words, 1023);
}

function generateWallet(label, network = "devnet") {
  const privateKeyBytes = crypto.randomBytes(32);
  const hash = crypto.createHash("sha256").update(privateKeyBytes).digest();
  const argsHash = "0x" + hash.toString("hex");
  const fullAddress = generateCkbAddress(argsHash);

  return {
    label,
    privateKey: "0x" + privateKeyBytes.toString("hex"),
    address: argsHash,
    fullAddress,
    argsHash: argsHash,
    lockScript: {
      codeHash: LOCK_CODE_HASH,
      hashType: "type",
      args: argsHash,
    },
    createdAt: new Date().toISOString(),
    network,
  };
}

function getOrCreateWallets(count = WALLETS_CONFIG.count) {
  const walletsDir = path.join(
    __dirname,
    "..",
    "..",
    "deployments",
    "devnet-wallets",
  );
  const walletsFile = path.join(walletsDir, "wallets.json");

  if (fs.existsSync(walletsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(walletsFile, "utf-8"));
      if (data.wallets && data.wallets.length >= count) {
        const wallets = data.wallets.slice(0, count);
        let updated = false;
        wallets.forEach((w) => {
          if (!w.fullAddress && w.argsHash) {
            w.fullAddress = generateCkbAddress(w.argsHash);
            updated = true;
          }
        });
        if (updated) {
          fs.writeFileSync(
            walletsFile,
            JSON.stringify({ wallets, createdAt: data.createdAt }, null, 2),
          );
        }
        return wallets;
      }
    } catch (e) {
      console.error("Error loading wallets:", e);
    }
  }

  fs.mkdirSync(walletsDir, { recursive: true });

  const wallets = [];
  for (let i = 0; i < count; i++) {
    const label = WALLETS_CONFIG.labels[i] || `wallet_${i}`;
    const wallet = generateWallet(label, "devnet");
    wallets.push(wallet);
  }

  fs.writeFileSync(
    walletsFile,
    JSON.stringify({ wallets, createdAt: new Date().toISOString() }, null, 2),
  );

  wallets.forEach((wallet) => {
    const walletFile = path.join(walletsDir, `${wallet.label}.json`);
    fs.writeFileSync(walletFile, JSON.stringify(wallet, null, 2));
  });

  return wallets;
}

function getWallet(identifier) {
  const wallets = getOrCreateWallets();

  if (typeof identifier === "number") {
    return wallets[identifier];
  }

  return wallets.find((w) => w.label === identifier);
}

function getWalletAddresses() {
  const wallets = getOrCreateWallets();
  return wallets.map((w) => w.address);
}

function getWalletsSummary() {
  const wallets = getOrCreateWallets();
  return wallets.map((w) => ({
    label: w.label,
    address: w.address,
    fullAddress: w.fullAddress,
    network: w.network,
  }));
}

module.exports = {
  generateWallet,
  getOrCreateWallets,
  getWallet,
  getWalletAddresses,
  getWalletsSummary,
  generateCkbAddress,
  WALLETS_CONFIG,
  LOCK_CODE_HASH,
};
