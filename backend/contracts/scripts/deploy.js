const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying contracts to HyperEVM testnet...");

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network chain ID:", network.chainId);
  
  // Get latest block to check gas limit
  const latestBlock = await ethers.provider.getBlock("latest");
  console.log("Latest block gas limit:", latestBlock.gasLimit.toString());
  console.log("Latest block base fee:", latestBlock.baseFeePerGas ? ethers.formatUnits(latestBlock.baseFeePerGas, "gwei") + " gwei" : "N/A");

  console.log("\n=== Deploying WHYPE Token Contract ===");
  
  // Get the WHYPE contract factory
  const WHYPE = await ethers.getContractFactory("WHYPE");
  
  // Deploy WHYPE with explicit gas settings
  const whype = await WHYPE.deploy({
    gasLimit: 1000000, // 1M gas limit
    gasPrice: ethers.parseUnits("20", "gwei") // 20 gwei
  });
  
  // Wait for deployment to complete
  await whype.waitForDeployment();
  const whypeAddress = await whype.getAddress();
  
  console.log("WHYPE deployed to:", whypeAddress);
  console.log("WHYPE transaction hash:", whype.deploymentTransaction?.hash || "N/A");

  console.log("\n=== Deploying PriceTriggerSwap Contract ===");
  
  // Get the PriceTriggerSwap contract factory
  const PriceTriggerSwap = await ethers.getContractFactory("PriceTriggerSwap");

  // Deploy PriceTriggerSwap with explicit gas settings
  const priceTriggerSwap = await PriceTriggerSwap.deploy({
    gasLimit: 2000000, // 1M gas limit
    gasPrice: ethers.parseUnits("20", "gwei") // 20 gwei
  });
  
  // Wait for deployment to complete
  await priceTriggerSwap.waitForDeployment();
  const priceTriggerSwapAddress = await priceTriggerSwap.getAddress();

  console.log("PriceTriggerSwap deployed to:", priceTriggerSwapAddress);
  console.log("PriceTriggerSwap transaction hash:", priceTriggerSwap.deploymentTransaction?.hash || "N/A");

  // Verify the deployments
  console.log("\n=== Deployment Summary ===");
  console.log("✅ WHYPE Token Contract deployed successfully!");
  console.log("✅ PriceTriggerSwap Contract deployed successfully!");
  
  console.log("\n=== Contract Addresses ===");
  console.log("WHYPE Token:", whypeAddress);
  console.log("PriceTriggerSwap:", priceTriggerSwapAddress);
  console.log("Deployer/Owner:", await priceTriggerSwap.owner());
  
  console.log("\n🎉 ALL CONTRACTS SUCCESSFULLY DEPLOYED ON HYPEREVM TESTNET! 🎉");
  console.log("\nNext Steps:");
  console.log("1. Verify both contracts on HyperEVM testnet explorer");
  console.log("2. Test basic functionality of both contracts");
  console.log("3. Configure PriceTriggerSwap with WHYPE address");
  console.log("4. Test integration between contracts");
  console.log("5. Gradually add more features and test each one");
  
  console.log("\nContract Details:");
  console.log("- WHYPE: Wrapped HYPE token implementation");
  console.log("- PriceTriggerSwap: Automated swap contract with GlueX Router integration");
  console.log("- Both contracts are now ready for testing and configuration");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 