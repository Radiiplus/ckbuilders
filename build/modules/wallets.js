require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bech32Lib = require("bech32");
const { secp256k1 } = require("@noble/curves/secp256k1");
const { ccc } = require("@ckb-ccc/core");

// CKB address derivation: blake2b-256 with CKB personalization, truncated to 20 bytes
// This matches CCC's ccc.hashCkb() and the on-chain secp256k1 lock script derivation
// Note: This is NOT blake2b with dkLen=20 — ccc.hashCkb is blake2b-256, then truncated
const LOCK_CODE_HASH =
  process.env.LOCK_CODE_HASH ||
  "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8";
const LOCK_CODE_HASH_HEX = LOCK_CODE_HASH.slice(2);

const WALLETS_CONFIG = {
  count: 4,
  labels: ["treasury", "liquidity", "user1", "user2"],
  fundingAmount: 1000000000000n,
  // Frontend wallet: known private key that matches public/src/config.ts
  frontendPrivateKey:
    "0x5d45fdd4aaa40cf4f04ce7950c6df8716f62f8f5206f6baf3bf504c62c6589f1",
};

/** Generate wallet from a known private key (for frontend wallet) */
function createWalletFromKey(privateKeyHex, label, network = "devnet") {
  const pkBytes = Buffer.from(
    privateKeyHex.startsWith("0x") ? privateKeyHex.slice(2) : privateKeyHex,
    "hex",
  );

  const pubKeyBytes = secp256k1.getPublicKey(pkBytes, true);
  // Correct CKB derivation: ccc.hashCkb (blake2b-256 + CKB personalization) truncated to 20 bytes
  const args = ccc.hashCkb(pubKeyBytes).slice(0, 42);
  const fullAddress = generateCkbAddress(args);

  return {
    label,
    privateKey: privateKeyHex.startsWith("0x")
      ? privateKeyHex
      : "0x" + privateKeyHex,
    address: args,
    fullAddress,
    argsHash: args,
    lockScript: {
      codeHash: LOCK_CODE_HASH,
      hashType: "type",
      args,
    },
    createdAt: new Date().toISOString(),
    network,
  };
}

function getFrontendWallet(network = "devnet") {
  return createWalletFromKey(
    WALLETS_CONFIG.frontendPrivateKey,
    "frontend",
    network,
  );
}

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
  const privateKeyHex = "0x" + privateKeyBytes.toString("hex");

  // CKB-standard address: ccc.hashCkb (blake2b-256 + CKB personalization) truncated to 20 bytes
  const pubKeyBytes = secp256k1.getPublicKey(privateKeyBytes, true);
  const args = ccc.hashCkb(pubKeyBytes).slice(0, 42);
  const fullAddress = generateCkbAddress(args);

  return {
    label,
    privateKey: privateKeyHex,
    address: args,
    fullAddress,
    argsHash: args,
    lockScript: {
      codeHash: LOCK_CODE_HASH,
      hashType: "type",
      args,
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
  createWalletFromKey,
  getFrontendWallet,
  WALLETS_CONFIG,
  LOCK_CODE_HASH,
};
