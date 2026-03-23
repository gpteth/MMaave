"use client";

import CapProgress from "./CapProgress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Order {
  id: number;
  amount: number;
  createdAt: string;
  totalReturned: number;
  isActive: boolean;
  capLimit: number;
}

interface OrderListProps {
  orders: Order[];
}

export default function OrderList({ orders }: OrderListProps) {
  if (orders.length === 0) {
    return (
      <Card className="text-center py-8">
        <p className="text-muted">No investment orders yet</p>
        <p className="text-sm text-muted mt-1">Create your first investment to get started</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">My Orders</h3>
      <div className="space-y-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-background rounded-lg p-4 border border-card-border"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="font-semibold">{order.amount.toLocaleString()} USDT</span>
                <span className="text-xs text-muted ml-2">#{order.id}</span>
              </div>
              <Badge variant={order.isActive ? "success" : "warning"}>
                {order.isActive ? "Active" : "Completed"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div>
                <p className="text-muted">Created</p>
                <p>{order.createdAt}</p>
              </div>
              <div>
                <p className="text-muted">Earned</p>
                <p className="text-success">{order.totalReturned.toLocaleString()} USDT</p>
              </div>
            </div>
            <CapProgress earned={order.totalReturned} cap={order.capLimit} />
          </div>
        ))}
      </div>
    </Card>
  );
}
