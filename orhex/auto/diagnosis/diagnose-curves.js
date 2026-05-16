require("dotenv").config({
  path: require("path").resolve(__dirname, "..", ".env"),
});

const { ccc } = require("@ckb-ccc/core");
const { decodeCurveData, DCURVE_DATA_SIZE } = require("../../sdk");
const { rpcRequest, log, colors } = require("../utils/cli-helpers");

const PRIVATE_KEY = process.env.CKB_GENESIS_PRIVKEY_0;
const signer = new ccc.SignerCkbPrivateKey({ rpc: {} }, PRIVATE_KEY);
const pubKey = signer.publicKey;
const pubKeyHash = ccc.hexFrom(ccc.hashCkb(ccc.bytesFrom(pubKey)).slice(0, 42));

console.log("=== CURVE CELL DIAGNOSTIC ===");
console.log("Scanning address:", pubKeyHash);

(async () => {
  try {
    const result = await rpcRequest("get_cells", [
      {
        script: {
          code_hash:
            "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
          hash_type: "type",
          args: pubKeyHash,
        },
        script_type: "lock",
        script_search_mode: "exact",
      },
      "asc",
      "0x10",
    ]);

    if (!result.objects || result.objects.length === 0) {
      console.log("No cells found");
      return;
    }

    console.log(`\nFound ${result.objects.length} cells:`);

    for (const cell of result.objects) {
      const dataHex = cell.data || cell.output_data;
      const dataLen =
        dataHex && dataHex !== "0x" ? (dataHex.length - 2) / 2 : 0;
      const txHash =
        cell.out_point?.tx_hash || cell.outPoint?.txHash || "unknown";

      console.log(`\nCell: ${txHash.slice(0, 18)}...`);
      console.log(`  Data length: ${dataLen} bytes`);

      if (dataLen === DCURVE_DATA_SIZE) {
        console.log("  ✓ Potential curve cell!");
        try {
          const dataBytes = new Uint8Array(
            dataHex
              .slice(2)
              .match(/.{2}/g)
              .map((b) => parseInt(b, 16)),
          );
          const curveData = decodeCurveData(dataBytes);
          console.log(`  curveId: ${curveData.curveId.slice(0, 18)}...`);
          console.log(`  launchId: ${curveData.launchId.slice(0, 18)}...`);
          console.log(`  status: ${curveData.status}`);
          console.log(`  tokensAllocated: ${curveData.tokensAllocated}`);
          console.log(`  tokensSold: ${curveData.tokensSold}`);
          console.log(`  currentCkb: ${curveData.currentCkb}`);
          console.log(`  targetCkb: ${curveData.targetCkb}`);
        } catch (e) {
          console.log(`  ✗ Failed to decode: ${e.message}`);
        }
      } else if (dataLen > 0) {
        console.log(`  Data preview: ${dataHex.slice(0, 66)}...`);
      }
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
})();
