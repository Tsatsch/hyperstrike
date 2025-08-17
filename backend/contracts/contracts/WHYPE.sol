// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WHYPE
 * @dev Implementation of the Wrapped HYPE token contract
 * This contract allows users to wrap/unwrap native HYPE tokens
 */
contract WHYPE is ERC20, Ownable {
    
    // Events
    event Wrapped(address indexed user, uint256 amount);
    event Unwrapped(address indexed user, uint256 amount);
    
    constructor() ERC20("Wrapped HYPE", "WHYPE") Ownable(msg.sender) {}
    
    /**
     * @dev Wrap native HYPE tokens to WHYPE
     */
    function wrap() external payable {
        require(msg.value > 0, "Amount must be greater than 0");
        
        // Mint WHYPE tokens to the caller
        _mint(msg.sender, msg.value);
        
        emit Wrapped(msg.sender, msg.value);
    }
    
    /**
     * @dev Unwrap WHYPE tokens back to native HYPE
     * @param amount Amount of WHYPE tokens to unwrap
     */
    function unwrap(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient WHYPE balance");
        
        // Burn WHYPE tokens
        _burn(msg.sender, amount);
        
        // Transfer native HYPE tokens to the caller
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "HYPE transfer failed");
        
        emit Unwrapped(msg.sender, amount);
    }
    
    /**
     * @dev Mint WHYPE tokens (owner only)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev Burn WHYPE tokens from caller
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
    
    /**
     * @dev Burn WHYPE tokens from specified address (with approval)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address from, uint256 amount) external {
        uint256 currentAllowance = allowance(from, msg.sender);
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
    }
    
    /**
     * @dev Emergency withdraw - owner can withdraw any stuck native HYPE
     * @param amount Amount of HYPE to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient HYPE balance");
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "HYPE transfer failed");
    }
    
    /**
     * @dev Get the contract's native HYPE balance
     * @return Current HYPE balance
     */
    function getHYPEBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // Receive function to accept native HYPE deposits
    receive() external payable {}
}
