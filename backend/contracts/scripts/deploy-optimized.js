const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying optimized PriceTriggerSwapV2 to HyperEVM testnet...");

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
  
  // Deploy WHYPE with automatic gas estimation
  const whype = await WHYPE.deploy({
    gasPrice: ethers.parseUnits("20", "gwei") // 20 gwei
  });
  
  // Wait for deployment to complete
  console.log("Waiting for WHYPE deployment confirmation...");
  await whype.waitForDeployment();
  const whypeAddress = await whype.getAddress();
  
  console.log("WHYPE deployed to:", whypeAddress);
  console.log("WHYPE transaction hash:", whype.deploymentTransaction?.hash || "N/A");

  console.log("\n=== Deploying PriceTriggerSwapV2 Contract ===");
  
  // Get the PriceTriggerSwapV2 contract factory
  const PriceTriggerSwapV2 = await ethers.getContractFactory("PriceTriggerSwapV2");
  
  // Deploy PriceTriggerSwapV2 with automatic gas estimation
  const priceTriggerSwap = await PriceTriggerSwapV2.deploy({
    gasPrice: ethers.parseUnits("20", "gwei") // 20 gwei
  });
  
  // Wait for deployment to complete
  console.log("Waiting for PriceTriggerSwapV2 deployment confirmation...");
  await priceTriggerSwap.waitForDeployment();
  const priceTriggerSwapAddress = await priceTriggerSwap.getAddress();
  
  console.log("PriceTriggerSwapV2 deployed to:", priceTriggerSwapAddress);
  console.log("PriceTriggerSwapV2 transaction hash:", priceTriggerSwap.deploymentTransaction?.hash || "N/A");

  // Verify the deployments
  console.log("\n=== Deployment Summary ===");
  console.log("✅ WHYPE Token Contract deployed successfully!");
  console.log("✅ PriceTriggerSwapV2 Contract deployed successfully!");
  
  console.log("\n=== Contract Addresses ===");
  console.log("WHYPE Token:", whypeAddress);
  console.log("PriceTriggerSwapV2:", priceTriggerSwapAddress);
  console.log("Deployer/Owner:", await priceTriggerSwap.owner());
  
  console.log("\n🎉 OPTIMIZED CONTRACTS SUCCESSFULLY DEPLOYED ON HYPEREVM TESTNET! 🎉");
  
  console.log("\n=== User Flow Integration ===");
  console.log("1. User wraps HYPE using WHYPE contract if needed");
  console.log("2. User calls approveTokens() on PriceTriggerSwapV2");
  console.log("3. Backend monitors prices and calls withdrawOnTrigger() when conditions are met");
  console.log("4. Backend uses GLUEX API to swap tokens");
  console.log("5. Backend sends swapped tokens to user's recipient address");
  
  console.log("\n=== Key Functions ===");
  console.log("- approveTokens(token, amount): User approves tokens for withdrawal");
  console.log("- withdrawOnTrigger(user, token, amount): Backend withdraws tokens on price trigger");
  console.log("- getUserApprovedTokens(user): Get all approved tokens for a user");
  console.log("- getApprovedAmount(user, token): Get approved amount for specific token");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
