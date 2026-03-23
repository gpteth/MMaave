"use client";

import { useWeb3 } from "@/contexts/Web3Context";
import { useState, useEffect, useCallback } from "react";
import { Contract, type InterfaceAbi } from "ethers";
import { ADDRESSES } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import ConnectButton from "@/components/shared/ConnectButton";

export default function AdminPage() {
  const { isConnected, readProvider } = useWeb3();
  const [totalMembers, setTotalMembers] = useState<string>("—");

  const fetchStats = useCallback(async () => {
    if (!readProvider) return;
    try {
      const contract = new Contract(
        ADDRESSES.MEMEPLUS,
        memePlusAbi as InterfaceAbi,
        readProvider
      );
      const count = await contract.getAllMembersCount();
      setTotalMembers(Number(count).toLocaleString());
    } catch (e) {
      console.error("fetchStats error:", e);
      setTotalMembers("—");
    }
  }, [readProvider]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const adminLinks = [
    {
      href: "/admin/members",
      title: "会员管理",
      description: "查看所有会员、设置社区等级、暂停/冻结账户",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      href: "/admin/settlement",
      title: "结算管理",
      description: "周期结算、每日收益发放、单人/批量结算",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      href: "/admin/config",
      title: "参数配置",
      description: "调整收益率、手续费、推荐奖励等平台参数",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      href: "/admin/operations",
      title: "运营操作",
      description: "管理员权限、收款钱包、紧急暂停",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          />
        </svg>
      ),
    },
  ];

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
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">管理后台</h1>
          <p className="text-muted">Memepro 平台管理控制台</p>
        </div>
        <span className="badge badge-danger ml-auto">管理员</span>
      </div>

      {/* 链上会员总数 */}
      <div className="card glow-accent">
        <p className="text-muted text-sm mb-1">链上注册会员总数</p>
        <p className="text-4xl font-bold">{totalMembers}</p>
        <p className="text-xs text-muted mt-2">数据来自链上合约，实时读取</p>
      </div>

      {/* 快捷入口 */}
      <div>
        <h2 className="text-lg font-bold mb-4">管理功能</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {adminLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="card card-hover cursor-pointer group"
            >
              <div className="text-accent mb-3 group-hover:text-accent-light transition-colors">
                {link.icon}
              </div>
              <h3 className="font-bold text-lg mb-1 group-hover:text-accent transition-colors">
                {link.title}
              </h3>
              <p className="text-muted text-sm">{link.description}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
