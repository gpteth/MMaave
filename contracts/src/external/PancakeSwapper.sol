// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../utils/OwnableUpgradeable.sol";
import "../interfaces/IPancakeRouter.sol";

/**
 * @title PancakeSwapper
 * @notice Buy-and-burn and buy-for-lock via PancakeSwap V3. Only authorized callers.
 *         Deployed behind an ERC1967 UUPS proxy.
 */
contract PancakeSwapper is OwnableUpgradeable, ReentrancyGuard, Initializable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IPancakeRouter public immutable swapRouter;
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IERC20 public immutable usdt;
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IERC20 public immutable mmToken;

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    uint256 public totalBurned;
    uint24 public poolFee;
    uint256 public slippageBps;

    mapping(address => bool) public authorizedContracts;

    error NotAuthorized();
    error ZeroAmount();
    error ZeroAddress();
    error SlippageTooHigh();

    event BoughtAndBurned(uint256 usdtAmount, uint256 mmBurned);
    event BoughtForLock(uint256 usdtAmount, uint256 mmLocked, address indexed user);
    event AuthorizationUpdated(address indexed contractAddr, bool authorized);

    modifier onlyAuthorized() {
        if (!authorizedContracts[msg.sender] && msg.sender != owner()) revert NotAuthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _swapRouter, address _usdt, address _mmToken) {
        swapRouter = IPancakeRouter(_swapRouter);
        usdt = IERC20(_usdt);
        mmToken = IERC20(_mmToken);
        _disableInitializers();
    }

    function initialize(address _owner) external initializer {
        __Ownable_init(_owner);
        poolFee = 2500;
        slippageBps = 500;
    }

    // ======================== UUPS ========================

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setAuthorized(address contractAddr, bool authorized) external onlyOwner {
        authorizedContracts[contractAddr] = authorized;
        emit AuthorizationUpdated(contractAddr, authorized);
    }

    function setSlippage(uint256 _slippageBps) external onlyOwner {
        if (_slippageBps > 2000) revert SlippageTooHigh();
        slippageBps = _slippageBps;
    }

    function setPoolFee(uint24 _fee) external onlyOwner {
        poolFee = _fee;
    }

    function buyAndBurn(uint256 usdtAmount, uint256 minAmountOut) external onlyAuthorized nonReentrant {
        if (usdtAmount == 0) revert ZeroAmount();

        usdt.forceApprove(address(swapRouter), usdtAmount);

        uint256 amountOut = swapRouter.exactInputSingle(
            IPancakeRouter.ExactInputSingleParams({
                tokenIn: address(usdt),
                tokenOut: address(mmToken),
                fee: poolFee,
                recipient: DEAD_ADDRESS,
                amountIn: usdtAmount,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );

        totalBurned += amountOut;
        emit BoughtAndBurned(usdtAmount, amountOut);
    }

    function buyForLock(uint256 usdtAmount, address user, uint256 minAmountOut) external onlyAuthorized nonReentrant {
        if (usdtAmount == 0) revert ZeroAmount();
        if (user == address(0)) revert ZeroAddress();

        usdt.forceApprove(address(swapRouter), usdtAmount);

        uint256 amountOut = swapRouter.exactInputSingle(
            IPancakeRouter.ExactInputSingleParams({
                tokenIn: address(usdt),
                tokenOut: address(mmToken),
                fee: poolFee,
                recipient: user,
                amountIn: usdtAmount,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );

        emit BoughtForLock(usdtAmount, amountOut, user);
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ======================== Storage Gap ========================

    uint256[46] private __gap;
}
