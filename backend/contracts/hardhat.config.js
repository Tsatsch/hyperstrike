require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hyperevmTestnet: {
      url: process.env.HYPER_TESTNET_RPC ,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 998, 
      gasPrice: 200000000, // 0.2 gwei
  
    },
    
    hyperevmMainnet: {
      url: process.env.HYPER_MAINNET_RPC ,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 999, 
      gasPrice: 200000000, // 0.2 gwei
    },
    
    hardhat: {
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "hyperevmMainnet",
        chainId: 999, 
        urls: {
          apiURL: "https://explorer.hyperevm.com/api", 
          browserURL: "https://explorer.hyperevm.com", 
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
}; 