"use client";

import { useWeb3 } from "@/contexts/Web3Context";
import { useState, useEffect, useCallback } from "react";
import { useAdminActions } from "@/hooks/useAdminActions";
import { Contract, type InterfaceAbi } from "ethers";
import { ADDRESSES } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import ConnectButton from "@/components/shared/ConnectButton";

export default function OperationsPage() {
  const { isConnected, address, readProvider } = useWeb3();
  const adminActions = useAdminActions(address ?? undefined);
  const [creditAddress, setCreditAddress] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [settleAddress, setSettleAddress] = useState("");
  const [batchSettleAddresses, setBatchSettleAddresses] = useState("");
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [addAdminAddress, setAddAdminAddress] = useState("");
  const [removeAdminAddress, setRemoveAdminAddress] = useState("");
  const [receiverWalletAddress, setReceiverWalletAddress] = useState("");
  const [actionLog, setActionLog] = useState<
    { time: string; action: string; status: string }[]
  >([]);

  // Daily settlement state
  const [epochInfo, setEpochInfo] = useState<{
    currentEpoch: bigint;
    lastSettledAt: bigint;
    settlementInterval: bigint;
    totalMembers: bigint;
  } | null>(null);
  const [settlementProgress, setSettlementProgress] = useState("");
  const [isSettling, setIsSettling] = useState(false);

  const logAction = (action: string, status: "success" | "error") => {
    setActionLog((prev) => [
      {
        time: new Date().toISOString().slice(0, 16).replace("T", " "),
        action,
        status,
      },
      ...prev,
    ]);
  };

  const fetchEpochInfo = useCallback(async () => {
    if (!readProvider) return;
    try {
      const mp = new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider);
      const [epoch, lastSettled, interval, total] = await Promise.all([
        mp.currentEpoch(),
        mp.lastSettledAt(),
        mp.settlementInterval(),
        mp.getAllMembersCount(),
      ]);
      setEpochInfo({
        currentEpoch: epoch,
        lastSettledAt: lastSettled,
        settlementInterval: interval,
        totalMembers: total,
      });
    } catch (e) {
      console.error("fetchEpochInfo error:", e);
    }
  }, [readProvider]);

  useEffect(() => {
    fetchEpochInfo();
  }, [fetchEpochInfo]);

  const handleDailySettlement = async () => {
    if (!readProvider) return;
    setIsSettling(true);
    try {
      const mp = new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider);

      // Step 1: Fetch all active members (DSR auto-settles epochs, no need for settle())
      setSettlementProgress("正在获取活跃会员列表...");
      const totalMembers = Number(await mp.getAllMembersCount());
      const activeUsers: string[] = [];

      for (let i = 0; i < totalMembers; i++) {
        const addr = await mp.getMemberAtIndex(i);
        const info = await mp.getMemberInfo(addr);
        // info[3] = isActive, info[4] = isFrozen, info[5] = isPaused
        if (info[3] && !info[4] && !info[5]) {
          activeUsers.push(addr);
        }
      }

      if (activeUsers.length === 0) {
        setSettlementProgress("");
        logAction("没有需要结算的活跃会员", "success");
        setIsSettling(false);
        await fetchEpochInfo();
        return;
      }

      // Step 2: Batch claim in groups of 50
      const batchSize = 50;
      const batches = Math.ceil(activeUsers.length / batchSize);
      for (let b = 0; b < batches; b++) {
        const batch = activeUsers.slice(b * batchSize, (b + 1) * batchSize);
        setSettlementProgress(
          `正在结算第 ${b + 1}/${batches} 批（共 ${activeUsers.length} 人）...`
        );
        await adminActions.batchClaimDailyReturn(batch);
      }

      logAction(`每日结算完成：共 ${activeUsers.length} 个活跃会员`, "success");
      setSettlementProgress("");
      await fetchEpochInfo();
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; reason?: string; message?: string };
      logAction(
        `每日结算失败：${err?.shortMessage || err?.reason || err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
      setSettlementProgress("");
    } finally {
      setIsSettling(false);
    }
  };

  const handleCreditTopUp = async () => {
    if (!creditAddress || !creditAmount) return;
    try {
      // creditBalance 接受 bigint，将 USDT 数量转为 wei
      const amountWei =
        BigInt(Math.round(parseFloat(creditAmount) * 1e6)) * BigInt(1e12);
      await (adminActions as unknown as Record<string, (a: string, b: bigint) => Promise<unknown>>).creditBalance(creditAddress, amountWei);
      logAction(
        `充值余额：${creditAddress.slice(0, 6)}...${creditAddress.slice(-4)} +${creditAmount} USDT`,
        "success"
      );
      setCreditAddress("");
      setCreditAmount("");
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      logAction(
        `充值失败：${err?.shortMessage || err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
    }
  };

  const handleSettle = async () => {
    if (!settleAddress) return;
    try {
      await adminActions.batchClaimDailyReturn([settleAddress]);
      logAction(
        `手动结算：${settleAddress.slice(0, 6)}...${settleAddress.slice(-4)}`,
        "success"
      );
      setSettleAddress("");
    } catch (e: unknown) {
      const err = e as { message?: string };
      logAction(
        `结算失败：${err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
    }
  };

  const handleBatchSettle = async () => {
    const users = batchSettleAddresses
      .split("\n")
      .map((a) => a.trim())
      .filter((a) => a.startsWith("0x") && a.length === 42);
    if (users.length === 0) return;
    try {
      await adminActions.batchClaimDailyReturn(users);
      logAction(`批量结算：共 ${users.length} 个地址`, "success");
      setBatchSettleAddresses("");
    } catch (e: unknown) {
      const err = e as { message?: string };
      logAction(
        `批量结算失败：${err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
    }
  };

  const handleAddAdmin = async () => {
    if (!addAdminAddress) return;
    try {
      await adminActions.addAdmin(addAdminAddress);
      logAction(
        `已添加管理员：${addAdminAddress.slice(0, 6)}...${addAdminAddress.slice(-4)}`,
        "success"
      );
      setAddAdminAddress("");
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      logAction(
        `添加管理员失败：${err?.shortMessage || err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
    }
  };

  const handleRemoveAdmin = async () => {
    if (!removeAdminAddress) return;
    try {
      await adminActions.removeAdmin(removeAdminAddress);
      logAction(
        `已移除管理员：${removeAdminAddress.slice(0, 6)}...${removeAdminAddress.slice(-4)}`,
        "success"
      );
      setRemoveAdminAddress("");
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      logAction(
        `移除管理员失败：${err?.shortMessage || err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
    }
  };

  const handleSetReceiverWallet = async () => {
    if (!receiverWalletAddress) return;
    try {
      await adminActions.setReceiverWallet(receiverWalletAddress);
      logAction(
        `收款钱包已设置：${receiverWalletAddress.slice(0, 6)}...${receiverWalletAddress.slice(-4)}`,
        "success"
      );
      setReceiverWalletAddress("");
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      logAction(
        `设置收款钱包失败：${err?.shortMessage || err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
    }
  };

  const handleGlobalRestart = async () => {
    try {
      // globalRestart 接受用户数组，此处触发全局重启传空数组由合约内部处理
      await adminActions.globalRestart([]);
      logAction("全局重启已触发", "success");
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      logAction(
        `全局重启失败：${err?.shortMessage || err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
    }
    setConfirmRestart(false);
  };

  const handleEmergencyPause = async () => {
    try {
      if (isPaused) {
        await adminActions.unpause();
        logAction("平台已恢复正常运行", "success");
      } else {
        await adminActions.pause();
        logAction("紧急暂停已激活，所有操作已停止", "success");
      }
      setIsPaused(!isPaused);
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      logAction(
        `暂停/恢复失败：${err?.shortMessage || err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
    }
    setConfirmPause(false);
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card glow-accent text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">请先连接钱包</h2>
          <p className="text-muted">连接您的钱包后才能访问管理后台</p>
          <div className="mt-4">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <a
          href="/admin"
          className="text-muted hover:text-accent transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </a>
        <div>
          <h1 className="text-2xl font-bold mb-1">运营操作</h1>
          <p className="text-muted">手动结算收益、管理员权限配置、紧急暂停等运营工具</p>
        </div>
        <span className="badge badge-danger ml-auto">管理员</span>
      </div>

      {/* 平台暂停提示 */}
      {isPaused && (
        <div className="card border-l-4 border-l-danger">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-danger"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="font-bold text-danger">平台已暂停</p>
              <p className="text-sm text-muted">
                所有投资和提款操作已停止。请在确认安全后恢复运行。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 每日结算 */}
      <div className="card border border-accent/30">
        <h2 className="text-lg font-bold mb-1">每日结算</h2>
        <p className="text-sm text-muted mb-4">
          一键为所有活跃会员批量发放 DSR 收益。结算周期由合约自动推进，无需手动 settle。
        </p>

        {epochInfo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-muted">当前周期</p>
              <p className="text-lg font-bold text-accent">
                {epochInfo.currentEpoch.toString()}
              </p>
            </div>
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-muted">上次结算</p>
              <p className="text-sm font-mono">
                {new Date(Number(epochInfo.lastSettledAt) * 1000).toLocaleString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-muted">结算间隔</p>
              <p className="text-sm font-bold">
                {(Number(epochInfo.settlementInterval) / 3600).toFixed(0)}h
              </p>
            </div>
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-muted">注册会员</p>
              <p className="text-lg font-bold">{epochInfo.totalMembers.toString()}</p>
            </div>
          </div>
        )}

        {settlementProgress && (
          <div className="mb-4 p-3 rounded-lg bg-accent/10 border border-accent/30">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-accent animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-sm text-accent">{settlementProgress}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleDailySettlement}
          className="btn-primary w-full text-center"
          disabled={isSettling || adminActions.isPending}
        >
          {isSettling ? "结算中..." : "执行每日结算"}
        </button>
      </div>

      {/* 充值余额 */}
      <div className="card">
        <h2 className="text-lg font-bold mb-1">充值余额</h2>
        <p className="text-sm text-muted mb-4">
          为指定会员地址充值USDT余额（管理员手动操作）
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-muted mb-1">会员钱包地址</label>
            <input
              type="text"
              className="input font-mono text-sm"
              placeholder="0x..."
              value={creditAddress}
              onChange={(e) => setCreditAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">充值金额（USDT）</label>
            <input
              type="number"
              className="input"
              placeholder="如：1000"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              min={0}
            />
          </div>
          <button
            onClick={handleCreditTopUp}
            className="btn-primary"
            disabled={!creditAddress || !creditAmount || adminActions.isPending}
          >
            {adminActions.isPending ? "处理中..." : "确认充值"}
          </button>
        </div>
      </div>

      {/* 管理员权限管理（仅所有者） */}
      <div className="card">
        <h2 className="text-lg font-bold mb-1">管理员权限管理</h2>
        <p className="text-sm text-muted mb-4">
          添加或移除平台管理员，仅合约所有者可操作
        </p>
        {!adminActions.isOwner && (
          <div className="mb-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
            <p className="text-sm text-warning">
              此功能仅限合约所有者使用，您的钱包没有所有者权限
            </p>
          </div>
        )}
        <div className="space-y-4">
          {/* 添加管理员 */}
          <div>
            <label className="block text-sm font-medium mb-1">添加管理员</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input font-mono text-sm flex-1"
                placeholder="0x..."
                value={addAdminAddress}
                onChange={(e) => setAddAdminAddress(e.target.value)}
              />
              <button
                onClick={handleAddAdmin}
                className="btn-primary shrink-0"
                disabled={
                  !addAdminAddress ||
                  adminActions.isPending ||
                  !adminActions.isOwner
                }
              >
                {adminActions.isPending ? "处理中..." : "添加"}
              </button>
            </div>
          </div>
          {/* 移除管理员 */}
          <div>
            <label className="block text-sm font-medium mb-1">移除管理员</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input font-mono text-sm flex-1"
                placeholder="0x..."
                value={removeAdminAddress}
                onChange={(e) => setRemoveAdminAddress(e.target.value)}
              />
              <button
                onClick={handleRemoveAdmin}
                className="btn-secondary border-danger text-danger hover:bg-danger/10 shrink-0"
                disabled={
                  !removeAdminAddress ||
                  adminActions.isPending ||
                  !adminActions.isOwner
                }
              >
                {adminActions.isPending ? "处理中..." : "移除"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 设置收款钱包（仅所有者） */}
      <div className="card">
        <h2 className="text-lg font-bold mb-1">设置收款钱包</h2>
        <p className="text-sm text-muted mb-4">
          设置平台接收提款资金的钱包地址，仅所有者可操作
        </p>
        {!adminActions.isOwner && (
          <div className="mb-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
            <p className="text-sm text-warning">
              此功能仅限合约所有者使用，您的钱包没有所有者权限
            </p>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-muted mb-1">收款钱包地址</label>
            <input
              type="text"
              className="input font-mono text-sm"
              placeholder="0x..."
              value={receiverWalletAddress}
              onChange={(e) => setReceiverWalletAddress(e.target.value)}
            />
          </div>
          <button
            onClick={handleSetReceiverWallet}
            className="btn-primary"
            disabled={
              !receiverWalletAddress ||
              adminActions.isPending ||
              !adminActions.isOwner
            }
          >
            {adminActions.isPending ? "处理中..." : "保存"}
          </button>
        </div>
      </div>

      {/* 手动结算收益 */}
      <div className="card">
        <h2 className="text-lg font-bold mb-1">手动结算收益</h2>
        <p className="text-sm text-muted mb-4">
          为单个会员地址触发每日收益结算
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-muted mb-1">会员钱包地址</label>
            <input
              type="text"
              className="input font-mono text-sm"
              placeholder="0x..."
              value={settleAddress}
              onChange={(e) => setSettleAddress(e.target.value)}
            />
          </div>
          <button
            onClick={handleSettle}
            className="btn-primary"
            disabled={!settleAddress || adminActions.isPending}
          >
            {adminActions.isPending ? "处理中..." : "立即结算"}
          </button>
        </div>
      </div>

      {/* 批量结算收益 */}
      <div className="card">
        <h2 className="text-lg font-bold mb-1">批量结算收益</h2>
        <p className="text-sm text-muted mb-4">
          同时为多个地址触发收益结算，每行一个地址
        </p>
        <div className="space-y-3">
          <div>
            <textarea
              className="input font-mono text-sm min-h-[100px]"
              placeholder={"0x...\n0x...\n0x..."}
              value={batchSettleAddresses}
              onChange={(e) => setBatchSettleAddresses(e.target.value)}
            />
          </div>
          <button
            onClick={handleBatchSettle}
            className="btn-primary"
            disabled={!batchSettleAddresses.trim() || adminActions.isPending}
          >
            {adminActions.isPending ? "处理中..." : "批量结算"}
          </button>
        </div>
      </div>

      {/* 危险操作区域 */}
      <div className="card border border-danger/30">
        <h2 className="text-lg font-bold text-danger mb-4">危险操作</h2>

        {/* 清空数据 */}
        <div className="bg-background rounded-lg p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-bold">清空非管理员数据</p>
              <p className="text-sm text-muted">
                清除所有非管理员用户的注册、订单、余额等数据，重置 Epoch，此操作不可逆
              </p>
            </div>
            {!confirmPurge ? (
              <button
                onClick={() => setConfirmPurge(true)}
                className="btn-secondary border-danger text-danger hover:bg-danger/10 shrink-0"
              >
                清空数据
              </button>
            ) : (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setConfirmPurge(false)}
                  className="btn-secondary text-sm"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    try {
                      await adminActions.purgeNonAdminData();
                      logAction("已清空所有非管理员数据", "success");
                      await fetchEpochInfo();
                    } catch (e: unknown) {
                      const err = e as { shortMessage?: string; message?: string };
                      logAction(
                        `清空数据失败：${err?.shortMessage || err?.message?.slice(0, 60) || "未知错误"}`,
                        "error"
                      );
                    }
                    setConfirmPurge(false);
                  }}
                  className="bg-danger text-white px-4 py-2 rounded-lg font-bold hover:bg-danger/80 transition-colors text-sm"
                >
                  确认清空
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 全局重启 */}
        <div className="bg-background rounded-lg p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-bold">全局重启</p>
              <p className="text-sm text-muted">
                将所有超过收益上限的会员标记为重启状态，此操作不可逆
              </p>
            </div>
            {!confirmRestart ? (
              <button
                onClick={() => setConfirmRestart(true)}
                className="btn-secondary border-danger text-danger hover:bg-danger/10 shrink-0"
              >
                触发全局重启
              </button>
            ) : (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setConfirmRestart(false)}
                  className="btn-secondary text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleGlobalRestart}
                  className="bg-danger text-white px-4 py-2 rounded-lg font-bold hover:bg-danger/80 transition-colors text-sm"
                >
                  确认重启
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 紧急暂停 */}
        <div className="bg-background rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-bold">
                {isPaused ? "恢复平台运行" : "紧急暂停平台"}
              </p>
              <p className="text-sm text-muted">
                {isPaused
                  ? "平台当前已暂停，点击按钮恢复所有投资和提款操作"
                  : "暂停所有投资和提款操作，仅在紧急情况下使用"}
              </p>
            </div>
            {!confirmPause ? (
              <button
                onClick={() => setConfirmPause(true)}
                className={`shrink-0 px-4 py-2 rounded-lg font-bold transition-colors ${
                  isPaused
                    ? "bg-success text-white hover:bg-success/80"
                    : "btn-secondary border-danger text-danger hover:bg-danger/10"
                }`}
              >
                {isPaused ? "恢复平台运行" : "紧急暂停平台"}
              </button>
            ) : (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setConfirmPause(false)}
                  className="btn-secondary text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleEmergencyPause}
                  className={`px-4 py-2 rounded-lg font-bold transition-colors text-sm text-white ${
                    isPaused
                      ? "bg-success hover:bg-success/80"
                      : "bg-danger hover:bg-danger/80"
                  }`}
                >
                  {isPaused ? "确认恢复" : "确认暂停"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 最近操作记录 */}
      <div className="card">
        <h2 className="text-lg font-bold mb-4">最近操作记录</h2>
        {/* Mobile: card layout */}
        <div className="sm:hidden space-y-2">
          {actionLog.map((log, i) => (
            <div key={i} className="bg-background rounded-lg p-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm">{log.action}</p>
                <p className="text-xs text-muted mt-1">{log.time}</p>
              </div>
              <span
                className={`badge shrink-0 ${
                  log.status === "success" ? "badge-success" : "badge-danger"
                }`}
              >
                {log.status === "success" ? "成功" : "失败"}
              </span>
            </div>
          ))}
        </div>
        {/* Desktop: table layout */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted border-b border-card-border">
                <th className="text-left py-3 px-2">时间</th>
                <th className="text-left py-3 px-2">操作内容</th>
                <th className="text-left py-3 px-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {actionLog.map((log, i) => (
                <tr
                  key={i}
                  className="border-b border-card-border/50 hover:bg-background/50 transition-colors"
                >
                  <td className="py-3 px-2 text-muted whitespace-nowrap">
                    {log.time}
                  </td>
                  <td className="py-3 px-2">{log.action}</td>
                  <td className="py-3 px-2">
                    <span
                      className={`badge ${
                        log.status === "success"
                          ? "badge-success"
                          : "badge-danger"
                      }`}
                    >
                      {log.status === "success" ? "成功" : "失败"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {actionLog.length === 0 && (
          <p className="text-center text-muted py-8">暂无操作记录</p>
        )}
      </div>
    </div>
  );
}
