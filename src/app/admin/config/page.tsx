"use client";

import { useWeb3 } from "@/contexts/Web3Context";
import { useState, useEffect, useCallback } from "react";
import { useAdminActions } from "@/hooks/useAdminActions";
import { Contract, type InterfaceAbi } from "ethers";
import { ADDRESSES } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import ConnectButton from "@/components/shared/ConnectButton";

// ---- 数值转换辅助函数 ----

// bps → 显示用百分比字符串（500 → "5.00"）
const bpsToDisplay = (v: string) =>
  v === "..." ? "..." : (Number(v) / 100).toFixed(2);

// 用户输入百分比 → bps 整数（"5" → 500）
const displayToBps = (v: string) => Math.round(parseFloat(v) * 100);

// wei → USDT 显示（"100000000000000000000" → "100"）
const weiToUsdt = (v: string) => {
  if (v === "...") return "...";
  try {
    return (Number(BigInt(v)) / 1e18).toFixed(0);
  } catch {
    return "...";
  }
};

// USDT → wei bigint（"100" → 100000000000000000000n）
const usdtToWei = (v: string) =>
  BigInt(Math.round(parseFloat(v) * 1e6)) * BigInt(1e12);

// capMultiplier：250 → "2.50"
const capToDisplay = (v: string) =>
  v === "..." ? "..." : (Number(v) / 100).toFixed(2);

// "2.5" → 250
const displayToCap = (v: string) => Math.round(parseFloat(v) * 100);

// ---- 字段类型枚举 ----
type FieldType = "bps" | "usdt" | "cap";

interface ConfigItem {
  key: string;
  label: string;
  description: string;
  fieldType: FieldType;
  placeholder: string;
}

interface ConfigGroup {
  title: string;
  items: ConfigItem[];
}

