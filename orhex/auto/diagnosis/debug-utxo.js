require("dotenv").config({
  path: require("path").resolve(__dirname, "..", ".env"),
});

const { ccc } = require("@ckb-ccc/core");
const { SimpleClient } = require("../../sdk");
const { getSecpTxOptions } = require("../utils/cli-helpers");

const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
const PRIVATE_KEY = process.env.CKB_GENESIS_PRIVKEY_0;
const secpOpts = getSecpTxOptions("devnet");

console.log("=== DEBUG UTXO SEARCH ===");
console.log("RPC:", RPC_URL);
console.log("secpOpts:", JSON.stringify(secpOpts));

(async () => {
  try {
    const client = new SimpleClient(RPC_URL, secpOpts);

    
    console.log("\n1. Getting lock script...");
    const lockScript = await client.getKnownScript(
      ccc.KnownScript.Secp256k1Blake160,
    );
    console.log("   lockScript:", JSON.stringify(lockScript, null, 2));

    
    console.log("\n2. Getting address from private key...");
    const signer = new ccc.SignerCkbPrivateKey(client, PRIVATE_KEY);
    const pubKey = signer.publicKey;
    console.log("   pubKey:", pubKey);
    const pubKeyHash = ccc.hexFrom(
      ccc.hashCkb(ccc.bytesFrom(pubKey)).slice(0, 20),
    );
    console.log("   pubKeyHash:", pubKeyHash);

    
    const lockScriptManual = {
      code_hash: secpOpts.secpCodeHash,
      hash_type: secpOpts.secpHashType,
      args: pubKeyHash,
    };
    console.log("   lockScriptManual:", JSON.stringify(lockScriptManual));

    
    console.log("\n3. Searching for cells...");

    
    console.log("\n  [A] camelCase script:");
    try {
      const scriptA = {
        codeHash: secpOpts.secpCodeHash,
        hashType: secpOpts.secpHashType,
        args: pubKeyHash,
      };
      console.log("   script:", JSON.stringify(scriptA));
      let count = 0;
      for await (const cell of client.findCells(
        { script: scriptA, scriptType: "lock", scriptSearchMode: "exact" },
        "asc",
        10,
      )) {
        count++;
        console.log(
          "   Cell",
          count,
          ":",
          cell.outPoint?.txHash?.slice(0, 20) + "...",
          "cap:",
          cell.cellOutput?.capacity,
        );
      }
      console.log("   Total cells found:", count);
    } catch (e) {
      console.log("   Error:", e.message);
    }

    
    console.log("\n  [B] snake_case script:");
    try {
      const scriptB = {
        code_hash: secpOpts.secpCodeHash,
        hash_type: secpOpts.secpHashType,
        args: pubKeyHash,
      };
      console.log("   script:", JSON.stringify(scriptB));
      let count = 0;
      for await (const cell of client.findCells(
        { script: scriptB, scriptType: "lock", scriptSearchMode: "exact" },
        "asc",
        10,
      )) {
        count++;
        console.log(
          "   Cell",
          count,
          ":",
          cell.outPoint?.txHash?.slice(0, 20) + "...",
          "cap:",
          cell.cellOutput?.capacity,
        );
      }
      console.log("   Total cells found:", count);
    } catch (e) {
      console.log("   Error:", e.message);
    }

    
    console.log("\n  [C] ccc.Script.from:");
    try {
      const scriptC = ccc.Script.from({
        codeHash: secpOpts.secpCodeHash,
        hashType: secpOpts.secpHashType,
        args: pubKeyHash,
      });
      console.log("   script:", JSON.stringify(scriptC));
      let count = 0;
      for await (const cell of client.findCells(
        { script: scriptC, scriptType: "lock", scriptSearchMode: "exact" },
        "asc",
        10,
      )) {
        count++;
        console.log(
          "   Cell",
          count,
          ":",
          cell.outPoint?.txHash?.slice(0, 20) + "...",
          "cap:",
          cell.cellOutput?.capacity,
        );
      }
      console.log("   Total cells found:", count);
    } catch (e) {
      console.log("   Error:", e.message);
    }

    
    console.log("\n  [D] Direct RPC get_cells:");
    try {
      const http = require("http");
      const d = JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "get_cells",
        params: [
          {
            script: {
              code_hash: secpOpts.secpCodeHash,
              hash_type: secpOpts.secpHashType,
              args: pubKeyHash,
            },
            script_type: "lock",
            script_search_mode: "exact",
          },
          "asc",
          "0xa",
        ],
      });
      const r = await new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: 8114,
            path: "/",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(d),
            },
          },
          (res) => {
            let b = "";
            res.on("data", (c) => (b += c));
            res.on("end", () => resolve(JSON.parse(b)));
          },
        );
        req.on("error", reject);
        req.write(d);
        req.end();
      });
      if (r.error) {
        console.log("   RPC error:", r.error.message);
      } else {
        console.log("   Cells found:", r.result?.objects?.length || 0);
        if (r.result?.objects) {
          r.result.objects.slice(0, 3).forEach((obj, i) => {
            console.log(
              "   Cell",
              i + 1,
              ":",
              obj.out_point?.tx_hash?.slice(0, 20) + "...",
              "cap:",
              obj.output?.capacity,
            );
            console.log("     Lock:", JSON.stringify(obj.output?.lock));
          });
        }
      }
    } catch (e) {
      console.log("   Error:", e.message);
    }
  } catch (e) {
    console.log("\nFATAL:", e.message);
    console.log(e.stack?.split("\n").slice(0, 5).join("\n"));
  }
})();
