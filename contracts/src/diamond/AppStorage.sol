// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                    ERC-2535 Diamond Storage (AppStorage)                     ║
// ║                                                                              ║
// ║  ⚠️ 修改注意事项 (MODIFICATION RULES):                                       ║
// ║  1. 只能在末尾追加新字段，绝不能删除/重排已有字段 (APPEND-ONLY)                ║
// ║  2. 不能修改已有字段的类型（如 uint128 → uint256 会破坏存储布局）              ║
// ║  3. 不能在 struct 中间插入新字段（会移动后续字段的 slot 偏移）                 ║
// ║  4. 新增 mapping 是安全的（mapping 不占连续 slot）                            ║
// ║  5. 新增固定大小数组需注意占用的 slot 数量                                     ║
// ║  6. 所有 facet 共享同一份 AppStorage，修改后必须验证所有 facet 的兼容性         ║
// ║  7. 修改 struct（Member/Order 等）同样遵循 APPEND-ONLY 规则                   ║
// ║  8. 部署新 facet 前务必在测试环境验证存储布局一致性                             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/// @title AppStorage - Diamond 共享存储结构
/// @notice 所有 facet 通过 LibAppStorage.appStorage() 访问同一个存储位置
/// @dev 使用 Diamond Storage 模式 (keccak256 定位 slot)，非继承式存储

/// @dev 会员信息结构体 - 每个注册用户一份
/// 字段紧凑打包以节省 gas（多个小类型共享一个 storage slot）
struct Member {
    // --- Slot 1: 地址 + 状态标志 (20 + 1+1+1+1+1+1 = 26 bytes, 单 slot) ---
    address referrer;           // 推荐人地址
    uint8 vLevel;               // V等级 (0-7)，由团队业绩自动升级
    uint8 communityLevel;       // 社区等级 (0-5)，由管理员手动设置
    bool isActive;              // 是否活跃（有活跃订单）
    bool isFrozen;              // 是否被冻结（管理员操作，完全禁止）
    bool isPaused;              // 是否被暂停（管理员操作，暂时禁止）
    bool isRestarted;           // 是否已重启（触发重启机制后标记）
    // --- Slot 2: 投资/提现汇总 ---
    uint128 totalInvested;      // 累计投资额 (USDT, 18 decimals)
    uint128 totalWithdrawn;     // 累计提现额 (USDT, 18 decimals)
    // --- Slot 3: 余额/收益汇总 ---
    uint128 balance;            // 可提现余额 (USDT, 18 decimals)
    uint128 totalEarned;        // 累计收益（用于 2.5x 封顶判断）
    // --- Slot 4: 直推数 + 上次领取时间 ---
    uint32 directReferralCount; // 直推人数（解锁推荐代数：1人→1代, 2人→2代, 3+人→3代）
    uint32 lastClaimTimestamp;  // 上次领取时间戳（预留字段）
}

/// @dev 投资订单结构体 - 每笔投资生成一个
struct Order {
    // --- Slot 1 ---
    uint128 amount;             // 订单金额 (USDT, 18 decimals)
    uint128 totalReturned;      // 该订单已返还金额（达到 amount * capMultiplier/100 时封顶）
    // --- Slot 2 ---
    uint32 createdAt;           // 创建时间戳
    uint32 lastClaimedAt;       // 上次领取时间戳（旧模式，迁移后清零）
    bool isActive;              // 是否活跃（封顶后变 false）
    uint32 lastClaimedEpoch;    // 上次领取对应的 epoch 编号
}

/// @dev 重启信息 - 用户被重启时记录，用于后续补偿计算
struct RestartInfo {
    uint128 unreturnedCapital;  // 未返还本金 = totalInvested - totalWithdrawn
    uint128 referralEarned;     // 已通过推荐补偿获得的金额（有上限: unreturnedCapital * restartReferralCap/100）
}

/// @dev MM 代币锁仓 - 重启时按比例锁定 MM 代币作为补偿
struct TokenLock {
    uint128 amount;             // 剩余锁仓量（领取后递减）
    uint128 originalAmount;     // 初始锁仓量（用于计算可释放上限）
    uint32 lockedAt;            // 锁仓时间戳（用于计算已过天数）
}

/// @dev BCK 代币锁仓 - 重启时按比例锁定 BCK 代币
struct BCKLock {
    uint128 amount;             // 剩余锁仓量
    uint128 originalAmount;     // 初始锁仓量
    uint32 lockedAt;            // 锁仓时间戳
}

/// @dev 主存储结构 - 所有 facet 共享的状态
/// ⚠️ 只能在末尾追加新字段！
struct AppStorage {
    // ======================== 会员数据 ========================
    mapping(address => Member) members;                          // 用户 → 会员信息
    mapping(address => Order[]) orders;                          // 用户 → 投资订单数组
    mapping(address => address[]) directReferrals;               // 用户 → 直推列表
    mapping(address => uint256) teamPerformance;                 // 用户 → 团队总业绩
    mapping(address => mapping(address => uint256)) branchPerformance; // 用户 → 直推 → 该分支业绩
    mapping(address => RestartInfo) restartInfo;                 // 用户 → 重启信息
    mapping(address => TokenLock) tokenLocks;                    // 用户 → MM 锁仓
    mapping(address => BCKLock) bckLocks;                        // 用户 → BCK 锁仓
    mapping(address => uint256) communityEarned;                 // 用户 → 社区收益累计
    address[] allMembers;                                        // 所有会员地址列表（用于遍历）
    mapping(address => bool) isMemberRegistered;                 // 用户是否已注册

