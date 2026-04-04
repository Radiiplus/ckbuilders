require("dotenv").config({
  path: require("path").resolve(__dirname, "..", ".env"),
});

const { ccc } = require("@ckb-ccc/core");
const { SimpleClient, SimpleTxBuilder } = require("../../sdk");
const {
  getSecpTxOptions,
  log,
  colors,
  rpcRequest,
} = require("../utils/cli-helpers");

const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
const PRIVATE_KEY = process.env.CKB_GENESIS_PRIVKEY_0;
const secpOpts = getSecpTxOptions("devnet");

console.log("=== RBF TRACE ===");
console.log("RPC:", RPC_URL);

(async () => {
  try {
    const client = new SimpleClient(RPC_URL, secpOpts);
    const txBuilder = new SimpleTxBuilder(RPC_URL, secpOpts);

    
    const lockScript = await txBuilder.getLockScript(PRIVATE_KEY);
    console.log("\n1. Lock script args:", lockScript.args);

    
    console.log("\n2. Finding UTXOs...");
    const utxos = [];
    let totalCapacity = 0n;
    for await (const cell of client.findCells(
      { script: lockScript, scriptType: "lock", scriptSearchMode: "exact" },
      "asc",
      20,
    )) {
      utxos.push(cell);
      totalCapacity += BigInt(cell.cellOutput.capacity);
      console.log(
        `   Cell: ${cell.outPoint?.txHash?.slice(0, 18)}... index:${cell.outPoint?.index} cap:${BigInt(cell.cellOutput.capacity) / 100000000n} CKB`,
      );
    }
    console.log(
      `   Total: ${utxos.length} cells, ${totalCapacity / 100000000n} CKB`,
    );

    
    console.log("\n3. Checking tx pool via raw RPC...");
    try {
      const poolInfo = await rpcRequest("get_tx_pool_info");
      console.log("   Pool info:", JSON.stringify(poolInfo, null, 2));
    } catch (e) {
      console.log("   get_tx_pool_info failed:", e.message);
    }

    
    console.log("\n4. Checking pending transactions...");
    try {
      const result = await rpcRequest("get_tx_pool_info");
      console.log("   Pending txs in pool:", result?.pending_count || 0);
      console.log("   Proposed txs in pool:", result?.proposed_count || 0);
      console.log(
        "   Total txs:",
        (result?.pending_count || 0) + (result?.proposed_count || 0),
      );
    } catch (e) {
      console.log("   Error:", e.message);
    }

    
    console.log("\n5. Attempting test transaction...");
    const outputs = [{ lock: lockScript, capacity: 100000000n }]; 
    const outputsData = ["0x"];

    try {
      const result = await txBuilder.buildAndSendWithRbfRetry(
        outputs,
        outputsData,
        PRIVATE_KEY,
        3000,
        [],
        3,
      );
      console.log("   ✓ Transaction sent:", result.txHash);
    } catch (e) {
      console.log("   ✗ Error:", e.message);
      console.log("   Full error:", JSON.stringify(e, null, 2));
    }

    
    console.log("\n6. Checking tip block...");
    const tipBlock = await rpcRequest("get_tip_block_number");
    console.log("   Tip block:", parseInt(tipBlock, 16));
  } catch (e) {
    console.log("\nFATAL:", e.message);
    console.log(e.stack?.split("\n").slice(0, 10).join("\n"));
  }
})();
