const { ccc } = require("@ckb-ccc/core");

class FeeEstimator {
  constructor(clientOrRpcUrl, options = {}) {
    if (typeof clientOrRpcUrl === "string") {
      this.client = new ccc.ClientJsonRpc(clientOrRpcUrl);
    } else if (clientOrRpcUrl instanceof ccc.Client) {
      this.client = clientOrRpcUrl;
    } else {
      throw new Error("Must provide a CKB Client or RPC URL");
    }

    this.options = {
      defaultFeeRate: options.defaultFeeRate || 3000,
      minFeeRate: options.minFeeRate || 1000,
      rbfMultiplier: options.rbfMultiplier || 1.5,
      exposeTxHashInErrors: options.exposeTxHashInErrors ?? false,
    };
  }

  estimateTxSize(inputCount, outputCount, witnessCount = 0) {
    const BASE_SIZE = 100;
    const INPUT_SIZE = 200;
    const OUTPUT_SIZE = 100;
    const WITNESS_SIZE = 100;

    return (
      BASE_SIZE +
      inputCount * INPUT_SIZE +
      outputCount * OUTPUT_SIZE +
      witnessCount * WITNESS_SIZE
    );
  }

  calculateFee(size, feeRate) {
    return BigInt(Math.ceil((size / 1024) * feeRate));
  }

  async getMinFeeRate() {
    try {
      const config = await this.client.getTxpoolConfig();
      return Number(config.minFeeRate) || this.options.minFeeRate;
    } catch (e) {
      return this.options.minFeeRate;
    }
  }

  async checkPendingTransactions(inputOutPoints) {
    try {
      const txPoolInfo = await this.client.getTxpoolInfo();

      if (!txPoolInfo || !txPoolInfo.txs) {
        return { hasPending: false };
      }

      const inputHashes = new Set(
        inputOutPoints
          .map(
            (inp) =>
              inp.txHash ||
              inp.previousOutput?.txHash ||
              inp.previous_output?.tx_hash,
          )
          .filter(Boolean),
      );

      for (const tx of txPoolInfo.txs) {
        if (!tx.inputs) continue;

        const txInputHashes = tx.inputs
          .map((inp) => inp.previous_output?.tx_hash || inp.tx_hash)
          .filter(Boolean);

        const hasOverlap = txInputHashes.some((hash) => inputHashes.has(hash));

        if (hasOverlap) {
          const currentFee = BigInt(tx.fee || 0);
          const minFeeRate = await this.getMinFeeRate();

          const minRbfFee = BigInt(
            Math.ceil(
              Math.max(
                Number(currentFee) * this.options.rbfMultiplier,
                (this.estimateTxSize(
                  tx.inputs.length,
                  tx.outputs?.length || 1,
                  1,
                ) /
                  1024) *
                  minFeeRate,
              ),
            ),
          );

          const txHashDisplay = this.options.exposeTxHashInErrors
            ? tx.hash?.slice(0, 18) + "..."
            : "[hidden]";

          return {
            hasPending: true,
            pendingTxHash: tx.hash,
            currentFee,
            minRbfFee,
            reason: `RBF required: pending tx ${txHashDisplay}`,
          };
        }
      }

      return { hasPending: false };
    } catch (e) {
      return { hasPending: false, error: e.message };
    }
  }

  async getRecommendedFeeRate(baseFeeRate = null, rbfInfo = null) {
    const minFeeRate = await this.getMinFeeRate();
    let feeRate = baseFeeRate
      ? Math.max(baseFeeRate, minFeeRate)
      : this.options.defaultFeeRate;

    if (rbfInfo?.hasPending && rbfInfo.minRbfFee) {
      feeRate = Math.ceil(feeRate * this.options.rbfMultiplier);
    }

    return Math.max(feeRate, minFeeRate);
  }