    // ======================== Epoch 结算系统 ========================
    uint256 currentEpoch;       // 当前 epoch 编号（每次 settle() 递增）
    uint256 lastSettledAt;      // 上次结算时间戳

    // ======================== 访问控制 ========================
    mapping(address => bool) isAdmin;                            // 管理员标记（快速查询用）
    mapping(bytes32 => mapping(address => bool)) roles;          // role hash → 地址 → 是否拥有

    // ======================== 配置参数 (BPS = 基点, 10000 = 100%) ========================
    uint16 dailyReturnRate;       // 日收益率 (BPS)，默认 80 = 0.8%
    uint16 staticPercent;         // 静态收益占比 (BPS)，默认 7000 = 70%
    uint16 dynamicPercent;        // 动态收益占比 (BPS)，默认 3000 = 30%
    uint16 staticToBalance;       // 静态→余额比例 (BPS)，默认 6000 = 60%
    uint16 staticToBurn;          // 静态→销毁比例 (BPS)，默认 1500 = 15%
    uint16 staticToLock;          // 静态→锁仓比例 (BPS)，默认 2500 = 25%
    uint16 referralGen1;          // 第1代推荐奖比例 (BPS)，默认 2000 = 20%
    uint16 referralGen2;          // 第2代推荐奖比例 (BPS)，默认 500 = 5%
    uint16 referralGen3;          // 第3代推荐奖比例 (BPS)，默认 500 = 5%
    uint16 referralSharePercent;  // 推荐池占动态比例 (BPS)，默认 3000 = 30%
    uint16 teamSharePercent;      // 团队池占动态比例 (BPS)，默认 7000 = 70%
    uint16 capMultiplier;         // 收益封顶倍数 (百分比)，默认 250 = 2.5x
    uint16 withdrawalFee;         // 提现手续费 (BPS)，默认 500 = 5%
    uint128 minInvestment;        // 最低投资额，默认 100 USDT
    uint128 minWithdrawal;        // 最低提现额，默认 10 USDT
    uint16 sameLevelBonus;        // 平级奖比例 (BPS)，默认 1000 = 10%
    uint128[6] vLevelThresholds;  // V1-V6 升级门槛（小区业绩）
    uint16[6] vLevelRates;        // V1-V6 团队奖比例 (BPS)
    uint16[5] communityRates;     // 社区等级 1-5 的收益比例 (BPS)
    uint16 restartMMCompPercent;  // 重启时 MM 补偿比例 (BPS)，默认 3000 = 30%
    uint16 restartReferralRate;   // 重启推荐补偿比例 (BPS)，默认 1000 = 10%
    uint16 restartReferralCap;    // 重启推荐补偿上限 (百分比)，默认 150 = 1.5x
    uint16 restartMMReleaseRate;  // MM 每日释放比例 (BPS)，默认 100 = 1%
    uint16 perpetualBCKPercent;   // BCK 永续锁仓比例 (BPS)，默认 2000 = 20%
    uint256 bckPrice;             // BCK 价格 (USDT per BCK, 18 decimals)
    address receiverWallet;       // 资金接收钱包（投资转入/提现转出）
    bool paused;                  // 全局暂停开关
    uint256 settlementInterval;   // 结算间隔（默认 1 days）

    // ======================== 外部合约地址 ========================
    address usdt;                 // USDT 合约地址 (BSC)
    address pancakeSwapper;       // PancakeSwap 交换合约
    address mmToken;              // MM 代币合约
    address bckToken;             // BCK 代币合约

    // ======================== MemePlus 专属 ========================
    address feeCollector;         // 手续费收集地址

    // ======================== 重入锁 ========================
    uint256 reentrancyStatus;     // 1 = 未进入, 2 = 已进入（初始化时设为 1）

    // ======================== V7 扩展 (存储布局安全追加) ========================
    uint128 vLevelThreshold7;     // V7 升级门槛（小区业绩）
    uint16 vLevelRate7;           // V7 团队奖比例 (BPS)

    // ======================== 平级奖独立池 (V2 追加) ========================
    uint16 sameLevelSharePercent; // 平级池占动态比例 (BPS)，默认 1000 = 10%
                                  // referralSharePercent + teamSharePercent + sameLevelSharePercent = 10000

    // ======================== Aave 集成 (V3 追加) ========================
    address aaveVault;              // AaveVault 代理地址（入金 supply / 出金 withdraw）

    // ======================== Aave 开关 (V4 追加) ========================
    bool useAave;                   // 是否启用 Aave 出入金（true=经 Aave, false=经 receiverWallet）

    // ⚠️ 新字段只能追加在此处！
}

/// @title LibAppStorage - 通过 Diamond Storage 模式定位 AppStorage
/// @dev 使用 keccak256("memepro.app.storage") 确定存储位置
///      所有 facet 调用 LibAppStorage.appStorage() 获取同一个 storage 引用
library LibAppStorage {
    /// @dev 存储位置 = keccak256("memepro.app.storage")
    /// 这个值在编译时确定，确保所有 facet 读写同一块存储
    bytes32 constant APP_STORAGE_POSITION = keccak256("memepro.app.storage");

    /// @notice 获取 AppStorage 的 storage 引用
    /// @dev 通过 assembly 将 storage pointer 指向 keccak256 计算出的 slot
    function appStorage() internal pure returns (AppStorage storage s) {
        bytes32 position = APP_STORAGE_POSITION;
        assembly {
            s.slot := position
        }
    }
}