const configGroups: ConfigGroup[] = [
  {
    title: "📈 投资设置",
    items: [
      {
        key: "dailyRate",
        label: "每日静态收益率",
        description: "会员每天可领取的静态收益比例",
        fieldType: "bps",
        placeholder: "如：0.5",
      },
      {
        key: "minAmount",
        label: "最低投资金额",
        description: "会员单次最低投资金额（USDT）",
        fieldType: "usdt",
        placeholder: "如：100",
      },
      {
        key: "capMultiplier",
        label: "收益上限倍数",
        description: "会员总收益不超过投资本金的此倍数",
        fieldType: "cap",
        placeholder: "如：2.5",
      },
    ],
  },
  {
    title: "💰 收益分配",
    items: [
      {
        key: "staticRatio",
        label: "静态收益占比",
        description: "每日收益中分配给静态部分的比例（与动态之和须为100%）",
        fieldType: "bps",
        placeholder: "如：70",
      },
      {
        key: "dynamicRatio",
        label: "动态收益占比",
        description: "每日收益中分配给动态/推荐部分的比例",
        fieldType: "bps",
        placeholder: "如：30",
      },
      {
        key: "balanceCredit",
        label: "静态→余额比例",
        description: "静态收益中直接计入USDT余额的部分",
        fieldType: "bps",
        placeholder: "如：90",
      },
      {
        key: "mmBurn",
        label: "静态→BCK销毁",
        description: "静态收益中用于购买并销毁BCK的部分",
        fieldType: "bps",
        placeholder: "如：5",
      },
      {
        key: "mmLock",
        label: "静态→BCK锁仓",
        description: "静态收益中转换为锁仓BCK代币的部分",
        fieldType: "bps",
        placeholder: "如：5",
      },
    ],
  },
  {
    title: "👥 推荐奖励",
    items: [
      {
        key: "gen1Rate",
        label: "一代推荐奖励",
        description: "直接推荐人获得的奖励比例",
        fieldType: "bps",
        placeholder: "如：10",
      },
      {
        key: "gen2Rate",
        label: "二代推荐奖励",
        description: "二级推荐人获得的奖励比例",
        fieldType: "bps",
        placeholder: "如：5",
      },
      {
        key: "gen3Rate",
        label: "三代推荐奖励",
        description: "三级推荐人获得的奖励比例",
        fieldType: "bps",
        placeholder: "如：3",
      },
    ],
  },
  {
    title: "🏊 动态池分配",
    items: [
      {
        key: "referralShare",
        label: "推荐池占比",
        description: "动态池中分给推荐奖励的比例（与团队之和须为100%）",
        fieldType: "bps",
        placeholder: "如：50",
      },
      {
        key: "teamShare",
        label: "团队池占比",
        description: "动态池中分给团队奖励的比例",
        fieldType: "bps",
        placeholder: "如：50",
      },
    ],
  },
  {
    title: "💳 提款设置",
    items: [
      {
        key: "minWithdraw",
        label: "最低提款金额",
        description: "单次提款最低金额（USDT），须为10的整数倍",
        fieldType: "usdt",
        placeholder: "如：10",
      },
      {
        key: "withdrawFee",
        label: "提款手续费",
        description: "提款时扣除的手续费比例",
        fieldType: "bps",
        placeholder: "如：5",
      },
    ],
  },
  {
    title: "🌟 社区奖励等级",
    items: [
      {
        key: "communityRate0",
        label: "社区L1等级收益率",
        description: "管理员指定L1等级会员的社区收益率",
        fieldType: "bps",
        placeholder: "如：1",
      },
      {
        key: "communityRate1",
        label: "社区L2等级收益率",
        description: "管理员指定L2等级会员的社区收益率",
        fieldType: "bps",
        placeholder: "如：2",
      },
      {
        key: "communityRate2",
        label: "社区L3等级收益率",
        description: "管理员指定L3等级会员的社区收益率",
        fieldType: "bps",
        placeholder: "如：3",
      },
      {
        key: "communityRate3",
        label: "社区L4等级收益率",
        description: "管理员指定L4等级会员的社区收益率",
        fieldType: "bps",
        placeholder: "如：4",
      },
      {
        key: "communityRate4",
        label: "社区L5等级收益率",
        description: "管理员指定L5等级会员的社区收益率",
        fieldType: "bps",
        placeholder: "如：5",
      },
    ],
  },
  {
    title: "⚖️ 平级奖励",
    items: [
      {
        key: "sameLevelBonus",
        label: "平级奖励比例",
        description: "同级别会员之间的奖励分配比例",
        fieldType: "bps",
        placeholder: "如：1",
      },
    ],
  },
  {
    title: "🔄 重启机制",
    items: [
      {
        key: "restartMMReleaseRate",
        label: "BCK每日释放比例",
        description: "重启后锁仓BCK每天释放的百分比",
        fieldType: "bps",
        placeholder: "如：1",
      },
      {
        key: "restartReferralRate",
        label: "重启推荐奖励率",
        description: "重启机制中推荐人获得的额外奖励",
        fieldType: "bps",
        placeholder: "如：20",
      },
      {
        key: "restartReferralCap",
        label: "重启推荐奖励上限",
        description: "重启推荐奖励的最大倍数上限",
        fieldType: "cap",
        placeholder: "如：1.5",
      },
      {
        key: "restartMMCompPercent",
        label: "BCK补偿比例",
        description: "重启时按未回本金额赠送BCK的比例",
        fieldType: "bps",
        placeholder: "如：30",
      },
    ],
  },
];

// Maps config keys to their contract setter calls
// 注意：value 参数已经是人类可读值，在此处转换为链上格式
const SAVE_HANDLERS: Record<
  string,
  (
    adminActions: ReturnType<typeof useAdminActions>,
    value: string,
    liveValues: Record<string, string>
  ) => Promise<unknown>
