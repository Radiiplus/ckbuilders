require("dotenv").config({
  path: require("path").resolve(__dirname, "..", ".env"),
});

const { ccc } = require("@ckb-ccc/core");
const { SimpleClient } = require("../../sdk");
const { getSecpCellDepTxHash } = require("../utils/cli-helpers");

const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
const PRIVATE_KEY = process.env.CKB_GENESIS_PRIVKEY_0;
const SECP_HASH = getSecpCellDepTxHash("devnet");

console.log("=== DEBUG TX BUILDING ===");

(async () => {
  try {
    const client = new SimpleClient(RPC_URL, { secpCellDepTxHash: SECP_HASH });
    console.log("1. Client created");

    
    const lockScriptInfo = await client.getKnownScript(
      ccc.KnownScript.Secp256k1Blake160,
    );
    const lockScript = {
      code_hash: lockScriptInfo.codeHash,
      hash_type: lockScriptInfo.hashType,
      args: "0x",
    };
    console.log("2. Lock script:", JSON.stringify(lockScript));

    
    console.log("3. Finding UTXOs...");
    const utxos = [];
    let totalCapacity = 0n;
    for await (const cell of client.findCells(
      { script: lockScript, scriptType: "lock", scriptSearchMode: "exact" },
      "asc",
      5,
    )) {
      utxos.push(cell);
      totalCapacity += BigInt(cell.cellOutput.capacity);
      if (totalCapacity >= 10000000000n) break;
    }
    console.log("   Found", utxos.length, "UTXOs");

    if (utxos.length === 0) {
      console.log("No UTXOs!");
      return;
    }

    
    const inputs = utxos.map((u) => ({
      previous_output: { tx_hash: u.outPoint.txHash, index: u.outPoint.index },
      since: "0x0000000000000000",
    }));

    
    const outputs = [{ lock: lockScript, capacity: 100000000n }];
    const outputs_data = ["0x"];

    
    const cell_deps = [
      {
        out_point: { tx_hash: SECP_HASH, index: "0x0" },
        dep_type: "dep_group",
      },
    ];

    
    console.log("4. Building tx with snake_case...");
    const txRaw = {
      version: "0x00000000",
      cell_deps,
      header_deps: [],
      inputs,
      outputs,
      outputs_data,
      witnesses: [],
    };
    console.log("   txRaw:", JSON.stringify(txRaw, null, 2).slice(0, 400));

    console.log("5. ccc.Transaction.from...");
    const tx = ccc.Transaction.from(txRaw);
    console.log("   tx created");
    console.log(
      "   tx.toJSON().cell_deps:",
      JSON.stringify(tx.toJSON()?.cell_deps),
    );

    console.log("6. Signing...");
    const signer = new ccc.SignerCkbPrivateKey(client, PRIVATE_KEY);
    const signed = await signer.signOnlyTransaction(tx);
    console.log("   signed OK");
    const hash = signed.hash?.();
    console.log("   tx hash:", hash?.slice(0, 30) + "...");

    console.log("\n=== SUCCESS ===");
  } catch (e) {
    console.log("\nFATAL:", e.message);
    console.log(e.stack?.split("\n").slice(0, 8).join("\n"));
  }
})();
