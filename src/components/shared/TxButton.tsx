"use client";

import { useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import PasswordModal from "../wallet/PasswordModal";
import { cn } from "@/lib/utils";

interface TxButtonProps {
  label: string;
  onClick: (passwordHash: string) => Promise<void>;
  disabled?: boolean;
  requirePassword?: boolean;
  className?: string;
}

export default function TxButton({
  label,
  onClick,
  disabled = false,
  requirePassword = false,
  className = "",
}: TxButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleClick = async () => {
    if (requirePassword) {
      setShowPassword(true);
    } else {
      await executeTx("");
    }
  };

  const executeTx = async (passwordHash: string) => {
    setLoading(true);
    setError(null);
    try {
      await onClick(passwordHash);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
      setShowPassword(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={disabled || loading}
        className={cn(className)}
      >
        {loading ? (
          <>
            <Spinner />
            {t("common.processing")}
          </>
        ) : (
          label
        )}
      </Button>
      {error && <p className="text-danger text-sm mt-2">{error}</p>}
      {showPassword && (
        <PasswordModal
          onConfirm={executeTx}
          onCancel={() => setShowPassword(false)}
        />
      )}
    </>
  );
}
