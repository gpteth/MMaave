// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../utils/OwnableUpgradeable.sol";
import "../interfaces/IAavePool.sol";

/**
 * @title AaveVault
 * @notice Deposits/withdraws USDT from AAVE V3 on BSC. Only authorized callers.
 *         Deployed behind an ERC1967 UUPS proxy.
 */
contract AaveVault is OwnableUpgradeable, ReentrancyGuard, Initializable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IAavePool public immutable aavePool;
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IERC20 public immutable usdt;
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IERC20 public immutable aToken;

    mapping(address => bool) public authorizedContracts;

    error NotAuthorized();
    error ZeroAmount();
    error ZeroAddress();

    event Deposited(uint256 amount);
    event Withdrawn(uint256 amount, address indexed to);
    event AuthorizationUpdated(address indexed contractAddr, bool authorized);

    modifier onlyAuthorized() {
        if (!authorizedContracts[msg.sender] && msg.sender != owner()) revert NotAuthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _aavePool, address _usdt, address _aToken) {
        aavePool = IAavePool(_aavePool);
        usdt = IERC20(_usdt);
        aToken = IERC20(_aToken);
        _disableInitializers();
    }

    function initialize(address _owner) external initializer {
        __Ownable_init(_owner);
    }

    // ======================== UUPS ========================

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setAuthorized(address contractAddr, bool authorized) external onlyOwner {
        authorizedContracts[contractAddr] = authorized;
        emit AuthorizationUpdated(contractAddr, authorized);
    }

    function deposit(uint256 amount) external onlyAuthorized nonReentrant {
        if (amount == 0) revert ZeroAmount();
        usdt.forceApprove(address(aavePool), amount);
        aavePool.supply(address(usdt), amount, address(this), 0);
        emit Deposited(amount);
    }

    function withdraw(uint256 amount, address to) external onlyAuthorized nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        aavePool.withdraw(address(usdt), amount, to);
        emit Withdrawn(amount, to);
    }

    function getBalance() external view returns (uint256) {
        return aToken.balanceOf(address(this));
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ======================== Storage Gap ========================

    uint256[49] private __gap;
}
