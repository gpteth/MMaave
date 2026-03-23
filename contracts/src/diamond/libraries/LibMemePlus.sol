// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../AppStorage.sol";
import "../interfaces/IPancakeSwapper.sol";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                LibMemePlus - 业务逻辑共享库                                  ║
// ║                                                                              ║
// ║  ⚠️ 修改注意事项:                                                            ║
// ║  1. library 的代码会内联编译到调用它的 facet 中                               ║
// ║     — 修改此库后需重新部署所有引用它的 facet                                  ║
// ║  2. library 中的 event 需要重新声明（Solidity 要求）                          ║
// ║     — 保持与 Modifiers.sol 中的 event 签名一致                               ║
// ║  3. 此库直接操作 AppStorage，修改逻辑时注意存储一致性                         ║
// ║  4. 涉及资金转移的函数（processStaticIncome）需特别审慎                       ║
// ║  5. 遍历推荐链时有 MAX_DEPTH=30 的限制，防止 gas 耗尽                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/// @title LibMemePlus - MemePlus 各 facet 共享的内部业务逻辑
/// @dev 包含: 注册、团队业绩、V等级升级、收益分配、日收益领取等核心逻辑
///      所有函数均为 internal，编译时内联到调用方的 facet 字节码中
library LibMemePlus {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /// @dev 推荐链遍历最大深度
    uint256 internal constant MAX_DEPTH = 30;

    // ======================== Events ========================
    // library 中 emit 事件需重新声明（Solidity 限制）
    // ⚠️ 签名必须与 Modifiers.sol 中一致，否则前端监听会出错

    event MemberRegistered(address indexed user, address indexed referrer);
    event BalanceUpdated(address indexed user, uint256 newBalance);
    event VLevelUpgraded(address indexed user, uint8 oldLevel, uint8 newLevel);
    event ReferralRewardPaid(address indexed investor, address indexed referrer, uint256 amount, uint8 generation);
    event TeamRewardPaid(address indexed investor, address indexed ancestor, uint256 amount, uint8 rewardType);
    event CommunityIncomePaid(address indexed investor, address indexed ancestor, uint256 amount, uint8 level);
    event OrderCapped(address indexed user, uint256 orderIndex);
    event DailyReturnClaimed(address indexed user, uint256 totalReturn);

    /// @dev 团队奖类型标识
    uint8 internal constant REWARD_LEVEL_DIFF = 1;   // 级差奖
    uint8 internal constant REWARD_SAME_LEVEL = 2;    // 平级奖

    // ════════════════════════════════════════════════════════════════
    //                        注册 (Registration)
    // ════════════════════════════════════════════════════════════════

    /// @notice 注册新会员
    /// @dev 被 InvestmentFacet.register() 和 InvestmentFacet.invest() 调用
    /// @param s AppStorage 引用
    /// @param user 新注册用户地址
    /// @param referrer 推荐人地址（可为 address(0) 表示无推荐人）
    function registerMember(AppStorage storage s, address user, address referrer) internal {
        if (user == referrer) revert CannotReferSelf();
        // 推荐人必须已注册（或为零地址 = 无推荐人）
        if (referrer != address(0) && !s.isMemberRegistered[referrer]) revert ReferrerNotRegistered();

        Member storage member = s.members[user];
        member.referrer = referrer;
        member.isActive = true;
        s.isMemberRegistered[user] = true;
        s.allMembers.push(user);

        // 更新推荐人的直推列表和计数
        if (referrer != address(0)) {
            s.directReferrals[referrer].push(user);
            s.members[referrer].directReferralCount++;
        }

        emit MemberRegistered(user, referrer);
    }

    // ════════════════════════════════════════════════════════════════
    //                   团队业绩 (Team Performance)
    // ════════════════════════════════════════════════════════════════

    /// @notice 向上更新推荐链上所有祖先的团队业绩
    /// @dev 每笔投资后调用，沿推荐链向上遍历最多 MAX_DEPTH 层
    ///      同时检查是否触发 V 等级升级
    /// @param s AppStorage 引用
    /// @param user 投资用户地址
    /// @param amount 投资金额
    function updateTeamPerformance(AppStorage storage s, address user, uint256 amount) internal {
        address current = user;
        for (uint256 i; i < MAX_DEPTH;) {
            address upline = s.members[current].referrer;
            if (upline == address(0)) break;    // 到达推荐链顶端

            // 累加 upline 的总团队业绩
            uint256 newTeamPerf = s.teamPerformance[upline] + amount;
            s.teamPerformance[upline] = newTeamPerf;
            // 累加 upline → current 分支的业绩（用于小区计算）
            s.branchPerformance[upline][current] += amount;

            // 检查是否满足下一个 V 等级门槛
            uint8 currentVLevel = s.members[upline].vLevel;
            if (currentVLevel < 7 && newTeamPerf >= _getVLevelThreshold(s, currentVLevel)) {
                updateVLevel(s, upline);
            }

            current = upline;
            unchecked { ++i; }
        }
    }

    // ════════════════════════════════════════════════════════════════
    //                    V等级升级 (V-Level Upgrade)
    // ════════════════════════════════════════════════════════════════

    /// @notice 检查并升级用户的 V 等级
    /// @dev V 等级由"小区业绩"（团队业绩 - 最大分支业绩）决定
    ///      V1-V6 对应 vLevelThresholds[0]-[5]，V7 对应 vLevelThreshold7
    function updateVLevel(AppStorage storage s, address user) internal {
        Member storage member = s.members[user];
        uint8 currentLevel = member.vLevel;

        // 尝试逐级升级（可能一次跳多级）
        for (uint8 targetLevel = currentLevel + 1; targetLevel <= 7; targetLevel++) {
            uint256 smallZone = getSmallZonePerformance(s, user);
            uint256 threshold = targetLevel <= 6
                ? s.vLevelThresholds[targetLevel - 1]
                : s.vLevelThreshold7;
            if (smallZone < threshold) break;

            member.vLevel = targetLevel;
            emit VLevelUpgraded(user, currentLevel, targetLevel);
        }
    }

    /// @notice 计算用户的小区业绩
    /// @dev 小区业绩 = 总团队业绩 - 最大分支业绩
    ///      这确保 V 等级基于多线发展，而非单线
    function getSmallZonePerformance(AppStorage storage s, address user) internal view returns (uint256) {
        address[] storage refs = s.directReferrals[user];
        uint256 total = s.teamPerformance[user];
        uint256 maxBranch;
        uint256 len = refs.length;

        // 找出最大分支业绩
        for (uint256 i; i < len;) {
            uint256 branchPerf = s.branchPerformance[user][refs[i]];
            if (branchPerf > maxBranch) maxBranch = branchPerf;
            unchecked { ++i; }
        }

        // 小区 = 总业绩 - 最大分支
        return total > maxBranch ? total - maxBranch : 0;
    }

    // ════════════════════════════════════════════════════════════════
    //                 收益封顶 (Earnings with 2.5x Cap)
    // ════════════════════════════════════════════════════════════════

    /// @notice 为用户增加收益（受 2.5x 封顶限制）
    /// @dev 封顶计算: cap = totalInvested * capMultiplier / 100
    ///      当 totalEarned >= cap 时不再增加任何收益
    /// @param s AppStorage 引用
    /// @param user 目标用户
    /// @param amount 待增加的收益金额
    function addEarningsWithCap(AppStorage storage s, address user, uint256 amount) internal {
        Member storage member = s.members[user];
        // 封顶金额 = 总投资 × 封顶倍数 (默认 250 即 2.5x)
        uint256 cap = (uint256(member.totalInvested) * s.capMultiplier) / 100;

        // 已达封顶，直接返回
        if (member.totalEarned >= cap) return;

        uint256 remaining;
        unchecked { remaining = cap - member.totalEarned; }
        // 取 amount 和 remaining 的较小值
        uint256 actual = amount > remaining ? remaining : amount;

        if (actual > 0) {
            member.balance += actual.toUint128();
            member.totalEarned += actual.toUint128();
            emit BalanceUpdated(user, member.balance);
        }
    }

    // ════════════════════════════════════════════════════════════════
    //               静态收益处理 (Static Income Processing)
    // ════════════════════════════════════════════════════════════════

    /// @notice 处理静态收益的三向分配
    /// @dev 静态收益分配比例 (默认):
    ///      - 60% (staticToBalance) → 用户余额（受 2.5x 封顶）
    ///      - 15% (staticToBurn)    → PancakeSwap 买入 MM 并销毁
    ///      - 25% (staticToLock)    → PancakeSwap 买入 MM 并锁仓给用户
    /// @param s AppStorage 引用
    /// @param user 用户地址
    /// @param amount 静态收益总额
    function processStaticIncome(AppStorage storage s, address user, uint256 amount) internal {
        uint256 toBalance = (amount * s.staticToBalance) / 10000;
        uint256 toBurn = (amount * s.staticToBurn) / 10000;
        uint256 toLock = amount - toBalance - toBurn;   // 剩余部分防止精度丢失

        // PancakeSwap 操作（失败时将份额转入余额，不阻塞结算）
        address swapperAddr = s.pancakeSwapper;
        uint256 swapperTotal = toBurn + toLock;
        bool swapSuccess;

        if (swapperTotal > 0 && swapperAddr != address(0)) {
            // 使用 try-catch 避免 PancakeSwap 失败导致整个结算回滚
            try IERC20(s.usdt).transferFrom(s.receiverWallet, swapperAddr, swapperTotal) returns (bool ok) {
                if (ok) {
                    swapSuccess = true;
                    if (toBurn > 0) {
                        try IPancakeSwapper(swapperAddr).buyAndBurn(toBurn, 0) {} catch {}
                    }
                    if (toLock > 0) {
                        try IPancakeSwapper(swapperAddr).buyForLock(toLock, user, 0) {} catch {}
                    }
                }
            } catch {}
        }

        // Swap 成功: 只有 toBalance 进余额; 失败: 全部金额进余额
        uint256 balanceAmount = swapSuccess ? toBalance : toBalance + swapperTotal;
        if (balanceAmount > 0) {
            addEarningsWithCap(s, user, balanceAmount);
        }
    }

    // ════════════════════════════════════════════════════════════════
    //          上线奖励分配 (Upline Rewards: Referral + Team)
    // ════════════════════════════════════════════════════════════════

    /// @notice 分配推荐奖、团队奖和平级奖（沿推荐链向上）
    /// @dev 推荐奖规则:
    ///      - 第1代: referralGen1 (默认 50%)，需直推 ≥1 人解锁
    ///      - 第2代: referralGen2 (默认 50%)，需直推 ≥2 人解锁
    ///      - 最多解锁 2 代推荐奖
    ///
    ///      团队奖规则 (级差制):
    ///      - 沿推荐链向上找更高 V 等级的祖先
    ///      - 奖励 = teamPool × (当前V级费率 - 已支付最高费率)
    ///
    ///      平级奖:
    ///      - 独立资金池 (动态的 10%)
    ///      - 遇到同 V 等级祖先时发放（仅一次）
    ///
    /// @param s AppStorage 引用
    /// @param investor 投资者地址
    /// @param referralPool 推荐奖资金池 (动态的 20%)
    /// @param teamPool 团队奖资金池 (动态的 70%)
    /// @param sameLevelPool 平级奖资金池 (动态的 10%)
    function distributeUplineRewards(
        AppStorage storage s,
        address investor,
        uint256 referralPool,
        uint256 teamPool,
        uint256 sameLevelPool
    ) internal {
        address current = investor;
        uint8 gen;                  // 当前代数 (1-based)
        uint8 highestLevelPaid;     // 已支付的最高 V 等级
        bool sameLevelPaid;         // 本轮平级奖是否已发放

        // 缓存到 stack 变量减少 SLOAD
        uint256 _referralGen1 = s.referralGen1;
        uint256 _referralGen2 = s.referralGen2;

        for (uint256 i; i < MAX_DEPTH;) {
            address upline = s.members[current].referrer;
            if (upline == address(0)) break;

            unchecked { gen++; }

            Member storage uplineMember = s.members[upline];

            // 跳过非活跃、冻结、暂停的上线
            if (uplineMember.isActive && !uplineMember.isFrozen && !uplineMember.isPaused) {
                // ── 推荐奖 (最多2代) ──
                if (gen <= 2) {
                    // 直推人数决定解锁代数: 1人→1代, 2+人→2代
                    uint256 unlockedGens = uplineMember.directReferralCount;
                    if (unlockedGens > 2) unlockedGens = 2;
                    if (unlockedGens >= gen) {
                        uint256 rate = gen == 1 ? _referralGen1 : _referralGen2;

                        uint256 reward = (referralPool * rate) / 10000;
                        if (reward > 0) {
                            addEarningsWithCap(s, upline, reward);
                            emit ReferralRewardPaid(investor, upline, reward, gen);
                        }
                    }
                }

                // ── 团队奖 + 平级奖 (V等级级差制) ──
                uint8 uplineLevel = uplineMember.vLevel;
                if (uplineLevel > 0) {
                    // 平级奖: 同等级且尚未发放 — 从独立平级池发放
                    if (!sameLevelPaid && uplineLevel == highestLevelPaid) {
                        if (sameLevelPool > 0) {
                            addEarningsWithCap(s, upline, sameLevelPool);
                            emit TeamRewardPaid(investor, upline, sameLevelPool, REWARD_SAME_LEVEL);
                            sameLevelPaid = true;
                        }
                    }

                    // 级差奖: 发现更高等级时，按差额计算
                    if (uplineLevel > highestLevelPaid) {
                        uint256 currentRate = getVLevelRate(s, uplineLevel);
                        uint256 previousRate = getVLevelRate(s, highestLevelPaid);
                        if (currentRate > previousRate) {
                            uint256 diffRate;
                            unchecked { diffRate = currentRate - previousRate; }

                            uint256 reward = (teamPool * diffRate) / 10000;
                            if (reward > 0) {
                                addEarningsWithCap(s, upline, reward);
                                emit TeamRewardPaid(investor, upline, reward, REWARD_LEVEL_DIFF);
                            }
                        }
                        highestLevelPaid = uplineLevel;
                        sameLevelPaid = false;  // 重置平级标记
                    }
                }
            }

            current = upline;
            // 优化: 推荐奖已过2代且团队奖已到最高V7，提前退出
            if (gen >= 2 && highestLevelPaid >= 7) break;
            unchecked { ++i; }
        }
    }

    // ════════════════════════════════════════════════════════════════
    //                 社区收益 (Community Income)
    // ════════════════════════════════════════════════════════════════

    /// @notice 分配社区收益（按投资金额 × 级差比例）
    /// @dev 社区等级由管理员设置 (1-5)，与 V 等级独立
    ///      采用级差制: 只拿自己等级与下方已付出最高等级的差额
    ///      ⚠️ 社区收益不受 2.5x 封顶限制（直接加 balance）
    /// @param s AppStorage 引用
    /// @param investor 投资者地址
    /// @param orderAmount 投资订单金额
    function distributeCommunityIncome(AppStorage storage s, address investor, uint256 orderAmount) internal {
        address current = investor;
        uint8 highestLevelPaid;

        for (uint256 i; i < MAX_DEPTH;) {
            address upline = s.members[current].referrer;
            if (upline == address(0)) break;

            Member storage uplineMember = s.members[upline];

            if (uplineMember.isActive && !uplineMember.isFrozen && !uplineMember.isPaused) {
                uint8 communityLvl = uplineMember.communityLevel;

                // 只有更高等级才能拿级差奖励
                if (communityLvl > 0 && communityLvl > highestLevelPaid) {
                    uint256 currentRate = getCommunityRate(s, communityLvl);
                    uint256 previousRate = getCommunityRate(s, highestLevelPaid);

                    if (currentRate > previousRate) {
                        uint256 diffRate;
                        unchecked { diffRate = currentRate - previousRate; }

                        uint256 reward = (orderAmount * diffRate) / 10000;
                        if (reward > 0) {
                            // ⚠️ 注意: 社区收益直接加 balance，不走 addEarningsWithCap
                            uplineMember.balance += reward.toUint128();
                            s.communityEarned[upline] += reward;
                            emit CommunityIncomePaid(investor, upline, reward, communityLvl);
                        }
                    }
                    highestLevelPaid = communityLvl;
                }
            }

            current = upline;
            // 优化: 已到最高社区等级 5，提前退出
            if (highestLevelPaid >= 5) break;
            unchecked { ++i; }
        }
    }

    // ════════════════════════════════════════════════════════════════
    //                  日收益领取 (Daily Return Claim)
    // ════════════════════════════════════════════════════════════════

    /// @notice 领取用户所有活跃订单的日收益
    /// @dev 核心收益计算流程:
    ///      1. 遍历用户所有活跃订单
    ///      2. 计算每单应得收益 = amount × dailyReturnRate × epochsDue / 10000
    ///      3. 受单笔订单封顶限制 (amount × capMultiplier / 100)
    ///      4. 汇总后按 static/dynamic 比例分配:
    ///         - 静态部分 → processStaticIncome (余额+销毁+锁仓)
    ///         - 动态部分 → distributeUplineRewards (推荐奖+团队奖)
    ///
    /// @param s AppStorage 引用
    /// @param user 用户地址
    function claimDailyReturn(AppStorage storage s, address user) internal {
        Member storage member = s.members[user];
        if (!member.isActive) revert NotActive();
        if (member.isFrozen) revert AccountFrozen();
        if (member.isPaused) revert AccountPaused();

        Order[] storage userOrders = s.orders[user];
        uint256 orderCount = userOrders.length;
        uint256 totalDailyReturn;

        // 缓存到 stack 减少 SLOAD
        uint256 _dailyReturnRate = s.dailyReturnRate;
        uint256 _capMultiplier = s.capMultiplier;

        for (uint256 i; i < orderCount;) {
            Order storage order = userOrders[i];

            if (order.isActive) {
                uint256 epochsDue;

                // 兼容旧模式 (lastClaimedAt != 0 → 时间戳模式) 和新模式 (epoch 模式)
                if (order.lastClaimedAt != 0) {
                    // 旧模式: 按时间戳计算，然后迁移到 epoch 模式
                    epochsDue = (block.timestamp - order.lastClaimedAt) / 1 days;
                    order.lastClaimedAt = 0;                        // 清零，切换到 epoch 模式
                    order.lastClaimedEpoch = uint32(s.currentEpoch);
                } else {
                    // 新模式: 按 epoch 差值计算
                    epochsDue = s.currentEpoch - order.lastClaimedEpoch;
                    order.lastClaimedEpoch = uint32(s.currentEpoch);
                }

                if (epochsDue > 0) {
                    // 日收益 = 订单金额 × 日利率 × epoch数 / 10000
                    uint256 dailyReturn = (uint256(order.amount) * _dailyReturnRate * epochsDue) / 10000;

                    // 单笔订单封顶
                    uint256 orderCap = (uint256(order.amount) * _capMultiplier) / 100;
                    uint256 remainingCap;
                    unchecked {
                        remainingCap = orderCap > order.totalReturned ? orderCap - order.totalReturned : 0;
                    }

                    if (dailyReturn > remainingCap) dailyReturn = remainingCap;

                    if (dailyReturn > 0) {
                        order.totalReturned += dailyReturn.toUint128();
                        // 达到封顶则标记订单为非活跃
                        if (order.totalReturned >= orderCap.toUint128()) {
                            order.isActive = false;
                            emit OrderCapped(user, i);
                        }
                        totalDailyReturn += dailyReturn;
                    }
                }
            }
            unchecked { ++i; }
        }

        if (totalDailyReturn == 0) return;

        // ── 按比例分配总收益 ──
        // 静态部分 (默认 70%)
        uint256 staticAmount = (totalDailyReturn * s.staticPercent) / 10000;
        // 动态部分 (默认 30%)
        uint256 dynamicAmount = totalDailyReturn - staticAmount;

        // 处理静态收益 (余额 + PancakeSwap 销毁/锁仓)
        processStaticIncome(s, user, staticAmount);

        // 分配动态收益 (推荐奖 + 团队奖 + 平级奖)
        if (dynamicAmount > 0) {
            uint256 referralPool = (dynamicAmount * s.referralSharePercent) / 10000;   // 推荐池 (20%)
            uint256 teamPool = (dynamicAmount * s.teamSharePercent) / 10000;            // 团队池 (70%)
            uint256 sameLevelPool = dynamicAmount - referralPool - teamPool;            // 平级池 (10%, 防精度丢失)
            distributeUplineRewards(s, user, referralPool, teamPool, sameLevelPool);
        }

        emit DailyReturnClaimed(user, totalDailyReturn);
    }

    // ════════════════════════════════════════════════════════════════
    //                    费率查询 (Rate Helpers)
    // ════════════════════════════════════════════════════════════════

    /// @notice 获取 V 等级对应的团队奖费率
    /// @param level V 等级 (0-7)，0 返回 0
    function getVLevelRate(AppStorage storage s, uint8 level) internal view returns (uint256) {
        if (level == 0) return 0;
        if (level >= 7) return s.vLevelRate7;        // V7 或超出范围取 V7
        return s.vLevelRates[level - 1];
    }

    /// @notice 获取 V 等级对应的升级门槛（内部辅助）
    /// @param currentLevel 当前 V 等级 (0-6)，返回下一级门槛
    function _getVLevelThreshold(AppStorage storage s, uint8 currentLevel) internal view returns (uint256) {
        if (currentLevel < 6) return s.vLevelThresholds[currentLevel];
        return s.vLevelThreshold7;  // currentLevel == 6，返回 V7 门槛
    }

    /// @notice 获取社区等级对应的收益费率
    /// @param level 社区等级 (0-5)，0 返回 0
    function getCommunityRate(AppStorage storage s, uint8 level) internal view returns (uint256) {
        if (level == 0) return 0;
        if (level > 5) return s.communityRates[4];  // 超出范围取最高
        return s.communityRates[level - 1];
    }

    // ======================== Custom Errors (library 专用) ========================
    // ⚠️ library 不能继承 Modifiers，需重新声明用到的 error

    error NotActive();
    error AccountFrozen();
    error AccountPaused();
    error CannotReferSelf();
    error ReferrerNotRegistered();
}
