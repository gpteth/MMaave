"use client";

import { useState } from "react";
import { keccak256, solidityPacked } from "ethers";
import { useWeb3 } from "@/contexts/Web3Context";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PasswordModalProps {
  onConfirm: (passwordHash: string) => void;
  onCancel: () => void;
}

export default function PasswordModal({
  onConfirm,
  onCancel,
}: PasswordModalProps) {
  const [password, setPassword] = useState("");
  const { address } = useWeb3();
  const { t } = useLanguage();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !address) return;

    const hash = keccak256(
      solidityPacked(["string", "address"], [password, address])
    );
    onConfirm(hash);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("password.title")}</DialogTitle>
          <DialogDescription>{t("password.desc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("password.placeholder")}
            className="mb-4"
            autoFocus
          />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!password} className="flex-1">
              {t("common.confirm")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
