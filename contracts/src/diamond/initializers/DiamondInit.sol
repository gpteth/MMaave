// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../AppStorage.sol";
import "../libraries/LibDiamond.sol";
import "../interfaces/IDiamondLoupe.sol";
import "../interfaces/IDiamondCut.sol";
import "../interfaces/IERC173.sol";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                  DiamondInit - Diamond 初始化合约                            ║
// ║                                                                              ║
// ║  ⚠️ 修改注意事项:                                                            ║
// ║  1. init() 通过 diamondCut 的 _init 参数以 delegatecall 方式调用             ║
// ║     — 执行上下文是 Diamond 合约的存储                                         ║
// ║  2. 初始化逻辑只应执行一次（首次部署时）                                      ║
// ║     — 后续升级 facet 时应使用单独的 migration initializer                     ║
// ║  3. 如果需要为新 facet 初始化新的 AppStorage 字段:                            ║
// ║     — 创建新的 initializer 合约（如 DiamondInitV2）                           ║
// ║     — 在 diamondCut 调用中作为 _init 传入                                     ║
// ║  4. 不要修改此合约中已有的默认值（已部署的合约使用这些值初始化过）             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/// @title DiamondInit - 首次部署时的初始化逻辑
/// @notice 通过 diamondCut() 的 _init 参数以 delegatecall 调用
/// @dev 设置 ERC-165 接口支持、AppStorage 默认配置参数、外部合约地址等
contract DiamondInit {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @dev 初始化参数结构体 — 通过 calldata 传入避免 stack too deep
    struct InitArgs {
        address owner;              // Diamond owner / 初始管理员
        address admin;              // 额外管理员地址
        address feeCollector;       // 手续费收集地址
        address receiverWallet;     // 资金接收钱包
        address usdt;               // USDT 合约地址
        address pancakeSwapper;     // PancakeSwap 交换合约
        address mmToken;            // MM 代币合约
        address bckToken;           // BCK 代币合约
    }

    /// @notice 执行初始化（仅在首次部署时调用一次）
    /// @dev 通过 delegatecall 执行，写入的是 Diamond 的存储
    function init(InitArgs calldata args) external {
        // ── 注册 ERC-165 接口支持 ──
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;

        // ── 初始化 AppStorage ──
        AppStorage storage s = LibAppStorage.appStorage();

        // 外部合约地址
        s.usdt = args.usdt;
        s.pancakeSwapper = args.pancakeSwapper;
        s.mmToken = args.mmToken;
        s.bckToken = args.bckToken;

        // MemePlus 专属地址
        s.feeCollector = args.feeCollector;
        s.receiverWallet = args.receiverWallet;

        // 访问控制 — owner + admin 均获得 ADMIN_ROLE
        s.roles[ADMIN_ROLE][args.owner] = true;
        s.isAdmin[args.owner] = true;
        if (args.admin != address(0)) {
            s.roles[ADMIN_ROLE][args.admin] = true;
            s.isAdmin[args.admin] = true;
        }

        // 重入锁初始化 — ⚠️ 必须设为 1，否则 nonReentrant 会永久锁定
        s.reentrancyStatus = 1;

        // ══════════════ 默认配置参数 ══════════════

        s.dailyReturnRate = 80;              // 0.8% 日收益率
        s.staticPercent = 7000;              // 70% 静态占比
        s.dynamicPercent = 3000;             // 30% 动态占比
        s.staticToBalance = 6000;            // 静态中 60% → 余额
        s.staticToBurn = 1500;               // 静态中 15% → 买入销毁
        s.staticToLock = 2500;               // 静态中 25% → 买入锁仓
        s.referralGen1 = 5000;               // 第1代推荐奖 50% (池的50% = 绝对10%)
        s.referralGen2 = 5000;               // 第2代推荐奖 50% (池的50% = 绝对10%)
        s.referralGen3 = 0;                  // 第3代推荐奖 取消
        s.referralSharePercent = 2000;       // 动态中推荐池 20%
        s.teamSharePercent = 7000;           // 动态中团队池 70%
        s.capMultiplier = 250;               // 2.5x 收益封顶
        s.withdrawalFee = 500;               // 5% 提现手续费
        s.minInvestment = 100e18;            // 最低投资 100 USDT
        s.minWithdrawal = 10e18;             // 最低提现 10 USDT
        s.sameLevelBonus = 1000;             // 平级奖 10%

        // 平级池占动态比例 (20% + 70% + 10% = 100%)
        s.sameLevelSharePercent = 1000;      // 平级池 10%

        // V等级门槛（小区业绩, USDT 18 decimals）
        s.vLevelThresholds = [
            uint128(3_000e18),               // V1: 3,000
            uint128(10_000e18),              // V2: 10,000
            uint128(50_000e18),              // V3: 50,000
            uint128(150_000e18),             // V4: 150,000
            uint128(500_000e18),             // V5: 500,000
            uint128(1_000_000e18)            // V6: 1,000,000
        ];

        // V等级团队奖费率 (BPS)
        s.vLevelRates = [
            uint16(1000),                    // V1: 10%
            uint16(2000),                    // V2: 20%
            uint16(3000),                    // V3: 30%
            uint16(4000),                    // V4: 40%
            uint16(5000),                    // V5: 50%
            uint16(6000)                     // V6: 60%
        ];

        // V7 扩展
        s.vLevelThreshold7 = 2_000_000e18;   // V7: 2,000,000
        s.vLevelRate7 = 7000;                 // V7: 70%

        // 社区等级收益费率 (BPS) — 注意: 递减排列
        s.communityRates = [
            uint16(2000),                    // 社区1: 20%
            uint16(1800),                    // 社区2: 18%
            uint16(1500),                    // 社区3: 15%
            uint16(1000),                    // 社区4: 10%
            uint16(500)                      // 社区5: 5%
        ];

        // 重启机制参数
        s.restartMMCompPercent = 3000;       // 重启 MM 补偿 30%
        s.restartReferralRate = 1000;        // 重启推荐补偿 10%
        s.restartReferralCap = 150;          // 重启推荐补偿上限 1.5x
        s.restartMMReleaseRate = 100;        // MM 每日释放 1%
        s.perpetualBCKPercent = 2000;        // BCK 永续锁仓 20%

        // 结算系统
        s.settlementInterval = 1 days;       // 每日结算
        s.lastSettledAt = block.timestamp;   // 从部署时开始计时
    }
}
