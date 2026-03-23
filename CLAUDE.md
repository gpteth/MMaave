# Memepro - BSC DeFi 投资平台

## 项目概述
Memepro 是部署在 BSC Mainnet 上的 DeFi 投资平台，包含智能合约和 Next.js 前端。

## 技术栈

### 智能合约
- Solidity 0.8.22 + Foundry (forge/cast/anvil)
- UUPS 代理模式 (ERC-1967)
- OpenZeppelin Contracts 5.0.0
- 外部集成: Aave, PancakeSwap

### 前端
- Next.js 16.1.6 (App Router, standalone 输出)
- React 19.2.3 + TypeScript 5
- Ethers.js 6.16.0
- TanStack React Query 5
- Tailwind CSS v4

## 合约架构
```
MPStorage → MPConfig → MPInvestment → MPBonus → MPRestart → MemePlus (UUPS)
```
- 主合约代理: `0xd81e5c893972ad0818C8DA38cdE80caD7BEd8F46`
- 合约源码: `contracts/src/core/`
- 测试: `contracts/test/`
- 部署脚本: `contracts/script/`

## 前端结构
- 页面: `src/app/` (dashboard, invest, wallet, team, admin)
- 组件: `src/components/` (ui, layout, providers, invest, wallet, team, admin, shared)
- Hooks: `src/hooks/` (useInvestment, useWithdraw, useTeamData, useDynamicBonus...)
- 配置: `src/lib/` (contracts.ts, abi.ts, i18n.ts, utils.ts)

## 部署
- 服务器: AWS EC2 (13.213.71.197), Nginx 反向代理 80→3000
- 构建: `npm run build` (standalone)
- 合约部署: `forge script` + `contracts/upgrade.sh`

## 开发规范

### 合约开发
- 严格执行 checks-effects-interactions 模式
- 升级时保证存储布局兼容性
- 使用 custom errors，避免 require 字符串
- 测试覆盖率 >95%

### 前端开发
- TypeScript 严格模式
- 组件使用函数式 + Hooks
- 服务端数据用 TanStack Query
- 样式用 Tailwind utility classes

### 安全要求
- 合约: ReentrancyGuard, SafeERC20, 访问控制
- 前端: 输入验证, 安全头, HTTPS
- 基础设施: SSH 密钥, 防火墙, 环境变量安全

## 可用 Agents
- `solidity-engineer` - 智能合约开发和优化
- `frontend-developer` - 前端开发和性能优化
- `code-reviewer` - 代码审查
- `security-auditor` - 安全审计
- `devops` - 部署和运维
