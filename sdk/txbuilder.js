const { ccc } = require("@ckb-ccc/core");
const { FeeEstimator } = require("./fee");
const fs = require("fs");
const path = require("path");
const http = require("http");

function validatePrivateKey(privateKey) {
  if (typeof privateKey !== "string") {
    throw new Error("Private key must be a string");
  }
  const hexKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
  if (hexKey.length !== 64) {
    throw new Error(
      `Invalid private key length: expected 64 hex chars, got ${hexKey.length}`,
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(hexKey)) {
    throw new Error("Private key must be a valid hex string");
  }
}

function getDeploymentInfo(network = "devnet") {
  const deploymentsFile = path.join(
    __dirname,
    "..",
    "deployments",
    `${network}-deployments.json`,
  );
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(`Deployment file not found: ${deploymentsFile}`);
  }
  return JSON.parse(fs.readFileSync(deploymentsFile, "utf-8"));
}

function getContractCellDep(contractName, network = "devnet") {
  const info = getDeploymentInfo(network);
  if (!info.contracts || !info.contracts[contractName]) {
    throw new Error(`Contract ${contractName} not found in deployments`);
  }
  const contract = info.contracts[contractName];
  return {
    outPoint: { txHash: contract.txHash, index: contract.index || "0x0" },
    depType: contract.depType || "code",
  };
}

class SimpleClient extends ccc.ClientJsonRpc {
  constructor(url, options = {}) {
    super(url);
    this.secpCellDepTxHash = options.secpCellDepTxHash;
    this.secpCodeHash = options.secpCodeHash;
    this.secpHashType = options.secpHashType || "type";
  }

  get addressPrefix() {
    return "ckt";
  }

  async getKnownScript(script, options = {}) {
    const mainnetCodeHashes = {
      [ccc.KnownScript.Secp256k1Blake160]:
        "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
      [ccc.KnownScript.AnyoneCanPay]:
        "0x3419a1c09eb2567f6552ee7a8ecffd64155cffe40ac491e970acaa66e257d149",
      [ccc.KnownScript.Secp256k1Multisig]:
        "0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8",
      [ccc.KnownScript.NervosDao]:
        "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
    };

    const isKnownScript =
      typeof script === "string" && mainnetCodeHashes[script];
    if (!isKnownScript) {
      return {
        codeHash: script?.codeHash || script?.code_hash,
        hashType: script?.hashType || script?.hash_type || "type",
        cellDeps: [],
      };
    }

    let codeHash = options.codeHash || mainnetCodeHashes[script];
    if (
      script === ccc.KnownScript.Secp256k1Blake160 &&
      this.secpCodeHash &&
      !options.codeHash
    ) {
      codeHash = this.secpCodeHash;
    }
    if (!codeHash) throw new Error(`Unknown script: ${script}`);

    const txHash = options.txHash || this.secpCellDepTxHash;
    if (!txHash)
      throw new Error(`No cell dep txHash configured for script ${script}`);

    return {
      codeHash,
      hashType:
        script === ccc.KnownScript.Secp256k1Blake160 && this.secpHashType
          ? this.secpHashType
          : "type",
      cellDeps: [
        {
          cellDep: { outPoint: { txHash, index: "0x0" }, depType: "depGroup" },
        },
      ],
    };
  }
}

class SimpleTxBuilder {
  constructor(rpcUrl, options = {}) {
    this.client = new SimpleClient(rpcUrl, {
      secpCellDepTxHash: options.secpCellDepTxHash,
      secpCodeHash: options.secpCodeHash,
      secpHashType: options.secpHashType,
    });
    this.feeEstimator = new FeeEstimator(rpcUrl);
    this.options = {
      feeRate: options.feeRate || 3000,
      maxFeeRate: options.maxFeeRate || 10000,
      secpCellDepTxHash: options.secpCellDepTxHash,
      secpCodeHash: options.secpCodeHash,
      secpHashType: options.secpHashType,
    };
  }

  async getLockScript(privateKey) {
    validatePrivateKey(privateKey);
    const signer = new ccc.SignerCkbPrivateKey(this.client, privateKey);
    const addrObj = await signer.getAddressObjSecp256k1();
    return addrObj.script;
  }

  async getAddress(privateKey) {
    validatePrivateKey(privateKey);
    const signer = new ccc.SignerCkbPrivateKey(this.client, privateKey);
    return await signer.getRecommendedAddress();
  }

  async estimateFee(inputs, outputs, feeRate) {
    return this.feeEstimator
      .estimateFee(inputs || [], outputs || [], feeRate || this.options.feeRate)
      .then((r) => r.fee);
  }

