// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AppStorage.sol";
import "./libraries/LibDiamond.sol";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                   Modifiers - 所有 Facet 的共享修饰器                        ║
// ║                                                                              ║
// ║  ⚠️ 修改注意事项:                                                            ║
// ║  1. 新增 modifier 不影响存储布局，可安全添加                                  ║
// ║  2. 修改已有 modifier 的逻辑会影响所有使用它的 facet                          ║
// ║     — 需重新部署所有引用该 modifier 的 facet                                  ║
// ║  3. 新增 error/event 是安全的（不占 storage slot）                            ║
// ║  4. 常量 (constant) 不占存储，可安全增删改                                    ║
// ║  5. 此合约是 abstract，不能单独部署，只能被 facet 继承                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/// @title Modifiers - 所有 MemePlus facet 共享的修饰器、错误和事件
/// @notice facet 通过 `contract XxxFacet is Modifiers` 继承这些修饰器
/// @dev abstract 合约 — 提供访问控制、暂停检查、重入保护等横切关注点
abstract contract Modifiers {
    /// @dev 上溯推荐链的最大深度，防止 gas 耗尽
    uint256 internal constant MAX_DEPTH = 30;

    /// @dev 角色标识符 — 用于 roles mapping 中的 key
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    // ======================== Custom Errors ========================
    // 使用 custom error 替代 require 字符串，节省部署和调用 gas

    error NotOwner();               // 仅 owner 可调用
    error NotAdmin();               // 仅 admin/owner 可调用
    error NotActive();              // 用户未激活
    error AccountFrozen();          // 账户已冻结
    error AccountPaused();          // 账户已暂停
    error AlreadyRegistered();      // 重复注册
    error CannotReferSelf();        // 不能推荐自己
    error NotRegistered();          // 未注册
    error BelowMinInvestment();     // 低于最低投资额
    error NotMultipleOf100();       // 投资额需为 100 的倍数
    error BelowMinWithdrawal();     // 低于最低提现额
    error NotMultipleOf10();        // 提现额需为 10 的倍数
    error InsufficientBalance();    // 余额不足
    error ZeroAmount();             // 金额为零
    error ZeroAddress();            // 地址为零
    error NothingToRestart();       // 无需重启
    error NotRestarted();           // 用户未被重启
    error NoMMToClaim();            // 无 MM 可领取
    error NoBCKToClaim();           // 无 BCK 可领取
    error NoActiveOrders();         // 无活跃订单
    error TooEarly();               // 时间未到
    error InvalidLevel();           // 无效等级
    error ArrayLengthMismatch();    // 数组长度不匹配
    error FeeTooHigh();             // 费率过高
    error MustSumTo10000();         // 比例之和必须为 10000
    error ContractPaused();         // 合约已暂停
    error InvalidIndex();           // 无效索引
    error BatchTooLarge();          // 批量操作数量超限
    error ReferrerNotRegistered();  // 推荐人未注册
    error ReentrancyGuardReentrantCall(); // 重入攻击

    // ======================== Events ========================

    event MemberRegistered(address indexed user, address indexed referrer);
    event Invested(address indexed user, uint256 amount, address indexed referrer);
    event OrderCreated(address indexed user, uint256 amount, uint256 index);
    event OrderCapped(address indexed user, uint256 orderIndex);
    event DailyReturnClaimed(address indexed user, uint256 totalReturn);
    event BalanceUpdated(address indexed user, uint256 newBalance);
    event ReferralRewardPaid(address indexed investor, address indexed referrer, uint256 amount, uint8 generation);
    event TeamRewardPaid(address indexed investor, address indexed ancestor, uint256 amount, uint8 rewardType);
    event CommunityIncomePaid(address indexed investor, address indexed ancestor, uint256 amount, uint8 level);
    event VLevelUpgraded(address indexed user, uint8 oldLevel, uint8 newLevel);
    event Withdrawn(address indexed user, uint256 grossAmount, uint256 fee, uint256 netAmount);
    event AccountRestarted(address indexed user, uint256 unreturnedCapital);
    event ReferralCompensationClaimed(address indexed restartedUser, address indexed referredUser, uint256 amount);
    event MMCompensationClaimed(address indexed user, uint256 amount);
    event BCKLocked(address indexed user, uint256 bckAmount, uint256 unreturnedCapital);
    event BCKReleased(address indexed user, uint256 amount);
    event GlobalRestartExecuted(uint256 count);
    event AdminAdded(address indexed account);
    event AdminRemoved(address indexed account);
    event ParameterUpdated(string name, uint256 value);
    event EpochSettled(uint256 indexed epoch, uint256 timestamp);
    event Paused();
    event Unpaused();

    // ======================== Modifiers ========================

    /// @dev 仅 Diamond owner（DiamondStorage.contractOwner）可调用
    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    /// @dev 仅 ADMIN_ROLE 持有者或 owner 可调用
    modifier onlyAdmin() {
        AppStorage storage s = LibAppStorage.appStorage();
        if (!s.roles[ADMIN_ROLE][msg.sender] && msg.sender != LibDiamond.contractOwner()) revert NotAdmin();
        _;
    }

    /// @dev 合约未暂停时才可执行
    modifier whenNotPaused() {
        AppStorage storage s = LibAppStorage.appStorage();
        if (s.paused) revert ContractPaused();
        _;
    }

    /// @dev 重入保护 — 使用 AppStorage.reentrancyStatus（1=未进入, 2=已进入）
    /// ⚠️ 初始化时必须将 reentrancyStatus 设为 1（在 DiamondInit 中完成）
    modifier nonReentrant() {
        AppStorage storage s = LibAppStorage.appStorage();
        if (s.reentrancyStatus == 2) revert ReentrancyGuardReentrantCall();
        s.reentrancyStatus = 2;
        _;
        s.reentrancyStatus = 1;
    }
}
