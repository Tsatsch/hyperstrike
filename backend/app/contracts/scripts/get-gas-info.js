const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Getting Gas Properties for HyperEVM Testnet...\n");

  try {
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("📡 Network Information:");
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Network Name: ${network.name || "Unknown"}\n`);

    // Get latest block
    const latestBlock = await ethers.provider.getBlock("latest");
    console.log("📦 Latest Block Information:");
    console.log(`   Block Number: ${latestBlock.number}`);
    console.log(`   Block Gas Limit: ${latestBlock.gasLimit.toLocaleString()} gas`);
    console.log(`   Block Base Fee: ${latestBlock.baseFeePerGas ? ethers.formatUnits(latestBlock.baseFeePerGas, "gwei") + " gwei" : "N/A"}`);
    console.log(`   Block Timestamp: ${new Date(latestBlock.timestamp * 1000).toLocaleString()}\n`);

    // Get gas price
    const gasPrice = await ethers.provider.getFeeData();
    console.log("⛽ Gas Price Information:");
    console.log(`   Current Gas Price: ${ethers.formatUnits(gasPrice.gasPrice, "gwei")} gwei`);
    console.log(`   Max Fee Per Gas: ${gasPrice.maxFeePerGas ? ethers.formatUnits(gasPrice.maxFeePerGas, "gwei") + " gwei" : "N/A"}`);
    console.log(`   Max Priority Fee Per Gas: ${gasPrice.maxPriorityFeePerGas ? ethers.formatUnits(gasPrice.maxPriorityFeePerGas, "gwei") + " gwei" : "N/A"}`);
    console.log(`   Last Base Fee: ${gasPrice.lastBaseFeePerGas ? ethers.formatUnits(gasPrice.lastBaseFeePerGas, "gwei") + " gwei" : "N/A"}\n`);

    // Calculate recommended gas settings
    const blockGasLimit = latestBlock.gasLimit;
    const recommendedGasLimit = Math.floor(blockGasLimit * 0.9); // 90% of block limit
    
    console.log("💡 Recommended Gas Settings for Deployment:");
    console.log(`   Safe Gas Limit: ${recommendedGasLimit.toLocaleString()} gas (90% of block limit)`);
    console.log(`   Max Safe Gas Limit: ${Math.floor(blockGasLimit * 0.95).toLocaleString()} gas (95% of block limit)`);
    console.log(`   Current Gas Price: ${ethers.formatUnits(gasPrice.gasPrice, "gwei")} gwei\n`);

    // Get recent blocks to see gas usage patterns
    console.log("📊 Recent Block Gas Usage:");
    for (let i = 0; i < 5; i++) {
      try {
        const block = await ethers.provider.getBlock(latestBlock.number - i);
        const gasUsed = block.gasUsed;
        const gasUsedPercentage = ((gasUsed / block.gasLimit) * 100).toFixed(2);
        
        console.log(`   Block ${block.number}: ${gasUsed.toLocaleString()}/${block.gasLimit.toLocaleString()} gas (${gasUsedPercentage}% used)`);
      } catch (error) {
        break; // Stop if we can't get older blocks
      }
    }

    console.log("\n🎯 Deployment Recommendations:");
    console.log(`   • Use gasLimit: ${recommendedGasLimit.toLocaleString()} for safe deployments`);
    console.log(`   • Current gas price: ${ethers.formatUnits(gasPrice.gasPrice, "gwei")} gwei`);
    console.log(`   • Network supports EIP-1559: ${gasPrice.maxFeePerGas ? "Yes" : "No"}`);
    
    if (gasPrice.maxFeePerGas) {
      console.log(`   • For EIP-1559: maxFeePerGas: ${ethers.formatUnits(gasPrice.maxFeePerGas, "gwei")} gwei`);
      console.log(`   • For EIP-1559: maxPriorityFeePerGas: ${ethers.formatUnits(gasPrice.maxPriorityFeePerGas || 0, "gwei")} gwei`);
    }

    console.log("\n✅ Gas information retrieved successfully!");

  } catch (error) {
    console.error("❌ Error getting gas information:");
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
