"use client";

import { useWeb3 } from "@/contexts/Web3Context";
import { useState, useEffect, useCallback } from "react";
import { useAdminActions } from "@/hooks/useAdminActions";
import { Contract, formatUnits, type InterfaceAbi } from "ethers";
import { ADDRESSES, USDT_DECIMALS } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import ConnectButton from "@/components/shared/ConnectButton";

interface MemberSettleInfo {
  address: string;
  isActive: boolean;
  isFrozen: boolean;
  isPaused: boolean;
  isRestarted: boolean;
  balance: bigint;
  totalInvested: bigint;
}

export default function SettlementPage() {
  const { isConnected, address, readProvider, signer } = useWeb3();
  const adminActions = useAdminActions(address ?? undefined);

  // Epoch info
  const [epochInfo, setEpochInfo] = useState<{
    currentEpoch: bigint;
    lastSettledAt: bigint;
    settlementInterval: bigint;
    totalMembers: bigint;
  } | null>(null);

  // Settlement state
  const [isSettling, setIsSettling] = useState(false);
  const [settlementProgress, setSettlementProgress] = useState("");
  const [settledCount, setSettledCount] = useState(0);
  const [totalToSettle, setTotalToSettle] = useState(0);

  // Single settle
  const [settleAddress, setSettleAddress] = useState("");

  // Batch settle
  const [batchAddresses, setBatchAddresses] = useState("");

  // Member list for preview
  const [activeMembers, setActiveMembers] = useState<MemberSettleInfo[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Action log
  const [actionLog, setActionLog] = useState<
    { time: string; action: string; status: string }[]
  >([]);

  const logAction = (action: string, status: "success" | "error") => {
    setActionLog((prev) => [
      {
        time: new Date().toISOString().slice(0, 16).replace("T", " "),
        action,
        status,
      },
      ...prev.slice(0, 49),
    ]);
  };

  const fetchEpochInfo = useCallback(async () => {
    if (!readProvider) return;
    try {
      const mp = new Contract(
        ADDRESSES.MEMEPLUS,
        memePlusAbi as InterfaceAbi,
        readProvider
      );
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

  // Load active members for preview
  const loadActiveMembers = async () => {
    if (!readProvider) return;
    setIsLoadingMembers(true);
    try {
      const mp = new Contract(
        ADDRESSES.MEMEPLUS,
        memePlusAbi as InterfaceAbi,
        readProvider
      );
      const totalMembers = Number(await mp.getAllMembersCount());
      const members: MemberSettleInfo[] = [];

      for (let i = 0; i < totalMembers; i++) {
        const addr = await mp.getMemberAtIndex(i);
        const info = await mp.getMemberInfo(addr);
        members.push({
          address: addr,
          isActive: info[3],
          isFrozen: info[4],
          isPaused: info[5],
          isRestarted: info[6],
          balance: info[9],
          totalInvested: info[7],
        });
      }
      setActiveMembers(members);
    } catch (e) {
      console.error("loadActiveMembers error:", e);
      logAction("加载会员列表失败", "error");
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Epoch settle (advance epoch)
  const handleEpochSettle = async () => {
    if (!signer) {
      logAction("请先连接钱包", "error");
      return;
    }
    try {
      await adminActions.settle();
      logAction("周期结算（settle）执行成功", "success");
      await fetchEpochInfo();
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; reason?: string; message?: string };
      logAction(
        `周期结算失败：${err?.shortMessage || err?.reason || err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
    }
  };

  // Daily settlement for all active members (auto-advance epoch + batch claim)
  const handleDailySettlement = async () => {
    if (!readProvider) {
      logAction("Provider 未就绪，请刷新页面", "error");
      return;
    }
    if (!signer) {
      logAction("请先连接钱包（需要签名器）", "error");
      return;
    }
    setIsSettling(true);
    setSettledCount(0);
    logAction("开始每日结算...", "success");
    try {
      const mp = new Contract(
        ADDRESSES.MEMEPLUS,
        memePlusAbi as InterfaceAbi,
        readProvider
      );

      setSettlementProgress("正在获取活跃会员列表...");
      const totalMembers = Number(await mp.getAllMembersCount());
      const activeUsers: string[] = [];

      for (let i = 0; i < totalMembers; i++) {
        const addr = await mp.getMemberAtIndex(i);
        const info = await mp.getMemberInfo(addr);
        if (info[3] && !info[4] && !info[5]) {
          activeUsers.push(addr);
        }
      }

      if (activeUsers.length === 0) {
        setSettlementProgress("");
        logAction("没有需要结算的活跃会员", "success");
        setIsSettling(false);
        return;
      }

      setTotalToSettle(activeUsers.length);
      const batchSize = 50;
      const batches = Math.ceil(activeUsers.length / batchSize);

      for (let b = 0; b < batches; b++) {
        const batch = activeUsers.slice(b * batchSize, (b + 1) * batchSize);
        setSettlementProgress(
          `正在结算第 ${b + 1}/${batches} 批（共 ${activeUsers.length} 人）...`
        );
        // 第一批使用 settleAndBatchClaim 自动推进 epoch，后续批次用 batchClaimDailyReturn
        if (b === 0) {
          await adminActions.settleAndBatchClaim(batch);
        } else {
          await adminActions.batchClaimDailyReturn(batch);
        }
        setSettledCount((b + 1) * batchSize > activeUsers.length ? activeUsers.length : (b + 1) * batchSize);
      }

      logAction(`每日结算完成：共 ${activeUsers.length} 个活跃会员`, "success");
      setSettlementProgress("");
      await fetchEpochInfo();
    } catch (e: unknown) {
      console.error("Daily settlement error:", e);
      const err = e as { shortMessage?: string; reason?: string; message?: string; info?: { error?: { message?: string } } };
      const msg = err?.shortMessage || err?.reason || err?.info?.error?.message || err?.message?.slice(0, 80) || "未知错误";
      logAction(`每日结算失败：${msg}`, "error");
      setSettlementProgress("");
    } finally {
      setIsSettling(false);
    }
  };

  // Recalculate V-levels for all members
  const handleRecalculateVLevels = async () => {
    if (!readProvider) return;
    setIsSettling(true);
    try {
      const mp = new Contract(
        ADDRESSES.MEMEPLUS,
        memePlusAbi as InterfaceAbi,
        readProvider
      );

      setSettlementProgress("正在获取会员列表...");
      const totalMembers = Number(await mp.getAllMembersCount());
      const allUsers: string[] = [];

      for (let i = 0; i < totalMembers; i++) {
        const addr = await mp.getMemberAtIndex(i);
        allUsers.push(addr);
      }

      if (allUsers.length === 0) {
        setSettlementProgress("");
        logAction("没有会员需要重算", "success");
        setIsSettling(false);
        return;
      }

      const batchSize = 100;
      const batches = Math.ceil(allUsers.length / batchSize);

      for (let b = 0; b < batches; b++) {
        const batch = allUsers.slice(b * batchSize, (b + 1) * batchSize);
        setSettlementProgress(
          `正在重算V级第 ${b + 1}/${batches} 批（共 ${allUsers.length} 人）...`
        );
        await adminActions.recalculateVLevels(batch);
      }

      logAction(`V级重算完成：共 ${allUsers.length} 个会员`, "success");
      setSettlementProgress("");
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; reason?: string; message?: string };
      logAction(
        `V级重算失败：${err?.shortMessage || err?.reason || err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
      setSettlementProgress("");
    } finally {
      setIsSettling(false);
    }
  };

  // Single user settle
  const handleSingleSettle = async () => {
    if (!settleAddress) return;
    try {
      await adminActions.batchClaimDailyReturn([settleAddress]);
      logAction(
        `手动结算成功：${settleAddress.slice(0, 6)}...${settleAddress.slice(-4)}`,
        "success"
      );
      setSettleAddress("");
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      logAction(
        `手动结算失败：${err?.shortMessage || err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
    }
  };

  // Batch settle
  const handleBatchSettle = async () => {
    const users = batchAddresses
      .split("\n")
      .map((a) => a.trim())
      .filter((a) => a.startsWith("0x") && a.length === 42);
    if (users.length === 0) return;

    setIsSettling(true);
    try {
      const batchSize = 50;
      const batches = Math.ceil(users.length / batchSize);

      for (let b = 0; b < batches; b++) {
        const batch = users.slice(b * batchSize, (b + 1) * batchSize);
        setSettlementProgress(
          `正在批量结算第 ${b + 1}/${batches} 批（共 ${users.length} 人）...`
        );
        await adminActions.batchClaimDailyReturn(batch);
      }

      logAction(`批量结算完成：共 ${users.length} 个地址`, "success");
      setBatchAddresses("");
      setSettlementProgress("");
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      logAction(
        `批量结算失败：${err?.shortMessage || err?.message?.slice(0, 60) || "未知错误"}`,
        "error"
      );
      setSettlementProgress("");
    } finally {
      setIsSettling(false);
    }
  };

  // Time helpers
  const formatTime = (timestamp: bigint) => {
    if (timestamp === 0n) return "从未结算";
    return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN");
  };

  const getTimeSinceLastSettle = () => {
    if (!epochInfo || epochInfo.lastSettledAt === 0n) return null;
    const now = Math.floor(Date.now() / 1000);
    const diff = now - Number(epochInfo.lastSettledAt);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const isSettlementOverdue = () => {
    if (!epochInfo || epochInfo.lastSettledAt === 0n) return false;
    const now = Math.floor(Date.now() / 1000);
    return now - Number(epochInfo.lastSettledAt) > Number(epochInfo.settlementInterval);
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

  const eligibleMembers = activeMembers.filter(
    (m) => m.isActive && !m.isFrozen && !m.isPaused
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
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
          <h1 className="text-2xl font-bold mb-1">结算管理</h1>
          <p className="text-muted">周期结算、每日收益发放、批量结算操作</p>
        </div>
        <span className="badge badge-danger ml-auto">管理员</span>
      </div>

      {/* Epoch Status */}
      <div className={`card border ${isSettlementOverdue() ? "border-danger/50" : "border-accent/30"}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">结算状态</h2>
          {isSettlementOverdue() && (
            <span className="badge badge-danger">已超时</span>
          )}
        </div>

        {epochInfo ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-muted">当前周期</p>
              <p className="text-2xl font-bold text-accent">
                {epochInfo.currentEpoch.toString()}
              </p>
            </div>
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-muted">上次结算</p>
              <p className="text-sm font-mono">
                {formatTime(epochInfo.lastSettledAt)}
              </p>
              {getTimeSinceLastSettle() && (
                <p className={`text-xs mt-1 ${isSettlementOverdue() ? "text-danger" : "text-muted"}`}>
                  {getTimeSinceLastSettle()} 前
                </p>
              )}
            </div>
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-muted">结算间隔</p>
              <p className="text-lg font-bold">
                {(Number(epochInfo.settlementInterval) / 3600).toFixed(0)}h
              </p>
            </div>
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-muted">注册会员</p>
              <p className="text-2xl font-bold">
                {epochInfo.totalMembers.toString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted">加载中...</div>
        )}

        <button
          onClick={handleEpochSettle}
          className="btn-secondary w-full text-center"
          disabled={adminActions.isPending || isSettling}
        >
          {adminActions.isPending ? "处理中..." : "手动推进周期（settle）"}
        </button>
        <p className="text-xs text-muted mt-2">
          调用合约 settle() 推进结算周期。通常由系统自动触发，仅在需要时手动执行。
        </p>
      </div>

      {/* Daily Settlement */}
      <div className="card border border-accent/30">
        <h2 className="text-lg font-bold mb-1">一键每日结算</h2>
        <p className="text-sm text-muted mb-4">
          自动获取所有活跃会员并批量发放 DSR 每日收益（每批 50 人）
        </p>

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
            {totalToSettle > 0 && (
              <div className="mt-2">
                <div className="w-full bg-background rounded-full h-2">
                  <div
                    className="bg-accent h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.round((settledCount / totalToSettle) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted mt-1 text-right">
                  {settledCount} / {totalToSettle}
                </p>
              </div>
            )}
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

      {/* V-Level Recalculate */}
      <div className="card border border-accent/30">
        <h2 className="text-lg font-bold mb-1">V级重算</h2>
        <p className="text-sm text-muted mb-4">
          根据当前小区业绩重新计算所有会员的V等级（重置/数据变更后使用）
        </p>
        <button
          onClick={handleRecalculateVLevels}
          className="btn-secondary w-full text-center"
          disabled={isSettling || adminActions.isPending}
        >
          {isSettling ? "处理中..." : "重算所有V级"}
        </button>
      </div>

      {/* Member Preview */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">会员结算预览</h2>
            <p className="text-sm text-muted">
              查看所有会员状态，确认可结算对象
            </p>
          </div>
          <button
            onClick={loadActiveMembers}
            className="btn-secondary text-sm"
            disabled={isLoadingMembers}
          >
            {isLoadingMembers ? "加载中..." : "刷新列表"}
          </button>
        </div>

        {activeMembers.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-background rounded-lg p-3 text-center">
                <p className="text-xs text-muted">总会员</p>
                <p className="text-lg font-bold">{activeMembers.length}</p>
              </div>
              <div className="bg-background rounded-lg p-3 text-center">
                <p className="text-xs text-muted">可结算</p>
                <p className="text-lg font-bold text-success">
                  {eligibleMembers.length}
                </p>
              </div>
              <div className="bg-background rounded-lg p-3 text-center">
                <p className="text-xs text-muted">不可结算</p>
                <p className="text-lg font-bold text-danger">
                  {activeMembers.length - eligibleMembers.length}
                </p>
              </div>
            </div>

            {/* Mobile: card layout */}
            <div className="sm:hidden space-y-2 max-h-[300px] overflow-y-auto">
              {activeMembers.map((m, i) => {
                const eligible = m.isActive && !m.isFrozen && !m.isPaused;
                return (
                  <div
                    key={m.address}
                    className={`bg-background rounded-lg p-3 flex items-center justify-between ${!eligible ? "opacity-50" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs truncate">{m.address.slice(0, 6)}...{m.address.slice(-4)}</p>
                      <p className="text-xs text-muted mt-0.5">
                        投资: {Number(formatUnits(m.totalInvested, USDT_DECIMALS)).toFixed(0)} · 余额: {Number(formatUnits(m.balance, USDT_DECIMALS)).toFixed(0)}
                      </p>
                    </div>
                    {m.isFrozen ? (
                      <span className="badge badge-danger text-xs shrink-0 ml-2">冻结</span>
                    ) : m.isPaused ? (
                      <span className="badge badge-warning text-xs shrink-0 ml-2">暂停</span>
                    ) : m.isRestarted ? (
                      <span className="badge text-xs shrink-0 ml-2">已重启</span>
                    ) : m.isActive ? (
                      <span className="badge badge-success text-xs shrink-0 ml-2">活跃</span>
                    ) : (
                      <span className="badge text-xs shrink-0 ml-2">未激活</span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Desktop: table layout */}
            <div className="hidden sm:block overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-muted border-b border-card-border">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2">地址</th>
                    <th className="text-right py-2 px-2">投资额</th>
                    <th className="text-right py-2 px-2">余额</th>
                    <th className="text-center py-2 px-2">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMembers.map((m, i) => {
                    const eligible = m.isActive && !m.isFrozen && !m.isPaused;
                    return (
                      <tr
                        key={m.address}
                        className={`border-b border-card-border/50 ${!eligible ? "opacity-50" : ""}`}
                      >
                        <td className="py-2 px-2 text-muted">{i + 1}</td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {m.address.slice(0, 6)}...{m.address.slice(-4)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {Number(formatUnits(m.totalInvested, USDT_DECIMALS)).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {Number(formatUnits(m.balance, USDT_DECIMALS)).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {m.isFrozen ? (
                            <span className="badge badge-danger text-xs">冻结</span>
                          ) : m.isPaused ? (
                            <span className="badge badge-warning text-xs">暂停</span>
                          ) : m.isRestarted ? (
                            <span className="badge text-xs">已重启</span>
                          ) : m.isActive ? (
                            <span className="badge badge-success text-xs">活跃</span>
                          ) : (
                            <span className="badge text-xs">未激活</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-center text-muted py-6">
            点击「刷新列表」加载会员数据
          </p>
        )}
      </div>

      {/* Single Settle */}
      <div className="card">
        <h2 className="text-lg font-bold mb-1">单人结算</h2>
        <p className="text-sm text-muted mb-4">
          为指定会员地址触发每日收益结算
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            className="input font-mono text-sm flex-1"
            placeholder="0x..."
            value={settleAddress}
            onChange={(e) => setSettleAddress(e.target.value)}
          />
          <button
            onClick={handleSingleSettle}
            className="btn-primary shrink-0"
            disabled={!settleAddress || adminActions.isPending || isSettling}
          >
            {adminActions.isPending ? "处理中..." : "结算"}
          </button>
        </div>
      </div>

      {/* Batch Settle */}
      <div className="card">
        <h2 className="text-lg font-bold mb-1">批量结算</h2>
        <p className="text-sm text-muted mb-4">
          为多个地址触发收益结算，每行一个地址（超过 50 个自动分批）
        </p>
        <div className="space-y-3">
          <textarea
            className="input font-mono text-sm min-h-[120px]"
            placeholder={"0x...\n0x...\n0x..."}
            value={batchAddresses}
            onChange={(e) => setBatchAddresses(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              已输入{" "}
              {
                batchAddresses
                  .split("\n")
                  .filter((a) => a.trim().startsWith("0x") && a.trim().length === 42)
                  .length
              }{" "}
              个有效地址
            </p>
            <button
              onClick={handleBatchSettle}
              className="btn-primary"
              disabled={!batchAddresses.trim() || adminActions.isPending || isSettling}
            >
              {isSettling ? "结算中..." : "批量结算"}
            </button>
          </div>
        </div>
      </div>

      {/* Action Log */}
      <div className="card">
        <h2 className="text-lg font-bold mb-4">操作记录</h2>
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
