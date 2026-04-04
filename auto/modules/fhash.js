

const {
  colors,
  log,
  getFactoryScriptHash,
  displayFactoryHash,
} = require("../utils/cli-helpers");

async function main() {
  try {
    const result = getFactoryScriptHash("devnet");
    displayFactoryHash(result);
  } catch (e) {
    log(`\n✗ Error: ${e.message}`, colors.red);
    console.error(e);
    process.exit(1);
  }
}


if (require.main === module) {
  main();
}

module.exports = {
  getFactoryScriptHash,
  displayFactoryHash,
  log,
  colors,
};
