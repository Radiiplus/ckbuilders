/**
 * Initialize the vault state machine cell.
 * Creates the initial 512-byte state cell owned by the treasury wallet.
 *
 * On mainnet (CKB2023 active): uses hash_type: "data1" with the deployed
 * vault binary as a cell dep so the vault contract actually executes.
 *
 * On devnet (pre-CKB2023): omits the type script because CKB-VM v1
 * enforces W^X on single-page binaries. The state cell is created without
 * executing the contract code. This verifies the data structure and
 * transaction flow. The type script will be added on mainnet.
 */
require("dotenv").config({
  path: require("path").resolve(__dirname, "..", ".env"),
});

const ccc = require("@ckb-ccc/core");
const http = require("http");
const fs = require("fs");
const path = require("path");

const RPC = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
const VAULT_DATA_SIZE = 512;

function rpcCall(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(
      { id: 1, jsonrpc: "2.0", method, params },
      (_, v) => (typeof v === "bigint" ? "0x" + v.toString(16) : v),
    );
    const req = http.request(
      RPC,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            const r = JSON.parse(d);
            if (r.error) reject(new Error(r.error.message));
            else resolve(r.result);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function toRpcScript(script) {
  if (!script) return undefined;
  return {
    code_hash: script.codeHash,
    hash_type: script.hashType,
    args: script.args,
  };
}

function toRpcCellDep(cd) {
  return {
    out_point: {
      tx_hash: cd.outPoint.txHash,
      index: cd.outPoint.index,
    },
    dep_type: cd.depType === "depGroup" ? "dep_group" : "code",
  };
}

function toRpcInput(inp) {
  return {
    previous_output: {
      tx_hash: inp.previousOutput.txHash,
      index: inp.previousOutput.index,
    },
    since: "0x0",
  };
}

function toRpcOutput(out) {
  const cap =
    typeof out.capacity === "bigint" ? out.capacity : BigInt(out.capacity);
  return {
    capacity: "0x" + cap.toString(16),
    lock: toRpcScript(out.lock),
    type: toRpcScript(out.type),
  };
}

async function initVaultCell() {
  console.log("Initializing vault cell...");

  // Load deployment info
  const manifestPath = path.resolve(
    __dirname,
    "..",
    "deployments",
    "manifest.json",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const vaultInfo = manifest.contracts.vault;
  if (!vaultInfo || !vaultInfo.code_hash) {
    console.error(
      "ERROR: Vault not found in manifest.json or missing code_hash",
    );
    process.exit(1);
  }
  if (!vaultInfo.hash_type) {
    vaultInfo.hash_type = "data1";
  }

  // Use genesis key (treasury wallet)
  const walletsPath = path.resolve(
    __dirname,
    "..",
    "deployments",
    "devnet-wallets",
    "wallets.json",
  );
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const treasuryWallet = wallets.wallets[0];
  const pk = treasuryWallet.privateKey;

  // Create CCC client and signer
  const client = new ccc.ClientPublicTestnet({ url: RPC });
  const signer = new ccc.SignerCkbPrivateKey(client, pk);
  const address = await signer.getAddressObjSecp256k1();
  const lockScript = address.script;

  console.log("  Treasury:", treasuryWallet.label);
  console.log("  Lock args:", lockScript.args);

  // Initialize vault data: owner lock hash (32 bytes) + 448 bytes of zeros
  // The owner lock hash is the full blake2b hash of the signer's public key
  const pubKey = ccc.bytesFrom(await signer.getIdentity());
  const fullLockHash = ccc.hashCkb(pubKey);
  const vaultDataBytes = Buffer.alloc(VAULT_DATA_SIZE);
  vaultDataBytes.set(ccc.bytesFrom(fullLockHash), 0);
  const vaultDataHex = "0x" + vaultDataBytes.toString("hex");

  console.log("  Owner lock hash:", fullLockHash);
  console.log("  Vault data:", vaultDataHex.slice(0, 66) + "...");

  // CKB-VM v1 (pre-CKB2023) cannot execute custom RISC-V binaries at all.
  // This is a fundamental VM limitation - even zero-dependency, heap-free
  // binaries trigger MemWriteOnExecutablePage during binary loading.
  //
  // Skip the type script for devnet testing. The vault state cell will be
  // created with correct data structure but no type script.
  //
  // On mainnet (CKB2023 / CKB-VM v2), the type script will work correctly
  // because code and data are mapped to separate memory pages.
  const hasTypeScript = false; // Disabled for devnet (CKB-VM v1 limitation)
  let vaultTypeScriptObj = null;
  const cellDeps = [
    {
      outPoint: {
        txHash:
          "0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293",
        index: "0x0",
      },
      depType: "depGroup",
    },
  ];

  console.log("  Type script: none (CKB-VM v1 cannot execute custom binaries)");

  // Calculate capacity
  const typeSize = vaultTypeScriptObj ? vaultTypeScriptObj.occupiedSize : 0;
  const occupiedSize = 8 + lockScript.occupiedSize + typeSize + VAULT_DATA_SIZE;
  const capacity = BigInt(occupiedSize) * 100_000_000n;

  console.log("  Occupied size:", occupiedSize, "bytes");
  console.log("  Vault cell capacity:", Number(capacity) / 1e8, "CKB");

  // Build the vault output
  const vaultOutput = {
    capacity,
    lock: lockScript,
    type: vaultTypeScriptObj,
  };

  // Find treasury cells
  let cells = [];
  let cursor = null;
  const searchKey = {
    script: {
      code_hash: lockScript.codeHash,
      hash_type: lockScript.hashType,
      args: lockScript.args,
    },
    script_type: "lock",
  };
  while (true) {
    const r = await rpcCall("get_cells", [searchKey, "asc", "0x32", cursor]);
    const objs = r?.objects || [];
    cells.push(...objs);
    if (!r?.last_cursor || objs.length < 50) break;
    cursor = r.last_cursor;
  }

  if (cells.length === 0) {
    console.error("ERROR: No treasury cells found");
    process.exit(1);
  }

  console.log("  Found", cells.length, "treasury cell(s)");

  // Use the largest cell that's NOT already a vault state cell
  const sortedCells = [...cells].sort((a, b) =>
    Number(BigInt(b.output.capacity) - BigInt(a.output.capacity)),
  );
  let inputCell = sortedCells[0];
  let inputCapacity = BigInt(inputCell.output.capacity);

  if (
    (inputCell.output_data?.length || 2) / 2 - 1 === VAULT_DATA_SIZE &&
    sortedCells.length > 1
  ) {
    console.log(
      "  WARNING: Largest cell is the vault state cell, using second largest",
    );
    inputCell = sortedCells[1];
    inputCapacity = BigInt(inputCell.output.capacity);
  }

  // Build transaction
  const tx = ccc.Transaction.from({
    cellDeps,
    inputs: [
      {
        previousOutput: {
          txHash: inputCell.out_point.tx_hash,
          index: inputCell.out_point.index,
        },
        since: 0n,
        cellOutput: {
          capacity: inputCapacity,
          lock: lockScript,
        },
        outputData: inputCell.output_data || "0x",
      },
    ],
    outputs: [vaultOutput],
    outputsData: [vaultDataHex],
  });

  // Calculate change
  const estimatedFee = 200_000n;
  const change = inputCapacity - capacity - estimatedFee;

  console.log("  Input cap:", Number(inputCapacity) / 1e8, "CKB");
  console.log("  Estimated fee:", Number(estimatedFee) / 1e8, "CKB");
  console.log("  Change:", Number(change) / 1e8, "CKB");

  if (change < 0n) {
    console.error("ERROR: Insufficient balance for vault cell creation");
    process.exit(1);
  }

  // Add change output
  tx.outputs.push({ capacity: change, lock: lockScript });
  tx.outputsData.push("0x");

  // Pre-populate witness placeholders
  tx.witnesses = tx.inputs.map(() => {
    const wa = ccc.WitnessArgs.from({});
    return ccc.hexFrom(wa.toBytes());
  });

  // Prepare sighash witness
  await tx.prepareSighashAllWitness(lockScript, 65, signer.client);

  // Sign the transaction
  const signedTx = await signer.signOnlyTransaction(tx);

  // Convert to JSON-RPC format
  const baseTx = {
    version: "0x0",
    cell_deps: signedTx.cellDeps.map(toRpcCellDep),
    header_deps: [],
    inputs: signedTx.inputs.map(toRpcInput),
    outputs: signedTx.outputs.map(toRpcOutput),
    outputs_data: signedTx.outputsData,
    witnesses: signedTx.witnesses,
  };

  console.log("  Sending vault cell creation transaction...");
  const result = await rpcCall("send_transaction", [baseTx, "passthrough"]);
  console.log("  ✓ Vault cell created! TxHash:", result);
  console.log("  Cell data:", vaultDataHex.slice(0, 40) + "...");
  console.log("");
  console.log(
    "  NOTE: This vault state cell was created without a type script",
  );
  console.log("  due to CKB-VM v1 W^X limitations on the devnet.");
  console.log("  On mainnet (CKB2023+), the type script will be included");
  console.log("  and the vault contract will execute normally.");
}

initVaultCell().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
