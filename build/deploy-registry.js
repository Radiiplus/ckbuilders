require("dotenv").config();

const { ccc } = require("../offckb/node_modules/@ckb-ccc/core");
const fs = require("fs");
const path = require("path");
const http = require("http");

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

function rpcRequest(method, params = []) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ id: 1, jsonrpc: "2.0", method, params });
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
        timeout: 10000,
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

async function deployRegistry() {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    colors.bright,
  );
  log(
    "║  ATHEON - Deploy Registry Contract                       ║",
    colors.bright,
  );
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    colors.bright,
  );

  try {
    const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
    const PRIVATE_KEY = process.env.CKB_GENESIS_PRIVKEY_0;

    if (!PRIVATE_KEY) {
      log("  ✗ Private key not found", colors.red);
      return;
    }

    
    const registryBinary = path.join(
      __dirname,
      "..",
      "contracts",
      "registry",
      "target",
      "riscv64imac-unknown-none-elf",
      "release",
      "dex-registry",
    );

    if (!fs.existsSync(registryBinary)) {
      log(`  ✗ Registry binary not found: ${registryBinary}`, colors.red);
      log(`  Run: cd contracts/registry && cargo build --release`, colors.cyan);
      return;
    }

    log("\n[Step 1/4] Connecting to RPC...", colors.blue);
    const tipBlock = await rpcRequest("get_tip_block_number");
    log(`  ✓ Connected (tip block: ${parseInt(tipBlock, 16)})`, colors.green);

    log("\n[Step 2/4] Reading registry binary...", colors.blue);
    const binary = fs.readFileSync(registryBinary);
    const binaryHash = ccc.hashCkb(binary);
    log(
      `  ✓ Binary size: ${(binary.length / 1024).toFixed(2)} KB`,
      colors.green,
    );
    log(
      `  ✓ Binary hash: 0x${ccc.hexFrom(binaryHash).slice(0, 18)}...`,
      colors.green,
    );

    log("\n[Step 3/4] Deploying registry cell...", colors.blue);

    
    const { SimpleTxBuilder } = require("../sdk");
    const txBuilder = new SimpleTxBuilder(RPC_URL);
    const lockScript = await txBuilder.getLockScript(PRIVATE_KEY);
    const utxos = [];
    let totalCapacity = 0n;

    for await (const cell of txBuilder.client.findCells(
      { script: lockScript, scriptType: "lock", scriptSearchMode: "exact" },
      "asc",
      5,
    )) {
      utxos.push(cell);
      totalCapacity += BigInt(cell.cellOutput.capacity);
      if (totalCapacity > BigInt(1000 * 1e8)) break; 
    }

    if (utxos.length === 0) {
      log("  ✗ No UTXOs found", colors.red);
      return;
    }

    
    const registryCell = {
      cellOutput: {
        capacity: BigInt(1000 * 1e8), 
        lock: lockScript,
        type: {
          codeHash: ccc.hashCkb(binary),
          hashType: "type",
        },
      },
      outputData: ccc.hexFrom(new Uint8Array()), 
    };

    
    const tx = {
      version: "0x00000000",
      cellDeps: [
        {
          outPoint: {
            txHash:
              "0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293",
            index: "0x0",
          },
          depType: "depGroup",
        },
      ],
      headerDeps: [],
      inputs: utxos.map((u) => ({
        previousOutput: u.outPoint,
        since: "0x0000000000000000",
      })),
      outputs: [registryCell.cellOutput],
      outputsData: [registryCell.outputData],
      witnesses: [],
    };

    
    const signer = new ccc.SignerCkbPrivateKey(txBuilder.client, PRIVATE_KEY);
    const preparedTx = await signer.prepareTransaction(tx);
    const signedTx = await signer.signTransaction(preparedTx);
    const txHash = await txBuilder.client.sendTransaction(signedTx);

    log(`  ✓ Registry deployed!`, colors.green);
    log(`    Transaction: ${txHash}`, colors.cyan);
    log(`    Type Script Hash: 0x${ccc.hexFrom(binaryHash)}`, colors.cyan);

    
    log("\n[Step 4/4] Waiting for confirmation...", colors.blue);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    
    const deploymentsFile = path.join(
      __dirname,
      "..",
      "deployments",
      "devnet-deployments.json",
    );
    let deployments = {
      network: "devnet",
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
      deployments = JSON.parse(fs.readFileSync(deploymentsFile, "utf-8"));
    }

    deployments.contracts.registry = {
      binaryHash: ccc.hexFrom(binaryHash),
      deploymentTxHash: txHash,
      typeScript: {
        codeHash: ccc.hexFrom(binaryHash),
        hashType: "type",
      },
    };

    fs.writeFileSync(deploymentsFile, JSON.stringify(deployments, null, 2));
    log(`  ✓ Deployments file updated`, colors.green);

    log(
      "\n╔═══════════════════════════════════════════════════════════╗",
      colors.green,
    );
    log(
      "║  ✓ Registry Contract Deployed!                           ║",
      colors.green,
    );
    log(
      "╚═══════════════════════════════════════════════════════════╝",
      colors.green,
    );

    return { txHash, binaryHash: ccc.hexFrom(binaryHash) };
  } catch (e) {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    process.exit(1);
  }
}

deployRegistry();
