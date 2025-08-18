// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title Main
 * @dev Smart contract for automated token swaps on HyperEVM
 * Backend controls all trigger logic, contract handles allowances and transfers
 */
contract Main is Ownable, ReentrancyGuard, Pausable {
    
    // Events
    event TokensApproved(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    
    event TokensWithdrawn(
        address indexed user,
        address indexed token,
        uint256 amount,
        address indexed withdrawalWallet,
        uint256 timestamp
    );
    
    event ProtocolFeeUpdated(
        uint256 oldFee,
        uint256 newFee,
        uint256 timestamp
    );
    
    // State variables - simplified
    mapping(address => mapping(address => uint256)) public userTokenAllowances; // user => token => amount
    mapping(address => address[]) public userApprovedTokens; // user => array of approved tokens
    
    // Protocol fee (in basis points, 100 = 1%)
    uint256 public protocolFee = 50; // 0.5%
    uint256 public constant MAX_FEE = 500; // 5%
    
    // Dedicated wallet for receiving withdrawn tokens
    address public constant WITHDRAWAL_WALLET = 0x9E02783Ad42C5A94a0De60394f2996E44458B782;
    
    // Modifiers
    modifier onlyOwnerOrAuthorized() {
        require(msg.sender == owner() || msg.sender == address(this), "Not authorized");
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Update protocol fee
     * @param newFee New fee in basis points
     */
    function setProtocolFee(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_FEE, "Fee too high");
        uint256 oldFee = protocolFee;
        protocolFee = newFee;
        emit ProtocolFeeUpdated(oldFee, newFee, block.timestamp);
    }
    
    /**
     * @dev Approve tokens for the contract to spend (internal allowance only)
     * Note: Users must also call token.approve(contractAddress, amount) directly
     * @param token Address of the token to approve
     * @param amount Amount to approve
     */
    function approveTokens(address token, uint256 amount) external whenNotPaused {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Invalid amount");
        
        // Check if user has sufficient balance
        IERC20 tokenContract = IERC20(token);
        require(tokenContract.balanceOf(msg.sender) >= amount, "Insufficient token balance");
        
        // Update internal allowance
        userTokenAllowances[msg.sender][token] = amount;
        
        // Add token to user's approved list if not already there
        if (!_isTokenInUserList(msg.sender, token)) {
            userApprovedTokens[msg.sender].push(token);
        }
        
        emit TokensApproved(msg.sender, token, amount, block.timestamp);
    }
    
    /**
     * @dev Increase token allowance
     * @param token Address of the token
     * @param amount Amount to increase allowance by
     */
    function increaseAllowance(address token, uint256 amount) external whenNotPaused {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Invalid amount");
        
        // Check if user has sufficient balance for new total
        IERC20 tokenContract = IERC20(token);
        uint256 currentAllowance = userTokenAllowances[msg.sender][token];
        uint256 newTotal = currentAllowance + amount;
        require(tokenContract.balanceOf(msg.sender) >= newTotal, "Insufficient token balance for new allowance");
        
        // Update allowance
        userTokenAllowances[msg.sender][token] = newTotal;
        
        // Add token to user's approved list if not already there
        if (!_isTokenInUserList(msg.sender, token)) {
            userApprovedTokens[msg.sender].push(token);
        }
        
        emit TokensApproved(msg.sender, token, newTotal, block.timestamp);
    }
    
    /**
     * @dev Decrease token allowance
     * @param token Address of the token
     * @param amount Amount to decrease allowance by
     */
    function decreaseAllowance(address token, uint256 amount) external whenNotPaused {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Invalid amount");
        
        uint256 currentAllowance = userTokenAllowances[msg.sender][token];
        require(amount <= currentAllowance, "Decrease amount exceeds current allowance");
        
        // Update allowance
        userTokenAllowances[msg.sender][token] = currentAllowance - amount;
        
        // Remove token from user's approved list if allowance becomes 0
        if (userTokenAllowances[msg.sender][token] == 0) {
            _removeTokenFromUserList(msg.sender, token);
        }
        
        emit TokensApproved(msg.sender, token, userTokenAllowances[msg.sender][token], block.timestamp);
    }
    
    /**
     * @dev Revoke all allowances for a specific token
     * @param token Address of the token
     */
    function revokeAllowance(address token) external whenNotPaused {
        require(token != address(0), "Invalid token address");
        
        uint256 currentAllowance = userTokenAllowances[msg.sender][token];
        require(currentAllowance > 0, "No allowance to revoke");
        
        // Set allowance to 0
        userTokenAllowances[msg.sender][token] = 0;
        
        // Remove token from user's approved list
        _removeTokenFromUserList(msg.sender, token);
        
        emit TokensApproved(msg.sender, token, 0, block.timestamp);
    }
    
    /**
     * @dev Get all tokens approved by a specific user
     * @param user Address of the user
     * @return tokens Array of approved token addresses
     */
    function getUserApprovedTokens(address user) external view returns (address[] memory tokens) {
        return userApprovedTokens[user];
    }
    
    /**
     * @dev Get internal approved amount for a specific token
     * @param user Address of the user
     * @param token Address of the token
     * @return amount Internal approved amount
     */
    function getApprovedAmount(address user, address token) external view returns (uint256 amount) {
        return userTokenAllowances[user][token];
    }
    
    /**
     * @dev Get ERC20 allowance for a specific token
     * @param user Address of the user
     * @param token Address of the token
     * @return amount ERC20 allowance amount
     */
    function getERC20Allowance(address user, address token) external view returns (uint256 amount) {
        IERC20 tokenContract = IERC20(token);
        return tokenContract.allowance(user, address(this));
    }
    
    /**
     * @dev Check if both allowances are properly set for a user and token
     * @param user Address of the user
     * @param token Address of the token
     * @return internalAmount Internal allowance amount
     * @return erc20Amount ERC20 allowance amount
     * @return isReady True if both allowances are sufficient for withdrawal
     */
    function checkAllowanceStatus(address user, address token) external view returns (
        uint256 internalAmount, 
        uint256 erc20Amount, 
        bool isReady
    ) {
        internalAmount = userTokenAllowances[user][token];
        erc20Amount = IERC20(token).allowance(user, address(this));
        isReady = (internalAmount > 0 && erc20Amount > 0);
        return (internalAmount, erc20Amount, isReady);
    }
    
    /**
     * @dev Withdraw approved tokens when price trigger is hit (called by backend)
     * @param user Address of the user
     * @param token Address of the token to withdraw
     * @param amount Amount to withdraw
     */
    function withdrawOnTrigger(
        address user,
        address token,
        uint256 amount
    ) external onlyOwnerOrAuthorized nonReentrant whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Invalid amount");
        
        // Check if user has approved this token
        require(userTokenAllowances[user][token] >= amount, "Insufficient allowance");
        
        // Check if user has sufficient balance
        IERC20 tokenContract = IERC20(token);
        require(tokenContract.balanceOf(user) >= amount, "Insufficient user balance");
        
        // Calculate protocol fee
        uint256 feeAmount = (amount * protocolFee) / 10000;
        uint256 transferAmount = amount - feeAmount;
        
        // Transfer tokens from user to dedicated withdrawal wallet (minus fee)
        require(tokenContract.transferFrom(user, WITHDRAWAL_WALLET, transferAmount), "Transfer failed");
        
        // Transfer fee to protocol (owner)
        if (feeAmount > 0) {
            require(tokenContract.transferFrom(user, owner(), feeAmount), "Fee transfer failed");
        }
        
        // Update allowance
        userTokenAllowances[user][token] -= amount;
        
        // Remove token from user's approved list if allowance becomes 0
        if (userTokenAllowances[user][token] == 0) {
            _removeTokenFromUserList(user, token);
        }
        
        emit TokensWithdrawn(user, token, amount, WITHDRAWAL_WALLET, block.timestamp);
    }
    
    /**
     * @dev Emergency function to withdraw stuck tokens
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner whenNotPaused {
        IERC20(token).transfer(WITHDRAWAL_WALLET, amount);
    }
    
    /**
     * @dev Emergency function to withdraw stuck HYPE
     * @param amount Amount of HYPE to withdraw
     */
    function emergencyWithdrawETH(uint256 amount) external onlyOwner whenNotPaused {
        require(amount <= address(this).balance, "Insufficient HYPE balance");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "HYPE transfer failed");
    }
    
    /**
     * @dev Internal function to check if token is in user's approved list
     * @param user Address of the user
     * @param token Address of the token to check
     * @return bool True if token is in the list
     */
    function _isTokenInUserList(address user, address token) internal view returns (bool) {
        address[] storage userTokens = userApprovedTokens[user];
        
        for (uint256 i = 0; i < userTokens.length; i++) {
            if (userTokens[i] == token) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Internal function to remove token from user's approved list
     * @param user Address of the user
     * @param token Address of the token to remove
     */
    function _removeTokenFromUserList(address user, address token) internal {
        address[] storage userTokens = userApprovedTokens[user];
        
        for (uint256 i = 0; i < userTokens.length; i++) {
            if (userTokens[i] == token) {
                // Replace with last element and pop
                userTokens[i] = userTokens[userTokens.length - 1];
                userTokens.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {
        // Allow direct ETH deposits
    }
    
    /**
     * @dev Fallback function
     */
    fallback() external payable {
        // Reject unexpected calls
        revert("Unexpected call");
    }
}
