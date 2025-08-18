const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Main contract...");

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network chain ID:", network.chainId);
  
  // Get latest block to check gas limit
  const latestBlock = await ethers.provider.getBlock("latest");
  console.log("Latest block gas limit:", latestBlock.gasLimit.toString());
  console.log("Latest block base fee:", latestBlock.baseFeePerGas ? ethers.formatUnits(latestBlock.baseFeePerGas, "gwei") + " gwei" : "N/A");

  console.log("\n=== Deploying Main Contract ===");
  
  // Get the Main contract factory
  const Main = await ethers.getContractFactory("Main");
  
  // Deploy Main with automatic gas estimation
  const mainContract = await Main.deploy({
    gasPrice: ethers.parseUnits("20", "gwei") // 20 gwei
  });
  
  // Wait for deployment to complete
  console.log("Waiting for Main contract deployment confirmation...");
  await mainContract.waitForDeployment();
  const mainContractAddress = await mainContract.getAddress();
  
  console.log("Main contract deployed to:", mainContractAddress);
  console.log("Main contract transaction hash:", mainContract.deploymentTransaction?.hash || "N/A");
  
  console.log("\n=== Contract Addresses ===");
  console.log("Main Contract:", mainContractAddress);
  console.log("Deployer/Owner:", await mainContract.owner());
  
  console.log("\n🎉 CONTRACT SUCCESSFULLY DEPLOYED! 🎉");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
