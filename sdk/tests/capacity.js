const { calculateMinimumCapacity } = require("../sdk/txbuilder");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bright: "\x1b[1m",
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function bytesToCkb(bytes) {
  return BigInt(bytes) * 100_000_000n;
}

log("\nTest 1: Empty cell (lock only, no data)", colors.bright);

const lockScript1 = {
  codeHash:
    "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
  hashType: "type",
  args: "0xe2fa82e70b062c8644b80ad7ecf6e015e5f352f6",
};

const cap1 = calculateMinimumCapacity(lockScript1, null, null);
const lockArgsLen = 20;
const lockSize = 32 + 1 + 4 + lockArgsLen;
const structOverhead = 33;
const buffer = 10;
const expectedBytes1 = structOverhead + lockSize + buffer;
const expectedCap1 = bytesToCkb(expectedBytes1);

log(`  Lock args: ${lockArgsLen} bytes`);
log(`  Lock size: ${lockSize} bytes (32 + 1 + 4 + ${lockArgsLen})`);
log(`  Struct overhead: ${structOverhead} bytes`);
log(`  Buffer: ${buffer} bytes`);
log(`  Expected total: ${expectedBytes1} bytes`);
log(`  Expected capacity: ${(expectedCap1 / 100_000_000n).toString()} CKB`);
log(`  Calculated capacity: ${(cap1 / 100_000_000n).toString()} CKB`);

if (cap1 === expectedCap1) {
  log("  PASS", colors.green);
} else {
  log(`  FAIL: expected ${expectedCap1}, got ${cap1}`, colors.red);
}

log("\nTest 2: Cell with 256 bytes data (DCurve)", colors.bright);

const dataHex2 = "0x" + "ab".repeat(256);
const cap2 = calculateMinimumCapacity(lockScript1, null, dataHex2);
const expectedBytes2 = structOverhead + lockSize + 256 + buffer;
const expectedCap2 = bytesToCkb(expectedBytes2);

log(`  Data size: 256 bytes`);
log(`  Expected total: ${expectedBytes2} bytes`);
log(`  Expected capacity: ${(expectedCap2 / 100_000_000n).toString()} CKB`);
log(`  Calculated capacity: ${(cap2 / 100_000_000n).toString()} CKB`);

if (cap2 === expectedCap2) {
  log("  PASS", colors.green);
} else {
  log(`  FAIL: expected ${expectedCap2}, got ${cap2}`, colors.red);
}

log("\nTest 3: Cell with type script", colors.bright);

const typeScript3 = {
  codeHash: "0x" + "cc".repeat(32),
  hashType: "type",
  args: "0x" + "dd".repeat(32),
};
const cap3 = calculateMinimumCapacity(lockScript1, typeScript3, null);
const typeArgsLen = 32;
const typeSize = 32 + 1 + 4 + typeArgsLen;
const expectedBytes3 = structOverhead + lockSize + typeSize + buffer;
const expectedCap3 = bytesToCkb(expectedBytes3);

log(`  Type args: ${typeArgsLen} bytes`);
log(`  Type size: ${typeSize} bytes`);
log(`  Expected total: ${expectedBytes3} bytes`);
log(`  Expected capacity: ${(expectedCap3 / 100_000_000n).toString()} CKB`);
log(`  Calculated capacity: ${(cap3 / 100_000_000n).toString()} CKB`);

if (cap3 === expectedCap3) {
  log("  PASS", colors.green);
} else {
  log(`  FAIL: expected ${expectedCap3}, got ${cap3}`, colors.red);
}

log("\nTest 4: Full cell (lock + type + data)", colors.bright);

const dataHex4 = "0x" + "ee".repeat(500);
const cap4 = calculateMinimumCapacity(lockScript1, typeScript3, dataHex4);
const expectedBytes4 = structOverhead + lockSize + typeSize + 500 + buffer;
const expectedCap4 = bytesToCkb(expectedBytes4);

log(`  Data size: 500 bytes`);
log(`  Expected total: ${expectedBytes4} bytes`);
log(`  Expected capacity: ${(expectedCap4 / 100_000_000n).toString()} CKB`);
log(`  Calculated capacity: ${(cap4 / 100_000_000n).toString()} CKB`);

if (cap4 === expectedCap4) {
  log("  PASS", colors.green);
} else {
  log(`  FAIL: expected ${expectedCap4}, got ${cap4}`, colors.red);
}

log("\nTest 5: Hardcoded 500 CKB vs Calculated", colors.bright);

const oldHardcoded = 50000000000n;
const calculatedFor256Bytes = calculateMinimumCapacity(
  lockScript1,
  null,
  "0x" + "ab".repeat(256),
);

log(`  Old hardcoded: ${(oldHardcoded / 100_000_000n).toString()} CKB`);
log(
  `  Calculated (256 bytes data): ${(calculatedFor256Bytes / 100_000_000n).toString()} CKB`,
);
const waste = oldHardcoded - calculatedFor256Bytes;
log(`  Wasted per cell: ${(waste / 100_000_000n).toString()} CKB`);
log(
  `  Waste percentage: ${((Number(waste) / Number(oldHardcoded)) * 100).toFixed(1)}%`,
);

log("\nTest 6: Edge case - '0x' empty data", colors.bright);

const cap6 = calculateMinimumCapacity(lockScript1, null, "0x");
const expectedBytes6 = structOverhead + lockSize + 0 + buffer;
const expectedCap6 = bytesToCkb(expectedBytes6);

log(`  Data: '0x' (0 bytes)`);
log(`  Expected total: ${expectedBytes6} bytes`);
log(`  Expected capacity: ${(expectedCap6 / 100_000_000n).toString()} CKB`);
log(`  Calculated capacity: ${(cap6 / 100_000_000n).toString()} CKB`);

if (cap6 === expectedCap6) {
  log("  PASS", colors.green);
} else {
  log(`  FAIL: expected ${expectedCap6}, got ${cap6}`, colors.red);
}

log("\nSummary", colors.bright);
log(`  The calculateMinimumCapacity function correctly computes`);
log(`  storage costs based on actual byte sizes.`);
log(
  `  For a 256-byte DCurve data cell: ~${(calculatedFor256Bytes / 100_000_000n).toString()} CKB`,
);
log(`  vs the old hardcoded: 500 CKB`);
log(
  `  Savings: ${(waste / 100_000_000n).toString()} CKB per contribution cell`,
);
