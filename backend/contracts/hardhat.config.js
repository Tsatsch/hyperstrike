require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // HyperEVM testnet (replace with actual network details)
    hyperevmTestnet: {
      url: process.env.HYPER_TESTNET_RPC || "https://testnet-rpc.hyperevm.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1337, // Replace with actual HyperEVM testnet chain ID
      gasPrice: 20000000000, // 20 gwei
    },
    // HyperEVM mainnet (replace with actual network details)
    hyperevmMainnet: {
      url: process.env.HYPER_MAINNET_RPC || "https://withered-delicate-sailboat.hype-mainnet.quiknode.pro/edb38026d62fb1de9d51e057b4b720a455f8b9d8/evm",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1, // Replace with actual HyperEVM mainnet chain ID
      gasPrice: 20000000000, // 20 gwei
    },
    // Local development
    hardhat: {
      chainId: 31337,
    },
  },
  etherscan: {
    // Add HyperEVM explorer URL when available
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "hyperevmTestnet",
        chainId: 1337, // Replace with actual chain ID
        urls: {
          apiURL: "https://testnet-explorer.hyperevm.com/api", // Replace with actual URL
          browserURL: "https://testnet-explorer.hyperevm.com", // Replace with actual URL
        },
      },
      {
        network: "hyperevmMainnet",
        chainId: 1, // Replace with actual chain ID
        urls: {
          apiURL: "https://explorer.hyperevm.com/api", // Replace with actual URL
          browserURL: "https://explorer.hyperevm.com", // Replace with actual URL
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
}; 