// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IWHYPE
 * @dev Interface for the Wrapped HYPE token contract
 * This interface defines the functions needed for wrapping/unwrapping native HYPE tokens
 */
interface IWHYPE is IERC20 {
    /**
     * @dev Mint WHYPE tokens to a specified address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external;
    
    /**
     * @dev Burn WHYPE tokens from a specified address
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external;
    
    /**
     * @dev Burn WHYPE tokens from a specified address (with approval)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address from, uint256 amount) external;
    
    /**
     * @dev Get the total supply of WHYPE tokens
     * @return Total supply
     */
    function totalSupply() external view returns (uint256);
    
    /**
     * @dev Get the balance of WHYPE tokens for a specified address
     * @param account Address to check balance for
     * @return Balance of WHYPE tokens
     */
    function balanceOf(address account) external view returns (uint256);
}