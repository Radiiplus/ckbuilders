require("dotenv").config({
  path: require("path").resolve(__dirname, "..", "..", ".env"),
});

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");
const http = require("http");

const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
const LOCK_CODE_HASH =
  process.env.LOCK_CODE_HASH ||
  "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8";
const DEPLOYER_PRIVKEY =
  process.env.DEPLOYER_PRIVKEY || process.env.CKB_GENESIS_PRIVKEY_0;

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

function getBinaryPath(contractName) {
  const baseDir = path.join(__dirname, "..", "..", "contracts", contractName);

  const binaryNames = {
    factory: "dex-factory",
    pool: "dex-pool",
    registry: "dex-registry",
    dex: "dex-instance",
    launchpad: "ohrex-launchpad",
  };
  const binaryName = binaryNames[contractName] || contractName;

  const linuxPath = path.join(
    baseDir,
    "target",
    "riscv64imac-unknown-none-elf",
    "release",
    binaryName,
  );
  if (fs.existsSync(linuxPath)) {
    return linuxPath;
  }

  const windowsPath = path.join(
    baseDir,
    "target-windows",
    "riscv64imac-unknown-none-elf",
    "release",
    binaryName,
  );
  if (fs.existsSync(windowsPath)) {
    return windowsPath;
  }

  const releasePath = path.join(baseDir, "target", "release", binaryName);
  if (fs.existsSync(releasePath)) {
    return releasePath;
  }

  return null;
}

function calculateBinaryHash(binaryPath) {
  const binary = fs.readFileSync(binaryPath);
  const hash = crypto.createHash("sha256").update(binary).digest();
  return "0x" + hash.toString("hex");
}

async function deployContract(contractName, deployerWallet) {
  console.log(`\nDeploying ${contractName}...`);

  const binaryPath = getBinaryPath(contractName);
  if (!binaryPath) {
    console.log(`  ✗ Binary not found for ${contractName}`);
    const binaryNames = {
      factory: "dex-factory",
      pool: "dex-pool",
      registry: "dex-registry",
      dex: "dex-instance",
      launchpad: "ohrex-launchpad",
    };
    const binaryName = binaryNames[contractName] || contractName;
    console.log(
      `    Expected at: target/riscv64imac-unknown-none-elf/release/${binaryName}`,
    );
    return {
      success: false,
      contractName,
      error: "Binary not found",
    };
  }

  console.log(`  Binary: ${binaryPath}`);

  const binaryHash = calculateBinaryHash(binaryPath);
  console.log(`  Hash: ${binaryHash}`);

  try {
    const tempDeployDir = path.join(
      __dirname,
      "..",
      "..",
      "deployments",
      "temp-deploy",
    );
    fs.mkdirSync(tempDeployDir, { recursive: true });

    const tempBinaryPath = path.join(tempDeployDir, contractName);
    fs.copyFileSync(binaryPath, tempBinaryPath);

    await sleep(2000);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = execSync(
          `cd "${tempDeployDir}" && npx offckb deploy --network devnet --target "${tempBinaryPath}" --privkey "${DEPLOYER_PRIVKEY}" -y 2>&1`,
          { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
        );

        console.log(`  ✓ ${contractName} deployed`);
        console.log(`  Output: ${result.trim().substring(0, 200)}`);

        const deployedInfo = parseDeploymentResult(result, binaryHash);

        try {
          fs.rmSync(tempDeployDir, { recursive: true, force: true });
        } catch (e) {}

        return {
          success: true,
          contractName,
          binaryPath,
          binaryHash,
          deploymentTxHash: deployedInfo.deploymentTxHash,
          ...deployedInfo,
        };
      } catch (e) {
        if (attempt === 3) {
          throw e;
        }
        console.log(`  Deployment attempt ${attempt} failed, retrying...`);
        await sleep(3000);
      }
    }
  } catch (e) {
    console.error(`  ✗ Deployment failed: ${e.message}`);
    return {
      success: false,
      contractName,
      binaryHash,
      error: e.message,
    };
  }
}

function parseDeploymentResult(output, binaryHash) {
  try {
    const txHashMatch = output.match(/0x([a-fA-F0-9]{64})/);
    if (txHashMatch) {
      return {
        deploymentTxHash: "0x" + txHashMatch[1],
        typeScript: {
          codeHash: binaryHash,
          hashType: "type",
        },
      };
    }
  } catch (e) {}

  return {
    deploymentTxHash: null,
    typeScript: {
      codeHash: binaryHash,
      hashType: "type",
    },
  };
}

async function deployAllContracts(wallet) {
  const contracts = ["factory", "pool", "registry", "dex", "launchpad"];
  const results = [];

  for (const contract of contracts) {
    const result = await deployContract(contract, wallet);
    results.push(result);

    if (!result.success) {
      console.log(
        `  ⚠️  ${contract} deployment skipped (binary not found - needs cargo build --release)`,
      );
    }
  }

  return results;
}

function saveDeploymentInfo(deployments, network = "devnet") {
  const deploymentsDir = path.join(__dirname, "..", "..", "deployments");
  const deploymentsFile = path.join(
    deploymentsDir,
    `${network}-deployments.json`,
  );

  fs.mkdirSync(deploymentsDir, { recursive: true });

  const depGroupTxHash =
    process.env.DEP_GROUP_TX_HASH ||
    "0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293";

  const info = {
    network,
    deployedAt: new Date().toISOString(),
    systemScripts: {
      secp256k1CodeHash:
        process.env.SECP256K1_CODE_HASH ||
        "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
      anyoneCanPayCodeHash:
        process.env.ANYONE_CAN_PAY_CODE_HASH ||
        "0x3419a1c09eb2567f6552ee7a8ecffd64155cffe40ac491e970acaa66e257d149",
      nervosDaoCodeHash:
        process.env.NERVOS_DAO_CODE_HASH ||
        "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
      depGroupTxHash,
    },
    contracts: deployments.reduce((acc, d) => {
      if (d.success) {
        acc[d.contractName] = {
          binaryHash: d.binaryHash,
          deploymentTxHash: d.deploymentTxHash,
          typeScript: d.typeScript,
        };
      }
      return acc;
    }, {}),
  };

  fs.writeFileSync(deploymentsFile, JSON.stringify(info, null, 2));
  console.log(`\n✓ Deployment info saved to ${deploymentsFile}`);

  return info;
}

function loadDeploymentInfo(network = "devnet") {
  const deploymentsFile = path.join(
    __dirname,
    "..",
    "..",
    "deployments",
    `${network}-deployments.json`,
  );

  if (fs.existsSync(deploymentsFile)) {
    try {
      return JSON.parse(fs.readFileSync(deploymentsFile, "utf-8"));
    } catch (e) {
      return null;
    }
  }

  return null;
}

function areContractsDeployed(network = "devnet") {
  const info = loadDeploymentInfo(network);
  if (!info || !info.contracts) {
    return false;
  }

  const requiredContracts = ["factory", "pool", "registry", "dex", "launchpad"];
  return requiredContracts.every((c) => info.contracts[c] !== undefined);
}

function getContractInfo(contractName, network = "devnet") {
  const info = loadDeploymentInfo(network);
  if (!info || !info.contracts) {
    return null;
  }

  return info.contracts[contractName] || null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  rpcRequest,
  getBinaryPath,
  calculateBinaryHash,
  deployContract,
  deployAllContracts,
  saveDeploymentInfo,
  loadDeploymentInfo,
  areContractsDeployed,
  getContractInfo,
  LOCK_CODE_HASH,
};
