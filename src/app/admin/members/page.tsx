"use client";

import { useWeb3 } from "@/contexts/Web3Context";
import { shortenAddress, formatNumber, getErrorMessage } from "@/lib/utils";
import { useState, useCallback, useEffect } from "react";
import ConnectButton from "@/components/shared/ConnectButton";
import { useAdminActions } from "@/hooks/useAdminActions";
import { Contract, type InterfaceAbi, isAddress } from "ethers";
import { ADDRESSES } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";

interface MemberInfo {
  address: string;
  vLevel: number;
  communityLevel: number;
  isActive: boolean;
  isFrozen: boolean;
  isPaused: boolean;
  totalInvested: bigint;
  balance: bigint;
  teamPerf: bigint;
}

const PAGE_SIZE = 10;

export default function MembersPage() {
  const { isConnected, address, readProvider } = useWeb3();
  const adminActions = useAdminActions(address);

  const [searchAddress, setSearchAddress] = useState("");
  const [searchResult, setSearchResult] = useState<MemberInfo | null>(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Action modal state
  const [selectedMember, setSelectedMember] = useState<MemberInfo | null>(null);
  const [actionType, setActionType] = useState<"pause" | "freeze" | "level" | "vlevel" | null>(null);
  const [newLevel, setNewLevel] = useState(0);
  const [newVLevel, setNewVLevel] = useState(0);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const getContract = useCallback(() => {
    if (!readProvider) return null;
    return new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider);
  }, [readProvider]);

  const fetchMemberInfo = useCallback(async (addr: string): Promise<MemberInfo | null> => {
    const contract = getContract();
    if (!contract) return null;
    const [info, teamInfo] = await Promise.all([
      contract.getMemberInfo(addr),
      contract.getTeamInfo(addr),
    ]);
    return {
      address: addr,
      vLevel: Number(info[1]),
      communityLevel: Number(info[2]),
      isActive: Boolean(info[3]),
      isFrozen: Boolean(info[4]),
      isPaused: Boolean(info[5]),
      totalInvested: BigInt(info[7]),
      balance: BigInt(info[9]),
      teamPerf: BigInt(teamInfo[0]),
    };
  }, [getContract]);

  const loadPage = useCallback(async (page: number) => {
    const contract = getContract();
    if (!contract) return;
    setIsLoadingPage(true);
    setLoadError("");
    try {
      const count = Number(await contract.getAllMembersCount());
      setTotalCount(count);

      if (count === 0) {
        setMembers([]);
        return;
      }

      const start = (page - 1) * PAGE_SIZE;
      const end = Math.min(start + PAGE_SIZE, count);
      const addrs: string[] = await Promise.all(
        Array.from({ length: end - start }, (_, i) =>
          contract.getMemberAtIndex(start + i)
        )
      );
      const infos = await Promise.all(addrs.map((a) => fetchMemberInfo(a)));
      setMembers(infos.filter(Boolean) as MemberInfo[]);
      setCurrentPage(page);
    } catch (e: unknown) {
      setLoadError(getErrorMessage(e, "加载会员数据失败"));
    } finally {
      setIsLoadingPage(false);
    }
  }, [getContract, fetchMemberInfo]);

  // Auto-load page 1 when wallet connects
  useEffect(() => {
    if (isConnected && readProvider) {
      loadPage(1);
    }
  }, [isConnected, readProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async () => {
    const addr = searchAddress.trim();
    if (!addr) { setSearchResult(null); setSearchError(""); return; }
    if (!isAddress(addr)) { setSearchError("无效的钱包地址"); return; }
    setIsSearching(true);
    setSearchError("");
    setSearchResult(null);
    try {
      const contract = getContract();
      if (!contract) throw new Error("未连接钱包");
      const registered = await contract.isMemberRegistered(addr);
      if (!registered) { setSearchError("该地址尚未注册"); return; }
      const info = await fetchMemberInfo(addr);
      setSearchResult(info);
    } catch (e: unknown) {
      setSearchError(getErrorMessage(e, "查询失败"));
    } finally {
      setIsSearching(false);
    }
  };

  const openAction = (member: MemberInfo, action: "pause" | "freeze" | "level" | "vlevel") => {
    setSelectedMember(member);
    setActionType(action);
    setNewLevel(member.communityLevel);
    setNewVLevel(member.vLevel);
    setActionError("");
    setActionSuccess("");
  };

  const executeAction = async () => {
    if (!selectedMember || !actionType) return;
    setActionPending(true);
    setActionError("");
    setActionSuccess("");
    try {
      let hash: string | undefined;
      if (actionType === "level") {
        hash = await adminActions.setCommunityLevel(selectedMember.address, newLevel);
      } else if (actionType === "vlevel") {
        hash = await adminActions.setMemberVLevel(selectedMember.address, newVLevel);
      } else if (actionType === "pause") {
        hash = selectedMember.isPaused
          ? await adminActions.unpauseMember(selectedMember.address)
          : await adminActions.pauseMember(selectedMember.address);
      } else if (actionType === "freeze") {
        hash = selectedMember.isFrozen
          ? await adminActions.unfreezeMember(selectedMember.address)
          : await adminActions.freezeMember(selectedMember.address);
      }
      setActionSuccess(`TX: ${hash?.slice(0, 18)}...`);
      // Refresh this member's data
      const updated = await fetchMemberInfo(selectedMember.address);
      if (updated) {
        setMembers((prev) => prev.map((m) => m.address === updated.address ? updated : m));
        if (searchResult?.address === updated.address) setSearchResult(updated);
      }
    } catch (e: unknown) {
      setActionError(getErrorMessage(e, "交易失败"));
    } finally {
      setActionPending(false);
    }
  };

  const statusLabel = (m: MemberInfo) => {
    if (m.isFrozen) return { label: "已冻结", cls: "badge-danger" };
    if (m.isPaused) return { label: "已暂停", cls: "badge-warning" };
    if (!m.isActive) return { label: "未激活", cls: "badge-warning" };
    return { label: "正常", cls: "badge-success" };
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card glow-accent text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">请连接钱包</h2>
          <div className="mt-4"><ConnectButton /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <a href="/admin" className="text-muted hover:text-accent transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <div>
          <h1 className="text-2xl font-bold mb-1">会员列表</h1>
          <p className="text-muted text-sm">
            {isLoadingPage ? "加载中..." : `链上共 ${totalCount} 位会员`}
          </p>
        </div>
        <button
          onClick={() => loadPage(currentPage)}
          disabled={isLoadingPage}
          className="btn-secondary text-sm ml-auto"
        >
          {isLoadingPage ? "加载中..." : "刷新"}
        </button>
        <span className="badge badge-danger">管理员</span>
      </div>

      {/* Address Search */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-sm text-muted uppercase tracking-wider">按地址查询会员</h2>
        <div className="flex gap-3">
          <input
            type="text"
            className="input font-mono text-sm flex-1"
            placeholder="0x..."
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button onClick={handleSearch} disabled={isSearching} className="btn-primary shrink-0">
            {isSearching ? "查询中..." : "查询"}
          </button>
          {searchResult && (
            <button
              onClick={() => { setSearchResult(null); setSearchAddress(""); }}
              className="btn-secondary shrink-0"
            >
              清除
            </button>
          )}
        </div>
        {searchError && <p className="text-danger text-sm">{searchError}</p>}
        {searchResult && (
          <table className="w-full text-sm mt-2">
            <tbody>
              <MemberRow member={searchResult} onAction={openAction} statusLabel={statusLabel} />
            </tbody>
          </table>
        )}
      </div>

      {/* Member Table */}
      <div className="card">
        {loadError && (
          <p className="text-danger text-sm mb-4">{loadError}</p>
        )}

        {isLoadingPage && members.length === 0 ? (
          <div className="text-center text-muted py-12">正在从链上加载会员数据...</div>
        ) : members.length === 0 ? (
          <div className="text-center text-muted py-12">暂无会员数据</div>
        ) : (
          <>
            {/* Mobile: card layout */}
            <div className="sm:hidden space-y-3">
              {members.map((member) => {
                const { label: sLabel, cls: sCls } = statusLabel(member);
                return (
                  <div key={member.address} className="bg-background rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{shortenAddress(member.address, 6)}</span>
                      <span className={`badge ${sCls}`}>{sLabel}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted">投资金额</p>
                        <p className="font-mono">${formatNumber(Number(member.totalInvested) / 1e18, 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">团队业绩</p>
                        <p className="font-mono text-accent">${formatNumber(Number(member.teamPerf) / 1e18, 0)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openAction(member, "vlevel")}
                        className="badge badge-success cursor-pointer"
                      >
                        V{member.vLevel}
                      </button>
                      <button
                        type="button"
                        onClick={() => openAction(member, "level")}
                        className="text-xs text-accent hover:underline cursor-pointer"
                      >
                        L{member.communityLevel}
                      </button>
                      <div className="flex gap-1 ml-auto">
                        <button
                          type="button"
                          onClick={() => openAction(member, "pause")}
                          className="text-xs py-1.5 px-2.5 rounded bg-warning/10 text-warning hover:bg-warning/20 transition-colors"
                        >
                          {member.isPaused ? "解除暂停" : "暂停"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openAction(member, "freeze")}
                          className="text-xs py-1.5 px-2.5 rounded bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                        >
                          {member.isFrozen ? "解除冻结" : "冻结"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop: table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted border-b border-card-border">
                    <th className="text-left py-3 px-2">钱包地址</th>
                    <th className="text-right py-3 px-2">投资金额</th>
                    <th className="text-right py-3 px-2">团队业绩</th>
                    <th className="text-center py-3 px-2">V等级</th>
                    <th className="text-center py-3 px-2">社区等级</th>
                    <th className="text-center py-3 px-2">状态</th>
                    <th className="text-center py-3 px-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <MemberRow
                      key={member.address}
                      member={member}
                      onAction={openAction}
                      statusLabel={statusLabel}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-card-border mt-4">
                <p className="text-sm text-muted">
                  第 {currentPage} / {totalPages} 页 · 共 {totalCount} 位会员
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadPage(currentPage - 1)}
                    disabled={currentPage === 1 || isLoadingPage}
                    className="btn-secondary text-sm py-2 px-4"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => loadPage(currentPage + 1)}
                    disabled={currentPage === totalPages || isLoadingPage}
                    className="btn-secondary text-sm py-2 px-4"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Modal */}
      {selectedMember && actionType && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="card glow-accent max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold">
              {actionType === "level" && "设置社区等级"}
              {actionType === "vlevel" && "设置V等级"}
              {actionType === "pause" && (selectedMember.isPaused ? "解除暂停" : "暂停账户")}
              {actionType === "freeze" && (selectedMember.isFrozen ? "解除冻结" : "冻结账户")}
            </h3>
            <p className="text-sm text-muted font-mono">{shortenAddress(selectedMember.address, 10)}</p>

            {actionType === "level" && (
              <div>
                <label className="block text-sm text-muted mb-2">
                  社区等级（当前：L{selectedMember.communityLevel}）
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 0, label: "L0", desc: "无等级" },
                    { value: 1, label: "L1", desc: "收益 20%" },
                    { value: 2, label: "L2", desc: "收益 18%" },
                    { value: 3, label: "L3", desc: "收益 15%" },
                    { value: 4, label: "L4", desc: "收益 10%" },
                    { value: 5, label: "L5", desc: "收益 5%" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewLevel(opt.value)}
                      className={`flex flex-col items-center py-3 px-2 rounded-lg border transition-all ${
                        newLevel === opt.value
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-card-border bg-background hover:border-accent/50"
                      }`}
                    >
                      <span className="font-bold text-sm">{opt.label}</span>
                      <span className="text-xs text-muted">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {actionType === "vlevel" && (
              <div>
                <label className="block text-sm text-muted mb-2">
                  V等级（当前：V{selectedMember.vLevel}）
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { value: 0, label: "V0", desc: "无" },
                    { value: 1, label: "V1", desc: "" },
                    { value: 2, label: "V2", desc: "" },
                    { value: 3, label: "V3", desc: "" },
                    { value: 4, label: "V4", desc: "" },
                    { value: 5, label: "V5", desc: "" },
                    { value: 6, label: "V6", desc: "" },
                    { value: 7, label: "V7", desc: "" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewVLevel(opt.value)}
                      className={`flex flex-col items-center py-3 px-2 rounded-lg border transition-all ${
                        newVLevel === opt.value
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-card-border bg-background hover:border-accent/50"
                      }`}
                    >
                      <span className="font-bold text-sm">{opt.label}</span>
                      {opt.desc && <span className="text-xs text-muted">{opt.desc}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {actionType === "pause" && !selectedMember.isPaused && (
              <p className="text-sm text-warning">暂停后该会员将无法提款，可随时解除。</p>
            )}
            {actionType === "freeze" && !selectedMember.isFrozen && (
              <p className="text-sm text-danger">冻结后该会员将无法进行任何操作，请谨慎操作。</p>
            )}

            {actionError && <p className="text-danger text-sm">{actionError}</p>}
            {actionSuccess && <p className="text-success text-sm">{actionSuccess}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setSelectedMember(null); setActionType(null); }}
                className="btn-secondary flex-1"
                disabled={actionPending}
              >
                取消
              </button>
              <button
                onClick={executeAction}
                disabled={actionPending}
                className={`flex-1 rounded-lg font-bold py-3 transition-colors ${
                  actionType === "freeze" && !selectedMember.isFrozen
                    ? "bg-danger text-white hover:bg-danger/80"
                    : "btn-primary"
                }`}
              >
                {actionPending ? "提交中..." : "确认"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  onAction,
  statusLabel,
}: {
  member: MemberInfo;
  onAction: (m: MemberInfo, a: "pause" | "freeze" | "level" | "vlevel") => void;
  statusLabel: (m: MemberInfo) => { label: string; cls: string };
}) {
  const { label, cls } = statusLabel(member);
  return (
    <tr className="border-b border-card-border/50 hover:bg-background/50 transition-colors">
      <td className="py-3 px-2 font-mono text-xs">{shortenAddress(member.address, 8)}</td>
      <td className="py-3 px-2 text-right font-mono">
        ${formatNumber(Number(member.totalInvested) / 1e18, 0)}
      </td>
      <td className="py-3 px-2 text-right font-mono text-accent">
        ${formatNumber(Number(member.teamPerf) / 1e18, 0)}
      </td>
      <td className="py-3 px-2 text-center">
        <button
          type="button"
          onClick={() => onAction(member, "vlevel")}
          className="text-sm text-accent hover:underline cursor-pointer"
          title="点击设置V等级"
        >
          <span className="badge badge-success">V{member.vLevel}</span>
        </button>
      </td>
      <td className="py-3 px-2 text-center">
        <button
          type="button"
          onClick={() => onAction(member, "level")}
          className="text-sm text-accent hover:underline cursor-pointer"
          title="点击设置社区等级"
        >
          L{member.communityLevel}
        </button>
      </td>
      <td className="py-3 px-2 text-center">
        <span className={`badge ${cls}`}>{label}</span>
      </td>
      <td className="py-3 px-2">
        <div className="flex justify-center gap-1">
          <button
            onClick={() => onAction(member, "pause")}
            className="text-xs px-2 py-1 rounded bg-warning/10 text-warning hover:bg-warning/20 transition-colors"
          >
            {member.isPaused ? "解除暂停" : "暂停"}
          </button>
          <button
            onClick={() => onAction(member, "freeze")}
            className="text-xs px-2 py-1 rounded bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
          >
            {member.isFrozen ? "解除冻结" : "冻结"}
          </button>
        </div>
      </td>
    </tr>
  );
}
