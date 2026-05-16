

const fs = require("fs");
const path = require("path");
const http = require("http");









const SECP_CONFIG = {
  devnet: {
    
    txHash:
      "0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293",
    cellIndex: "0x0",
    depType: "dep_group",
    codeHash:
      "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
    hashType: "type",
  },
  testnet: {
    txHash:
      "0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37",
    cellIndex: "0x0",
    depType: "dep_group",
    codeHash:
      "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
    hashType: "type",
  },
};


function getSecpConfig(network = "devnet") {
  return SECP_CONFIG[network] || SECP_CONFIG.devnet;
}


function getSecpCellDepTxHash(network = "devnet") {
  return SECP_CONFIG[network]?.txHash || SECP_CONFIG.devnet.txHash;
}


function getSecpCodeHash(network = "devnet") {
  return SECP_CONFIG[network]?.codeHash || SECP_CONFIG.devnet.codeHash;
}


function getSecpHashType(network = "devnet") {
  return (
    SECP_CONFIG[network]?.hashType || SECP_CONFIG.devnet.hashType || "type"
  );
}


function getSecpTxOptions(network = "devnet") {
  const config = SECP_CONFIG[network] || SECP_CONFIG.devnet;
  return {
    secpCellDepTxHash: config.txHash,
    secpCellDepIndex: config.cellIndex || "0x0",
    secpDepType: config.depType || "dep_group",
    secpCodeHash: config.codeHash,
    secpHashType: config.hashType || "type",
  };
}

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






function rpcRequest(method, params = [], options = {}) {
  const { hostname = "127.0.0.1", port = 8114, timeout = 5000 } = options;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ id: 1, jsonrpc: "2.0", method, params });
    const req = http.request(
      {
        hostname,
        port,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const response = JSON.parse(data);
            if (response.error) reject(new Error(response.error.message));
            else resolve(response.result);
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






function getDeploymentInfo(network = "devnet") {
  const deploymentsFile = path.join(
    __dirname,
    "..",
    "..",
    "deployments",
    `${network}-deployments.json`,
  );
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(`Deployment file not found: ${deploymentsFile}`);
  }
  return JSON.parse(fs.readFileSync(deploymentsFile, "utf-8"));
}


function getContractInfo(contractName, network = "devnet") {
  const info = getDeploymentInfo(network);
  if (!info.contracts || !info.contracts[contractName]) {
    throw new Error(`Contract ${contractName} not found in deployment info`);
  }
  return info.contracts[contractName];
}


function getFactoryScriptHash(network = "devnet") {
  const info = getContractInfo("factory", network);
  return {
    scriptHash: info.typeScript.codeHash,
    deploymentTxHash: info.deploymentTxHash,
    binaryHash: info.binaryHash,
  };
}


function displayFactoryHash(result) {
  log("\n✓ Factory contract found!", colors.green);
  log("\n  Script Hash (Code Hash):", colors.cyan);
  log(`  ${result.scriptHash}`, colors.bright);
  log("\n  Deployment TX:", colors.cyan);
  log(`  ${result.deploymentTxHash}`, colors.cyan);
  log("\n  Binary Hash:", colors.cyan);
  log(`  ${result.binaryHash}`, colors.cyan);
  log("\n");
  console.log("--- Copy this value ---");
  console.log(result.scriptHash);
  console.log("-----------------------\n");
}






function findContributionReceipts(userAddress, launchId, deploymentsDir) {
  const dir = deploymentsDir || path.join(__dirname, "..", "..", "deployments");

  if (!fs.existsSync(dir)) return [];

  const receipts = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (file.startsWith("contribution-") && file.endsWith(".json")) {
      const filePath = path.join(dir, file);
      const receipt = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      if (receipt.launchId === launchId) {
        if (
          userAddress &&
          receipt.contributor &&
          receipt.contributor !== userAddress
        ) {
          continue;
        }
        receipts.push(receipt);
      }
    }
  }

  return receipts;
}


function saveContributionReceipt(receipt, txHash) {
  const dir = path.join(__dirname, "..", "..", "deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const file = path.join(dir, `contribution-${txHash.slice(2, 12)}.json`);
  fs.writeFileSync(file, JSON.stringify(receipt, null, 2));
  return file;
}





module.exports = {
  colors,
  log,
  rpcRequest,
  getDeploymentInfo,
  getContractInfo,
  getFactoryScriptHash,
  displayFactoryHash,
  findContributionReceipts,
  saveContributionReceipt,
  getSecpCellDepTxHash,
  getSecpCodeHash,
  getSecpHashType,
  getSecpConfig,
  getSecpTxOptions,
};
