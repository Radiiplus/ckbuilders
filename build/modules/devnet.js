// ATHEON Protocol - Devnet Module
// Provides functions to start, stop, and manage the CKB devnet

const { spawn, execSync } = require("child_process");
const http = require("http");
const os = require("os");

// Detect platform
const isWindows = process.platform === "win32";
const isWSL = os.release().includes("microsoft");

let devnetProcess = null;
let isRunning = false;

const RPC_URL = "http://127.0.0.1:8114";

/**
 * Stop any existing CKB processes
 */
function stopCKBProcesses() {
  try {
    if (isWindows) {
      execSync("taskkill /F /IM ckb.exe 2>nul || true");
      execSync("taskkill /F /IM offckb 2>nul || true");
    } else {
      execSync("pkill -9 -f 'ckb run' 2>/dev/null || true");
      execSync("pkill -9 -f 'offckb node' 2>/dev/null || true");
    }
  } catch {}
}

/**
 * Check if the CKB RPC is responding
 */
async function checkRPC() {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "get_tip_block_number",
      params: [],
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
        timeout: 2000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const response = JSON.parse(data);
            resolve(response.result !== undefined);
          } catch {
            resolve(false);
          }
        });
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Wait for RPC to be ready
 */
async function waitForRPC(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkRPC()) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Start the devnet
 */
async function start(options = {}) {
  const { timeout = 60000 } = options;

  // Always stop any existing processes first
  stopCKBProcesses();
  isRunning = false;
  devnetProcess = null;
  await sleep(2000);

  return new Promise((resolve, reject) => {
    if (isWindows) {
      devnetProcess = spawn("cmd.exe", ["/c", "npx offckb node"], {
        detached: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: false,
      });
    } else {
      devnetProcess = spawn("npx", ["offckb", "node"], {
        detached: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    }

    let started = false;

    const onStarted = () => {
      if (!started) {
        started = true;
        isRunning = true;
        resolve(true);
      }
    };

    devnetProcess.stdout.on("data", (data) => {
      const output = data.toString();
      if (
        output.includes("CKB devnet RPC") ||
        output.includes("Launching CKB")
      ) {
        onStarted();
      }
    });

    devnetProcess.stderr.on("data", (data) => {
      const output = data.toString();
      if (
        output.includes("CKB devnet RPC") ||
        output.includes("Launching CKB")
      ) {
        onStarted();
      }
    });

    devnetProcess.on("error", (err) => {
      if (!started) reject(err);
    });

    devnetProcess.on("exit", () => {
      isRunning = false;
      devnetProcess = null;
    });

    setTimeout(() => {
      if (!started) {
        reject(new Error("Timeout waiting for devnet to start"));
      }
    }, timeout);
  });
}

/**
 * Stop the devnet
 */
function stop() {
  if (devnetProcess) {
    devnetProcess.kill("SIGINT");
    devnetProcess = null;
  }
  stopCKBProcesses();
  isRunning = false;
  return true;
}

/**
 * Check if devnet is running
 */
function status() {
  return isRunning;
}

/**
 * Get the current block height
 */
async function getBlockHeight() {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "get_tip_block_number",
      params: [],
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
        timeout: 2000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const response = JSON.parse(data);
            if (response.result) {
              resolve(parseInt(response.result, 16));
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Get the RPC URL
 */
function getRPCUrl() {
  return RPC_URL;
}

module.exports = {
  start,
  stop,
  status,
  checkRPC,
  waitForRPC,
  getBlockHeight,
  getRPCUrl,
  sleep,
};
