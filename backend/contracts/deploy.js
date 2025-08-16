const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying PriceTriggerSwap contract with GlueX Router integration...");

  // Get the contract factory
  const PriceTriggerSwap = await ethers.getContractFactory("PriceTriggerSwap");

  // Deploy the contract
  const priceTriggerSwap = await PriceTriggerSwap.deploy();
  await priceTriggerSwap.deployed();

  console.log("PriceTriggerSwap deployed to:", priceTriggerSwap.address);
  console.log("Transaction hash:", priceTriggerSwap.deployTransaction.hash);

  // Verify the deployment
  console.log("Contract deployed successfully!");
  console.log("Owner:", await priceTriggerSwap.owner());
  console.log("Protocol fee:", await priceTriggerSwap.protocolFee());
  console.log("Estimated gas per swap:", ethers.utils.formatEther(await priceTriggerSwap.estimatedGasPerSwap()));
  
  // Important: Set the required addresses after deployment
  console.log("\nIMPORTANT: After deployment, you need to:");
  console.log("1. Set the actual GlueX Router address in the contract");
  console.log("2. Set the actual HYPE token address");
  console.log("3. Configure authorized callers (backend services)");
  console.log("4. Adjust gas estimation based on actual GlueX Router gas costs");
  console.log("5. Test the GlueX Router integration on testnet");
  
  console.log("\nGlueX Router Integration Notes:");
  console.log("- Contract now uses GlueX Router for all swaps");
  console.log("- Implement proper swap data formatting based on GlueX interface");
  console.log("- Handle GlueX Router response parsing correctly");
  console.log("- Test with small amounts before mainnet deployment");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 