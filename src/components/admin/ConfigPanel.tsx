"use client";

import { useState } from "react";

interface ConfigGroup {
  title: string;
  items: {
    key: string;
    label: string;
    currentValue: number;
    unit: string;
    description: string;
  }[];
}

interface ConfigPanelProps {
  groups: ConfigGroup[];
  onSave: (key: string, value: number) => Promise<void>;
}

export default function ConfigPanel({ groups, onSave }: ConfigPanelProps) {
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const handleSave = async (key: string) => {
    const value = Number(editing[key]);
    if (isNaN(value)) return;
    setSaving(key);
    try {
      await onSave(key, value);
      setEditing((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.title} className="card">
          <h3 className="text-lg font-semibold mb-4">{group.title}</h3>
          <div className="space-y-4">
            {group.items.map((item) => (
              <div
                key={item.key}
                className="flex flex-col md:flex-row md:items-center gap-3 bg-background rounded-lg p-4"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted">{item.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">
                    Current: {item.currentValue} {item.unit}
                  </span>
                  <input
                    type="number"
                    value={editing[item.key] ?? ""}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [item.key]: e.target.value }))
                    }
                    placeholder="New value"
                    className="input w-32 text-sm"
                  />
                  <button
                    onClick={() => handleSave(item.key)}
                    disabled={!editing[item.key] || saving === item.key}
                    className="btn-primary text-sm py-2 px-4"
                  >
                    {saving === item.key ? "..." : "Save"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
