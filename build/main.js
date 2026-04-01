const path = require("path");
const fs = require("fs");

function getOffCKBPaths() {
  const isWindows = process.platform === "win32";
  const homeDir = process.env.HOME || process.env.USERPROFILE;

  if (isWindows) {
    return {
      configPath: path.join(homeDir, ".ckb-devnet"),
      dataPath: path.join(homeDir, ".ckb-devnet", "data"),
    };
  } else {
    return {
      configPath: path.join(homeDir, ".ckb-devnet"),
      dataPath: path.join(homeDir, ".ckb-devnet", "data"),
    };
  }
}

function getWalletInfo() {
  const walletPath = path.join(
    __dirname,
    "..",
    "deployments",
    "devnet-wallet",
    "wallet.json",
  );

  if (fs.existsSync(walletPath)) {
    const wallet = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
    return wallet;
  }

  return null;
}

function configureBlockAssembler() {
  const paths = getOffCKBPaths();
  const ckbConfigPath = path.join(paths.configPath, "ckb.toml");

  if (!fs.existsSync(ckbConfigPath)) {
    return {
      success: false,
      message: "ckb.toml not found",
    };
  }

  let config = fs.readFileSync(ckbConfigPath, "utf-8");

  const walletsPath = path.join(
    __dirname,
    "..",
    "deployments",
    "devnet-wallets",
    "wallets.json",
  );

  let wallet;
  if (fs.existsSync(walletsPath)) {
    const data = JSON.parse(fs.readFileSync(walletsPath, "utf-8"));
    if (data.wallets && data.wallets.length > 0) {
      wallet = data.wallets[0];
    }
  }

  if (!wallet) {
    return {
      success: false,
      message: "No wallet found",
    };
  }

  const argsWithoutPrefix = wallet.argsHash.slice(2);
  const blockAssemblerRegex =
    /(\[block_assembler\]\s+code_hash = ".*?"\s+args = ").*?"/;
  const newConfig = config.replace(
    blockAssemblerRegex,
    `$1${argsWithoutPrefix}"`,
  );

  if (newConfig !== config) {
    fs.writeFileSync(ckbConfigPath, newConfig);
    return {
      success: true,
      message: "Block assembler configured",
      argsHash: wallet.argsHash,
    };
  }

  return {
    success: true,
    message: "Already configured",
    argsHash: wallet.argsHash,
  };
}

module.exports = {
  getOffCKBPaths,
  getWalletInfo,
  configureBlockAssembler,
};