  async estimateFee(inputs, outputs, baseFeeRate = null) {
    const inputCount = inputs?.length || 1;
    const outputCount = outputs?.length || 1;
    const witnessCount = inputCount;

    const size = this.estimateTxSize(inputCount, outputCount, witnessCount);
    const rbfInfo = await this.checkPendingTransactions(inputs || []);
    const adjustedFeeRate = await this.getRecommendedFeeRate(
      baseFeeRate,
      rbfInfo,
    );

    let fee = this.calculateFee(size, adjustedFeeRate);

    if (rbfInfo.hasPending && rbfInfo.minRbfFee) {
      const safeRbfFee = BigInt(
        Math.ceil(Number(rbfInfo.minRbfFee) * this.options.rbfMultiplier),
      );
      fee = fee < safeRbfFee ? safeRbfFee : fee;
    }

    const minFeeBasedOnSize = this.calculateFee(size, adjustedFeeRate);
    if (fee < minFeeBasedOnSize) {
      fee = minFeeBasedOnSize;
    }

    return {
      fee,
      feeRate: adjustedFeeRate,
      size,
      rbfInfo,
      breakdown: {
        baseSize: size,
        inputCount,
        outputCount,
        witnessCount,
        baseFeeRate: baseFeeRate || this.options.defaultFeeRate,
        adjustedFeeRate,
        rbfAdjustment: rbfInfo.hasPending,
      },
    };
  }

  async dryRun(
    outputs,
    outputsData = [],
    estimatedInputs = 1,
    baseFeeRate = null,
  ) {
    const mockInputs = Array(estimatedInputs).fill({
      previousOutput: { txHash: "0x" + "00".repeat(64), index: "0x0" },
    });

    const estimation = await this.estimateFee(mockInputs, outputs, baseFeeRate);
    const totalOutputCapacity = outputs.reduce(
      (sum, o) => sum + BigInt(o.capacity),
      0n,
    );
    const totalRequired = totalOutputCapacity + estimation.fee;

    return {
      ...estimation,
      totalOutputCapacity,
      totalRequired,
      summary: {
        outputs: outputs.length,
        estimatedInputs,
        outputCapacity: `${Number(totalOutputCapacity) / 1e8} CKB`,
        estimatedFee: `${Number(estimation.fee) / 1e8} CKB`,
        totalNeeded: `${Number(totalRequired) / 1e8} CKB`,
        rbfRequired: estimation.rbfInfo?.hasPending || false,
        rbfReason: estimation.rbfInfo?.reason,
      },
    };
  }

  async getPendingTxCount() {
    try {
      const txPoolInfo = await this.client.getTxpoolInfo();
      return txPoolInfo?.txs?.length || 0;
    } catch (e) {
      return 0;
    }
  }

  logEstimation(estimation, prefix = "[FeeEstimator]") {
    console.log(`\n${prefix} Fee Estimation:`);
    console.log(`  Transaction Size: ${estimation.size} bytes`);
    console.log(`  Fee Rate: ${estimation.feeRate} shannons/KB`);
    console.log(
      `  Estimated Fee: ${Number(estimation.fee) / 1e8} CKB (${estimation.fee} shannons)`,
    );

    if (estimation.rbfInfo?.hasPending) {
      console.log(`  RBF Required!`);
      console.log(
        `     Pending TX: ${estimation.rbfInfo.pendingTxHash?.slice(0, 30)}...`,
      );
      console.log(
        `     Current Fee: ${Number(estimation.rbfInfo.currentFee) / 1e8} CKB`,
      );
      console.log(
        `     Min RBF Fee: ${Number(estimation.rbfInfo.minRbfFee) / 1e8} CKB`,
      );
    }

    if (estimation.summary) {
      console.log(`\n  Summary:`);
      console.log(`    Outputs: ${estimation.summary.outputs}`);
      console.log(
        `    Estimated Inputs: ${estimation.summary.estimatedInputs}`,
      );
      console.log(`    Output Capacity: ${estimation.summary.outputCapacity}`);
      console.log(`    Estimated Fee: ${estimation.summary.estimatedFee}`);
      console.log(`    Total Needed: ${estimation.summary.totalNeeded}`);
      if (estimation.summary.rbfRequired) {
        console.log(`    RBF Required: ${estimation.summary.rbfReason}`);
      }
    }
  }
}

module.exports = { FeeEstimator };
