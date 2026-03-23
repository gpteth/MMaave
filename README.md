This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


 部署到 vercel 
vercel --prod --yes 2>&1 



更新页面# MMdapp

已读取全部合约代码。以下是 Diamond 版本的完整梳理：

  ---
  Memepro Diamond 合约架构总览

  架构模式：ERC-2535 Diamond

                            ┌─────────────────┐
                            │  Diamond (代理)   │  ← 用户调用入口
                            │  fallback()      │     所有调用通过 selector 路由
                            └────────┬────────┘
                                     │ delegatecall
                ┌────────────┬───────┼───────┬────────────┬──────────┐
                ▼            ▼       ▼       ▼            ▼          ▼
          DiamondCut    DiamondLoupe  Config  Investment  Withdraw  Restart
           Facet          Facet      Facet    Facet       Facet     Facet
                                                                      │
                                                                    View
                                                                    Facet

  两套独立存储

  ┌────────────────┬───────────────────────────────────────────────┬─────────────────────────────────────┐
  │      存储      │                   slot 定位                   │                内容                 │
  ├────────────────┼───────────────────────────────────────────────┼─────────────────────────────────────┤
  │ DiamondStorage │ keccak256("diamond.standard.diamond.storage") │ selector→facet 映射、owner、ERC-165 │
  ├────────────────┼───────────────────────────────────────────────┼─────────────────────────────────────┤
  │ AppStorage     │ keccak256("memepro.app.storage")              │ 所有业务数据（会员、订单、配置等）  │
  └────────────────┴───────────────────────────────────────────────┴─────────────────────────────────────┘

  ---
  核心文件职责

  1. Diamond.sol — 代理主合约

  - 部署后不可升级（它就是代理本体）
  - constructor：注册唯一的 diamondCut() selector
  - fallback()：核心路由 — 从 DiamondStorage 查找 msg.sig 对应的 facet 地址，delegatecall 执行

  2. AppStorage.sol — 共享状态定义

  所有 facet 通过 LibAppStorage.appStorage() 访问同一块存储。关键规则：APPEND-ONLY，绝不能删除/重排字段。

  核心结构体：
  - Member (4 slot) — 推荐人、V等级(0-6)、社区等级(0-5)、状态标记、投资/提现/余额/收益
  - Order (2 slot) — 订单金额、已返还额、创建时间、epoch追踪、活跃状态
  - RestartInfo — 未返还本金 + 推荐补偿已领额
  - TokenLock / BCKLock — MM/BCK 代币锁仓（线性释放）

  3. Modifiers.sol — 共享修饰器

  所有 facet 通过 is Modifiers 继承：
  - onlyOwner — Diamond owner (LibDiamond)
  - onlyAdmin — ADMIN_ROLE 或 owner
  - whenNotPaused — 全局暂停检查
  - nonReentrant — 自实现重入锁（AppStorage.reentrancyStatus）

  4. LibDiamond.sol — Diamond 核心库

  管理 selector↔facet 映射：
  - addFunctions / replaceFunctions / removeFunctions — 增删改 facet 函数
  - swap-and-pop 算法高效删除
  - initializeDiamondCut — diamondCut 后可选的初始化 delegatecall

  5. LibMemePlus.sol — 业务逻辑库

  所有核心计算逻辑集中在此，以 internal 函数形式内联到各 facet：

  ┌─────────────────────────────┬───────────────────────────────────────────────────────────────────────┐
  │            函数             │                                 功能                                  │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ registerMember()            │ 注册新会员，绑定推荐关系                                              │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ updateTeamPerformance()     │ 向上遍历推荐链（≤30层），累加团队/分支业绩，触发 V 等级升级           │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ updateVLevel()              │ 按小区业绩（总业绩 - 最大分支）逐级判断 V1→V6                         │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ addEarningsWithCap()        │ 增加收益，受 2.5x 封顶限制                                            │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ processStaticIncome()       │ 静态收益三向分配：60%余额 + 15% PancakeSwap买入销毁MM + 25%买入锁仓MM │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ distributeUplineRewards()   │ 推荐奖(3代) + 团队奖(V级差制) + 平级奖                                │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ distributeCommunityIncome() │ 社区收益级差分配（不受 2.5x 封顶）                                    │
  ├─────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ claimDailyReturn()          │ 遍历所有活跃订单计算日收益，按 static/dynamic 分配                    │
  └─────────────────────────────┴───────────────────────────────────────────────────────────────────────┘

  ---
  7 个 Facet 详解

  InvestmentFacet — 投资核心

  ┌────────────────────────────────┬────────────┬──────────────────────────────┐
  │              函数              │    权限    │             说明             │
  ├────────────────────────────────┼────────────┼──────────────────────────────┤
  │ register(referrer)             │ 任何人     │ 独立注册                     │
  ├────────────────────────────────┼────────────┼──────────────────────────────┤
  │ invest(amount, referrer)       │ 任何人     │ 投资 USDT（≥100, 100的倍数） │
  ├────────────────────────────────┼────────────┼──────────────────────────────┤
  │ settle()                       │ 任何人     │ 推进 epoch（每过 1 天 +1）   │
  ├────────────────────────────────┼────────────┼──────────────────────────────┤
  │ claimDailyReturn(user)         │ 本人/Admin │ 领取日收益                   │
  ├────────────────────────────────┼────────────┼──────────────────────────────┤
  │ batchClaimDailyReturn(users[]) │ Admin      │ 批量领取（≤50人）            │
  └────────────────────────────────┴────────────┴──────────────────────────────┘

  invest() 完整流程：
  1. 校验金额（≥100 USDT, 100的倍数）
  2. safeTransferFrom 用户 → Diamond
  3. 未注册则自动注册
  4. 创建 Order（绑定当前 epoch）
  5. 向上更新团队业绩 + V 等级检查
  6. safeTransfer Diamond → receiverWallet
  7. 分配社区收益
  8. 处理重启推荐补偿

  WithdrawFacet — 提现

  ┌─────────────────────────────┬───────┬────────────────────────────┐
  │            函数             │ 权限  │            说明            │
  ├─────────────────────────────┼───────┼────────────────────────────┤
  │ withdraw(amount)            │ 本人  │ 提现（≥10 USDT, 10的倍数） │
  ├─────────────────────────────┼───────┼────────────────────────────┤
  │ rescueTokens(token, amount) │ Owner │ 紧急取回误转代币           │
  └─────────────────────────────┴───────┴────────────────────────────┘

  提现流程： 扣余额 → 计算 5% 手续费 → safeTransferFrom(receiverWallet → user) 净额 + → feeCollector 手续费

  RestartFacet — 重启与补偿

  ┌───────────────────────────┬────────────┬────────────────────┐
  │           函数            │    权限    │        说明        │
  ├───────────────────────────┼────────────┼────────────────────┤
  │ restart(user)             │ Admin      │ 重启单个用户       │
  ├───────────────────────────┼────────────┼────────────────────┤
  │ globalRestart(users[])    │ Admin      │ 批量重启（≤100人） │
  ├───────────────────────────┼────────────┼────────────────────┤
  │ claimMMCompensation(user) │ 本人/Admin │ 领取 MM 代币补偿   │
  ├───────────────────────────┼────────────┼────────────────────┤
  │ claimBCKRelease(user)     │ 本人/Admin │ 领取 BCK 代币释放  │
  └───────────────────────────┴────────────┴────────────────────┘

  重启流程：
  1. 计算未返还本金 = totalInvested - totalWithdrawn
  2. MM 锁仓 = 未返还 × 30%（每日 1% 线性释放）
  3. BCK 锁仓 = 未返还 × 20% ÷ bckPrice（每日 1% 释放，需有活跃订单）
  4. 清零余额/收益/投资额，删除所有订单
  5. 标记 isRestarted=true, isActive=false

  ConfigFacet — 管理配置

  - Admin 管理（addAdmin/removeAdmin）— Owner Only
  - 会员控制（freeze/pause/setCommunityLevel/setVLevel）— Admin
  - 全局暂停 — Admin
  - 40+ 参数 setter — Admin
  - 30+ config getter — public view

  ViewFacet — 只读查询

  前端调用的数据接口：
  - getMemberInfo / getOrders / getDirectReferrals
  - getTeamPerformance / getBranchPerformance / getSmallZonePerformance
  - getRestartInfo / getTokenLock / getBCKLock
  - getTeamInfo（聚合查询）
  - getAllMembersCount / getMemberAtIndex / isMemberRegistered

  DiamondCutFacet + DiamondLoupeFacet — Diamond 标准

  - DiamondCut：添加/替换/移除 facet 函数（Owner Only）
  - DiamondLoupe：查询已注册的 facet 和 selector

  DiamondInit — 初始化合约

  首次部署时通过 diamondCut 的 _init 参数调用，设置：
  - ERC-165 接口支持
  - 外部合约地址（USDT, PancakeSwapper, MM, BCK）
  - 访问控制（owner + admin）
  - 重入锁初始化（reentrancyStatus = 1）
  - 所有默认配置参数

  ---
  资金流向图

  用户 invest() USDT
    │
    ├── USDT: user → Diamond → receiverWallet (全额)
    │
    └── 每日 settle() 后 claimDailyReturn():
         日收益 = 订单金额 × 0.8%
         │
         ├── 70% 静态收益
         │    ├── 60% → 用户余额 (受 2.5x 封顶)
         │    ├── 15% → USDT: receiverWallet → PancakeSwapper → 买MM销毁
         │    └── 25% → USDT: receiverWallet → PancakeSwapper → 买MM锁仓给用户
         │
         └── 30% 动态收益
              ├── 30% 推荐池 → 3代推荐人 (20%/5%/5%)
              └── 70% 团队池 → V级差奖 + 平级奖

  用户 withdraw():
    USDT: receiverWallet → user (95%) + feeCollector (5%)

  重启补偿:
    MM: Diamond → user (每日1%释放)
    BCK: Diamond → user (每日1%释放, 需有活跃订单)# MMaave
