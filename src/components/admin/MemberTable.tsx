"use client";

import { useState } from "react";
import { shortenAddress } from "@/lib/utils";
import StatusBadge from "../shared/StatusBadge";

interface Member {
  address: string;
  teamA: number; // total deposits
  teamB: number; // total withdrawals
  teamC: number; // team performance
  invested: number;
  vLevel: number;
  status: "active" | "inactive" | "frozen" | "paused";
}

interface MemberTableProps {
  members: Member[];
  onPause: (address: string) => void;
  onFreeze: (address: string) => void;
  onSetLevel: (address: string, level: number) => void;
}

export default function MemberTable({
  members,
  onPause,
  onFreeze,
  onSetLevel,
}: MemberTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editLevel, setEditLevel] = useState<{ address: string; level: number } | null>(null);
  const perPage = 20;

  const filtered = members.filter((m) =>
    m.address.toLowerCase().includes(search.toLowerCase())
  );
  const paged = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Members ({filtered.length})</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search address..."
          className="input w-64"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left p-3 text-muted">Address</th>
              <th className="text-right p-3 text-muted">A (Deposits)</th>
              <th className="text-right p-3 text-muted">B (Withdrawals)</th>
              <th className="text-right p-3 text-muted">C (Team Perf)</th>
              <th className="text-right p-3 text-muted">Invested</th>
              <th className="text-center p-3 text-muted">V-Level</th>
              <th className="text-center p-3 text-muted">Status</th>
              <th className="text-center p-3 text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((m) => (
              <tr key={m.address} className="border-b border-card-border last:border-0 hover:bg-background/50">
                <td className="p-3 font-mono text-xs">{shortenAddress(m.address, 6)}</td>
                <td className="p-3 text-right">{m.teamA.toLocaleString()}</td>
                <td className="p-3 text-right">{m.teamB.toLocaleString()}</td>
                <td className="p-3 text-right">{m.teamC.toLocaleString()}</td>
                <td className="p-3 text-right font-semibold">{m.invested.toLocaleString()}</td>
                <td className="p-3 text-center">
                  {editLevel?.address === m.address ? (
                    <div className="flex items-center gap-1 justify-center">
                      <select
                        value={editLevel.level}
                        onChange={(e) => setEditLevel({ ...editLevel, level: Number(e.target.value) })}
                        className="input w-16 py-1 px-2 text-xs"
                      >
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((l) => (
                          <option key={l} value={l}>V{l}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => { onSetLevel(m.address, editLevel.level); setEditLevel(null); }}
                        className="text-success text-xs hover:underline"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditLevel({ address: m.address, level: m.vLevel })}
                      className="text-accent hover:underline"
                    >
                      V{m.vLevel}
                    </button>
                  )}
                </td>
                <td className="p-3 text-center">
                  <StatusBadge status={m.status} />
                </td>
                <td className="p-3 text-center">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => onPause(m.address)}
                      className="text-xs text-warning hover:underline"
                    >
                      {m.status === "paused" ? "Unpause" : "Pause"}
                    </button>
                    <button
                      onClick={() => onFreeze(m.address)}
                      className="text-xs text-danger hover:underline"
                    >
                      {m.status === "frozen" ? "Unfreeze" : "Freeze"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="btn-secondary text-sm py-1 px-3"
          >
            Prev
          </button>
          <span className="text-sm text-muted">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="btn-secondary text-sm py-1 px-3"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