  async buildAndSend(
    outputs,
    outputsData,
    privateKey,
    feeRate,
    customCellDeps,
  ) {
    validatePrivateKey(privateKey);
    const lockScript = await this.getLockScript(privateKey);

    const utxos = [];
    let totalCapacity = 0n;
    const outputCap = outputs.reduce((sum, o) => sum + BigInt(o.capacity), 0n);
    const mockInputs = [
      { previousOutput: { txHash: "0x" + "00".repeat(64), index: "0x0" } },
    ];
    const estFee = await this.estimateFee(mockInputs, outputs, feeRate);
    const requiredCapacity = outputCap + estFee;

    for await (const cell of this.client.findCells(
      { script: lockScript, scriptType: "lock", scriptSearchMode: "exact" },
      "asc",
      5,
    )) {
      utxos.push(cell);
      totalCapacity += BigInt(cell.cellOutput.capacity);
      if (totalCapacity >= requiredCapacity) break;
    }
    if (utxos.length === 0) throw new Error("No UTXOs found");

    const inCap = totalCapacity;
    const outCap = outputs.reduce((sum, o) => sum + BigInt(o.capacity), 0n);
    const estimatedFee = await this.estimateFee(
      utxos.map((u) => ({ previousOutput: u.outPoint })),
      outputs,
      feeRate,
    );
    const change = inCap - outCap - estimatedFee;

    const finalOutputs = [...outputs];
    const finalOutputsData = [...outputsData];
    const minChangeCapacity = calculateMinimumCapacity(lockScript, null, "0x");
    if (change >= minChangeCapacity) {
      finalOutputs.push({ lock: lockScript, capacity: change });
      finalOutputsData.push("0x");
    } else if (change > 0n) {
      console.warn(
        `Change ${change} is below minimum ${minChangeCapacity} and will be added as extra fee`,
      );
    }

    const tx = {
      version: "0x00000000",
      cellDeps: [
        {
          outPoint: { txHash: this.options.secpCellDepTxHash, index: "0x0" },
          depType: "depGroup",
        },
      ],
      headerDeps: [],
      inputs: utxos.map((u) => ({ previousOutput: u.outPoint, since: "0x0" })),
      outputs: finalOutputs,
      outputsData: finalOutputsData,
      witnesses: [],
    };
    if (customCellDeps?.length) tx.cellDeps.push(...customCellDeps);

    const signer = new ccc.SignerCkbPrivateKey(this.client, privateKey);
    const preparedTx = await signer.prepareTransaction(tx);
    const signedTx = await signer.signTransaction(preparedTx);
    const txHash = await this.client.sendTransaction(signedTx);

    return { txHash, tx: signedTx };
  }

  async buildAndSendWithRbfRetry(
    outputs,
    outputsData,
    privateKey,
    feeRate,
    customCellDeps,
    maxRetries = 3,
  ) {
    let lastError = null;
    let currentFeeRate = feeRate || this.options.feeRate;
    const maxFeeRate = this.options.maxFeeRate;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `  [Attempt ${attempt + 1}/${maxRetries + 1}] Fee rate: ${Math.round(currentFeeRate)} shannons/KB`,
        );
        return await this.buildAndSend(
          outputs,
          outputsData,
          privateKey,
          currentFeeRate,
          customCellDeps,
        );
      } catch (e) {
        lastError = e;
        const rbfMatch = e.message?.match(
          /expect it to >= (\d+) to replace old txs/,
        );
        if (rbfMatch) {
          const minRequiredFee = BigInt(rbfMatch[1]);
          if (attempt === maxRetries) {
            console.log(
              `  Max retries reached. Minimum required fee: ${minRequiredFee} shannons`,
            );
            break;
          }
          const sizeEstimate = this.feeEstimator.estimateTxSize(2, 3, 2);
          const requiredFeeRate = Math.ceil(
            (Number(minRequiredFee) / (sizeEstimate / 1024)) * 1.2,
          );
          currentFeeRate = Math.max(currentFeeRate * 1.5, requiredFeeRate);
          if (currentFeeRate > maxFeeRate) {
            console.log(`  Fee rate capped at ${maxFeeRate} shannons/KB`);
            currentFeeRate = maxFeeRate;
          }
          console.log(
            `  RBF detected. Increasing fee rate to ${Math.round(currentFeeRate)} shannons/KB`,
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          throw e;
        }
      }
    }
    throw lastError;
  }

  async waitForTransaction(txHash, options = {}) {
    const { timeoutMs = 60000, pollIntervalMs = 2000 } = options;
    const startTime = Date.now();

    const rpcUrl =
      this.client.rpc?.url || this.client.url || "http://127.0.0.1:8114";
    const url = new URL(rpcUrl);

    while (Date.now() - startTime < timeoutMs) {
      try {
        const postData = JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "get_transaction",
          params: [txHash],
        });

        const tx = await new Promise((resolve, reject) => {
          const req = http.request(
            {
              hostname: url.hostname,
              port: url.port,
              path: url.pathname,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData),
              },
              timeout: 5000,
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

        if (tx && tx.tx_status && tx.tx_status.status === "committed") {
          return {
            txHash,
            blockNumber: tx.tx_status.block_number,
            confirmations: 1,
          };
        }
      } catch (e) {}

      const elapsed = Date.now() - startTime;
      const remaining = Math.ceil((timeoutMs - elapsed) / 1000);
      console.log(`  Waiting for confirmation... (${remaining}s remaining)`);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
      `Transaction ${txHash} not confirmed within ${timeoutMs}ms`,
    );
  }
}

function calculateMinimumCapacity(lockScript, typeScript, dataHex) {
  const dataSize = dataHex ? dataHex.replace(/^0x/, "").length / 2 : 0;
  const lockArgsLen = lockScript?.args
    ? lockScript.args.replace(/^0x/, "").length / 2
    : 0;
  const lockSize = 32 + 1 + 4 + lockArgsLen;
  let typeSize = 0;
  if (typeScript) {
    const typeArgsLen = typeScript.args
      ? typeScript.args.replace(/^0x/, "").length / 2
      : 0;
    typeSize = 32 + 1 + 4 + typeArgsLen;
  }
  const structOverhead = 33;
  const totalBytes = structOverhead + lockSize + typeSize + dataSize;
  const buffer = 10;
  return BigInt(totalBytes + buffer) * 100_000_000n;
}

module.exports = {
  SimpleClient,
  SimpleTxBuilder,
  getDeploymentInfo,
  getContractCellDep,
  calculateMinimumCapacity,
  validatePrivateKey,
};
