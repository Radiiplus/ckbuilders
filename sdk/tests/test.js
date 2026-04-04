require("dotenv").config({
  path: require("path").resolve(__dirname, "..", ".env"),
});

const { FeeEstimator, SimpleTxBuilder } = require("./index");

const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:8114";
const PRIVATE_KEY = process.env.CKB_GENESIS_PRIVKEY_0;

async function test() {
  console.log("Testing ATHEON SDK...\n");

  try {
    console.log("1. Testing FeeEstimator...");
    const estimator = new FeeEstimator(RPC_URL);

    const minFeeRate = await estimator.getMinFeeRate();
    console.log(`   Min fee rate: ${minFeeRate} shannons/KB`);

    const pendingCount = await estimator.getPendingTxCount();
    console.log(`   Pending transactions: ${pendingCount}`);

    const mockOutputs = [
      {
        lock: {
          codeHash: "0x" + "00".repeat(64),
          hashType: "type",
          args: "0x",
        },
        capacity: 100000000000n,
      },
    ];
    const estimation = await estimator.estimateFee([], mockOutputs, 3000);
    console.log(`   Estimated fee: ${Number(estimation.fee) / 1e8} CKB`);
    console.log(`   Fee rate: ${estimation.feeRate} shannons/KB`);
    console.log(`   RBF required: ${estimation.rbfInfo.hasPending}`);

    console.log("\n2. Testing SimpleTxBuilder...");
    const txBuilder = new SimpleTxBuilder(RPC_URL);

    const lockScript = await txBuilder.getLockScript(PRIVATE_KEY);
    console.log(`   Lock script: ${lockScript.codeHash.slice(0, 18)}...`);

    const address = await txBuilder.getAddress(PRIVATE_KEY);
    console.log(`   Address: ${address.slice(0, 40)}...`);

    const mockInputs = [
      { previousOutput: { txHash: "0x" + "00".repeat(64), index: "0x0" } },
    ];
    const fee = await txBuilder.estimateFee(mockInputs, mockOutputs, 3000);
    console.log(`   Estimated fee: ${Number(fee) / 1e8} CKB`);

    console.log("\n3. Testing dry run...");
    const dryRun = await estimator.dryRun(mockOutputs, ["0x"], 1, 3000);
    console.log(`   Output capacity: ${dryRun.summary.outputCapacity}`);
    console.log(`   Estimated fee: ${dryRun.summary.estimatedFee}`);
    console.log(`   Total needed: ${dryRun.summary.totalNeeded}`);
    console.log(`   RBF required: ${dryRun.summary.rbfRequired}`);

    console.log("\nAll tests passed!\n");
  } catch (e) {
    console.log("\nTest failed:", e.message);
    console.error(e);
    process.exit(1);
  }
}

test();

module.exports = { test };
