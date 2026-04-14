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
    vault: "ohrex-vault",
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
  const ccc = require("@ckb-ccc/core");
  const binary = fs.readFileSync(binaryPath);
  // Use blake2b-256 with CKB personalization (same as CKB VM uses for data1 lookups)
  return ccc.hashCkb(binary);
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
      vault: "ohrex-vault",
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
          `cd "${tempDeployDir}" && npx offckb deploy --network devnet --target "${tempBinaryPath}" --privkey "${DEPLOYER_PRIVKEY}" --type-id -y 2>&1`,
          { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
        );

        console.log(`  ✓ ${contractName} deployed`);
        console.log(`  Output: ${result.trim().substring(0, 200)}`);

        const deployedInfo = parseDeploymentResult(
          result,
          binaryHash,
          tempDeployDir,
        );

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

function computeTypeIdArgs(txHash, index) {
  const { blake2b } = require("@noble/hashes/blake2.js");
  const txBytes = Buffer.from(txHash.slice(2), "hex");
  const indexBytes = Buffer.from([parseInt(index, 16)]);
  const input = Buffer.concat([txBytes, indexBytes]);
  const hash = blake2b(input, { dkLen: 32 });
  return "0x" + Buffer.from(hash).toString("hex").slice(0, 40);
}

function parseDeploymentResult(output, binaryHash, tempDeployDir) {
  try {
    // Try to read the migration JSON that offckb saves to get tx_hash and index
    const migrationsDir = path.join(tempDeployDir, "deployment", "devnet");

    let txHash = null;
    let index = "0x0";

    // Find the latest migration JSON file
    if (fs.existsSync(migrationsDir)) {
      const contractDirs = fs.readdirSync(migrationsDir);
      for (const contractDir of contractDirs) {
        const migrationsPath = path.join(
          migrationsDir,
          contractDir,
          "migrations",
        );
        if (fs.existsSync(migrationsPath)) {
          const migrationFiles = fs
            .readdirSync(migrationsPath)
            .filter((f) => f.endsWith(".json"))
            .sort()
            .reverse();
          if (migrationFiles.length > 0) {
            const migrationData = JSON.parse(
              fs.readFileSync(
                path.join(migrationsPath, migrationFiles[0]),
                "utf-8",
              ),
            );
            if (
              migrationData.cell_recipes &&
              migrationData.cell_recipes.length > 0
            ) {
              txHash = migrationData.cell_recipes[0].tx_hash;
              index = "0x" + migrationData.cell_recipes[0].index.toString(16);
              break;
            }
          }
        }
      }
    }

    // Fallback: extract tx hash from output text
    if (!txHash) {
      const txHashMatch = output.match(/tx hash:\s*(0x[a-fA-F0-9]{64})/);
      if (txHashMatch) {
        txHash = txHashMatch[1];
      }
    }

    // Compute Type ID from outpoint
    const typeId = txHash ? computeTypeIdArgs(txHash, index) : null;

    const result = {
      deploymentTxHash: txHash,
      typeId,
      typeScript: {
        codeHash: binaryHash,
        hashType: "type",
      },
    };

    return result;
  } catch (e) {
    console.error(`  ⚠ Failed to parse deployment result: ${e.message}`);
  }

  return {
    deploymentTxHash: null,
    typeId: null,
    typeScript: {
      codeHash: binaryHash,
      hashType: "type",
    },
  };
}

async function deployAllContracts(wallet) {
  const contracts = [
    "factory",
    "pool",
    "registry",
    "dex",
    "launchpad",
    "vault",
  ];
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
  fs.mkdirSync(deploymentsDir, { recursive: true });

  // --- Save manifest.json (the file the UI reads) ---
  const manifestFile = path.join(deploymentsDir, "manifest.json");
  let existingManifest = { network, contracts: {} };
  if (fs.existsSync(manifestFile)) {
    try {
      existingManifest = JSON.parse(fs.readFileSync(manifestFile, "utf-8"));
      existingManifest.network = network;
    } catch (e) {
      existingManifest = { network, contracts: {} };
    }
  }
  deployments.forEach((d) => {
    if (d.success) {
      existingManifest.contracts[d.contractName] = {
        type_id: d.typeId || null,
        code_hash: d.binaryHash,
        deployed_at: new Date().toISOString(),
        tx_hash: d.deploymentTxHash || null,
        index: d.typeScript?.args || null,
      };
    }
  });
  fs.writeFileSync(manifestFile, JSON.stringify(existingManifest, null, 2));
  console.log(`\n✓ Deployment manifest saved to ${manifestFile}`);

  // --- Save devnet-deployments.json (the file the server reads) ---
  const deploymentsFile = path.join(deploymentsDir, "devnet-deployments.json");
  let existingDeployments = {
    network,
    deployedAt: new Date().toISOString(),
    systemScripts: {
      secp256k1CodeHash:
        "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
      anyoneCanPayCodeHash:
        "0x3419a1c09eb2567f6552ee7a8ecffd64155cffe40ac491e970acaa66e257d149",
      nervosDaoCodeHash:
        "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
      depGroupTxHash:
        "0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293",
    },
    contracts: {},
  };
  if (fs.existsSync(deploymentsFile)) {
    try {
      existingDeployments = JSON.parse(
        fs.readFileSync(deploymentsFile, "utf-8"),
      );
      existingDeployments.network = network;
      existingDeployments.deployedAt = new Date().toISOString();
    } catch (e) {
      // corrupt – start fresh
    }
  }
  deployments.forEach((d) => {
    if (d.success) {
      existingDeployments.contracts[d.contractName] = {
        type_id: d.typeId || null,
        code_hash: d.binaryHash,
        deployed_at: new Date().toISOString(),
      };
    }
  });
  fs.writeFileSync(
    deploymentsFile,
    JSON.stringify(existingDeployments, null, 2),
  );
  console.log(`✓ Deployments saved to ${deploymentsFile}`);

  return existingManifest;
}

function loadDeploymentInfo(network = "devnet") {
  const deploymentsDir = path.join(__dirname, "..", "..", "deployments");
  const deploymentsFile = path.join(deploymentsDir, "manifest.json");

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

  const requiredContracts = [
    "factory",
    "pool",
    "registry",
    "dex",
    "launchpad",
    "vault",
  ];
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