> = {
  dailyRate: (a, v) => a.setDailyReturnRate(displayToBps(v)),
  minAmount: (a, v) => a.setMinInvestment(usdtToWei(v)),
  capMultiplier: (a, v) => a.setCapMultiplier(displayToCap(v)),
  staticRatio: (a, v, lv) =>
    a.setStaticDynamicSplit(
      displayToBps(v),
      10000 - displayToBps(v)
    ),
  dynamicRatio: (a, v) =>
    a.setStaticDynamicSplit(
      10000 - displayToBps(v),
      displayToBps(v)
    ),
  balanceCredit: (a, v, lv) =>
    a.setStaticDistribution(
      displayToBps(v),
      displayToBps(lv.mmBurn || "0"),
      10000 - displayToBps(v) - displayToBps(lv.mmBurn || "0")
    ),
  mmBurn: (a, v, lv) =>
    a.setStaticDistribution(
      displayToBps(lv.balanceCredit || "0"),
      displayToBps(v),
      10000 - displayToBps(lv.balanceCredit || "0") - displayToBps(v)
    ),
  mmLock: (a, v, lv) =>
    a.setStaticDistribution(
      10000 - displayToBps(v) - displayToBps(lv.mmBurn || "0"),
      displayToBps(lv.mmBurn || "0"),
      displayToBps(v)
    ),
  gen1Rate: (a, v, lv) =>
    a.setReferralRates(
      displayToBps(v),
      displayToBps(lv.gen2Rate || "0"),
      displayToBps(lv.gen3Rate || "0")
    ),
  gen2Rate: (a, v, lv) =>
    a.setReferralRates(
      displayToBps(lv.gen1Rate || "0"),
      displayToBps(v),
      displayToBps(lv.gen3Rate || "0")
    ),
  gen3Rate: (a, v, lv) =>
    a.setReferralRates(
      displayToBps(lv.gen1Rate || "0"),
      displayToBps(lv.gen2Rate || "0"),
      displayToBps(v)
    ),
  referralShare: (a, v) =>
    a.setDynamicPoolSplit(displayToBps(v), 10000 - displayToBps(v)),
  teamShare: (a, v) =>
    a.setDynamicPoolSplit(10000 - displayToBps(v), displayToBps(v)),
  minWithdraw: (a, v) => a.setMinWithdrawal(usdtToWei(v)),
  withdrawFee: (a, v) => a.setWithdrawalFee(displayToBps(v)),
  sameLevelBonus: (a, v) => a.setSameLevelBonus(displayToBps(v)),
  restartMMReleaseRate: (a, v) =>
    a.setRestartMMReleaseRate(displayToBps(v)),
  restartReferralRate: (a, v) =>
    a.setRestartReferralRate(displayToBps(v)),
  restartReferralCap: (a, v) =>
    a.setRestartReferralCap(displayToCap(v)),
  restartMMCompPercent: (a, v) =>
    a.setRestartMMCompPercent(displayToBps(v)),
  communityRate0: (a, v, lv) =>
    a.setCommunityRates([
      displayToBps(v),
      displayToBps(lv.communityRate1 || "0"),
      displayToBps(lv.communityRate2 || "0"),
      displayToBps(lv.communityRate3 || "0"),
      displayToBps(lv.communityRate4 || "0"),
    ]),
  communityRate1: (a, v, lv) =>
    a.setCommunityRates([
      displayToBps(lv.communityRate0 || "0"),
      displayToBps(v),
      displayToBps(lv.communityRate2 || "0"),
      displayToBps(lv.communityRate3 || "0"),
      displayToBps(lv.communityRate4 || "0"),
    ]),
  communityRate2: (a, v, lv) =>
    a.setCommunityRates([
      displayToBps(lv.communityRate0 || "0"),
      displayToBps(lv.communityRate1 || "0"),
      displayToBps(v),
      displayToBps(lv.communityRate3 || "0"),
      displayToBps(lv.communityRate4 || "0"),
    ]),
  communityRate3: (a, v, lv) =>
    a.setCommunityRates([
      displayToBps(lv.communityRate0 || "0"),
      displayToBps(lv.communityRate1 || "0"),
      displayToBps(lv.communityRate2 || "0"),
      displayToBps(v),
      displayToBps(lv.communityRate4 || "0"),
    ]),
  communityRate4: (a, v, lv) =>
    a.setCommunityRates([
      displayToBps(lv.communityRate0 || "0"),
      displayToBps(lv.communityRate1 || "0"),
      displayToBps(lv.communityRate2 || "0"),
      displayToBps(lv.communityRate3 || "0"),
      displayToBps(v),
    ]),
};

// 根据字段类型将链上原始值转为显示值
function toDisplayValue(key: string, rawValue: string, fieldType: FieldType): string {
  if (rawValue === "...") return "...";
  if (fieldType === "usdt") return weiToUsdt(rawValue);
  if (fieldType === "cap") return capToDisplay(rawValue);
  return bpsToDisplay(rawValue); // bps
}

// 根据字段类型决定显示单位后缀
function unitSuffix(fieldType: FieldType): string {
  if (fieldType === "usdt") return " USDT";
  if (fieldType === "cap") return "x";
  return "%";
}

export default function ConfigPage() {
  const { isConnected, address, readProvider } = useWeb3();
  const adminActions = useAdminActions(address ?? undefined);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // liveValues 存储链上原始值（bps、wei 等）
  const [liveValues, setLiveValues] = useState<Record<string, string>>({});

  const fetchLiveValues = useCallback(async () => {
    if (!readProvider) return;
    try {
      const contract = new Contract(
        ADDRESSES.MEMEPLUS,
        memePlusAbi as InterfaceAbi,
        readProvider
      );
      const [
        dailyReturnRate,
        minInvestment,
        capMultiplier,
        staticPercent,
        dynamicPercent,
        staticToBalance,
        staticToBurn,
        staticToLock,
        referralGen1,
        referralGen2,
        referralGen3,
        referralSharePercent,
        teamSharePercent,
        minWithdrawal,
        withdrawalFee,
        sameLevelBonus,
        restartMMReleaseRate,
        restartReferralRate,
        restartReferralCap,
        restartMMCompPercent,
      ] = await Promise.all([
        contract.dailyReturnRate(),
        contract.minInvestment(),
        contract.capMultiplier(),
        contract.staticPercent(),
        contract.dynamicPercent(),
        contract.staticToBalance(),
        contract.staticToBurn(),
        contract.staticToLock(),
        contract.referralGen1(),
        contract.referralGen2(),
        contract.referralGen3(),
        contract.referralSharePercent(),
        contract.teamSharePercent(),
        contract.minWithdrawal(),
        contract.withdrawalFee(),
        contract.sameLevelBonus(),
        contract.restartMMReleaseRate(),
        contract.restartReferralRate(),
        contract.restartReferralCap(),
        contract.restartMMCompPercent(),
      ]);

      const communityRates = await Promise.all(
        [0, 1, 2, 3, 4].map((i) => contract.communityRates(i))
      );

      setLiveValues({
        dailyRate: dailyReturnRate.toString(),
        minAmount: minInvestment.toString(),
        capMultiplier: capMultiplier.toString(),
        staticRatio: staticPercent.toString(),
        dynamicRatio: dynamicPercent.toString(),
        balanceCredit: staticToBalance.toString(),
        mmBurn: staticToBurn.toString(),
        mmLock: staticToLock.toString(),
        gen1Rate: referralGen1.toString(),
        gen2Rate: referralGen2.toString(),
        gen3Rate: referralGen3.toString(),
        referralShare: referralSharePercent.toString(),
        teamShare: teamSharePercent.toString(),
        minWithdraw: minWithdrawal.toString(),
        withdrawFee: withdrawalFee.toString(),
        sameLevelBonus: sameLevelBonus.toString(),
        restartMMReleaseRate: restartMMReleaseRate.toString(),
        restartReferralRate: restartReferralRate.toString(),
        restartReferralCap: restartReferralCap.toString(),
        restartMMCompPercent: restartMMCompPercent.toString(),
        communityRate0: communityRates[0].toString(),
        communityRate1: communityRates[1].toString(),
        communityRate2: communityRates[2].toString(),
        communityRate3: communityRates[3].toString(),
        communityRate4: communityRates[4].toString(),
      });
    } catch (e) {
      console.error("fetchLiveValues error:", e);
    }
  }, [readProvider]);

  useEffect(() => {
    fetchLiveValues();
  }, [fetchLiveValues]);

  const handleEdit = (key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key: string, fieldType: FieldType) => {
    const handler = SAVE_HANDLERS[key];
    if (!handler) {
      setSaveError(`没有找到该字段的保存处理器: ${key}`);
      return;
    }
    const newDisplayValue = editValues[key];
    if (!newDisplayValue) return;

    setSavingKey(key);
    setSaveError(null);
    try {
      // liveValues 中存的是链上原始值，但传给 handler 的是用户输入的显示值
      // handler 内部负责转换回链上格式
      // 为了让后续 handler 中 lv.xxx 能正常读取用于联合调用的其他字段的显示值，
      // 我们需要将 liveValues 也转换成显示值传给 handler
      const displayLiveValues: Record<string, string> = {};
      configGroups.forEach((group) => {
        group.items.forEach((item) => {
          const raw = liveValues[item.key];
          if (raw !== undefined) {
            displayLiveValues[item.key] = toDisplayValue(
              item.key,
              raw,
              item.fieldType
            );
          }
        });
      });

      await handler(adminActions, newDisplayValue, displayLiveValues);
      // 清除输入框
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      // 刷新链上数据
      await fetchLiveValues();
    } catch (e: unknown) {
      console.error(`Save ${key} error:`, e);
      const err = e as { reason?: string; shortMessage?: string; message?: string };
      setSaveError(
        err?.reason || err?.shortMessage || err?.message || "交易失败，请重试"
      );
    } finally {
      setSavingKey(null);
    }
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
          <h1 className="text-2xl font-bold mb-1">参数配置</h1>
          <p className="text-muted">调整平台收益率、手续费、推荐奖励等核心参数</p>
        </div>
        <span className="badge badge-danger ml-auto">管理员</span>
      </div>

      {/* 无管理员权限提示 */}
      {!adminActions.isAdmin && (
        <div className="card border-l-4 border-l-danger">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-danger shrink-0 mt-0.5"
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
              <p className="font-bold text-danger">没有管理员权限</p>
              <p className="text-sm text-muted">
                您的钱包没有管理员权限，请联系合约所有者添加
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 操作提醒 */}
      <div className="card border-l-4 border-l-warning">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-warning shrink-0 mt-0.5"
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
            <p className="font-bold text-warning">注意</p>
            <p className="text-sm text-muted">
              修改参数将立即影响整个平台所有会员。每次修改都需要发起链上交易并支付 Gas 费用，请确认无误后再保存。
            </p>
          </div>
        </div>
      </div>

      {/* 保存错误提示 */}
      {saveError && (
        <div className="card border-l-4 border-l-danger">
          <p className="text-danger text-sm">{saveError}</p>
        </div>
      )}

      {/* 参数分组列表 */}
      {configGroups.map((group) => (
        <div key={group.title} className="card">
          <h2 className="text-lg font-bold mb-4">{group.title}</h2>
          <div className="space-y-1">
            {group.items.map((item) => {
              const isEditing = item.key in editValues;
              const isSaving = savingKey === item.key;
              const rawValue = liveValues[item.key] ?? "...";
              const displayValue = toDisplayValue(item.key, rawValue, item.fieldType);
              const suffix = unitSuffix(item.fieldType);

              return (
                <div
                  key={item.key}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-b border-card-border/50 last:border-0"
                >
                  {/* 字段说明 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted mt-0.5">{item.description}</p>
                    <p className="text-xs text-accent mt-1 font-mono">
                      当前值：
                      {displayValue === "..." ? (
                        <span className="text-muted">加载中...</span>
                      ) : (
                        <span>
                          {displayValue}
                          {suffix}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* 输入 + 保存 */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        className="input w-24 text-sm text-center py-2"
                        placeholder={item.placeholder}
                        value={editValues[item.key] || ""}
                        onChange={(e) => handleEdit(item.key, e.target.value)}
                      />
                      <span className="text-sm text-muted w-8">{suffix}</span>
                    </div>
                    <button
                      onClick={() => handleSave(item.key, item.fieldType)}
                      className="btn-primary text-xs py-2 px-3 whitespace-nowrap"
                      disabled={
                        !isEditing || isSaving || !adminActions.isAdmin
                      }
                    >
                      {isSaving ? "保存中..." : "保存"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
