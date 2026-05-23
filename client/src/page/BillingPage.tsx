import { Coins, Check, Loader2, ArrowDown, ArrowUp } from "lucide-react";
import { useMe, useCreditPacks, useTransactions, useTopUp } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

export default function BillingPage() {
  const { data: me } = useMe();
  const { data: packs } = useCreditPacks();
  const { data: transactions } = useTransactions();
  const topUp = useTopUp();

  const handleBuy = async (packId: string) => {
    try {
      await topUp.mutateAsync(packId);
      toast.success("Credits added");
    } catch (e) {
      toast.error("Top-up failed");
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Billing</h1>
      <p className="text-muted mb-8">Manage your credits and view usage history.</p>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-accent/20 via-accent/10 to-surface border border-accent/30 rounded-2xl p-8 mb-8">
        <div className="flex items-center gap-2 text-sm text-muted mb-2">
          <Coins size={14} className="text-accent" />
          Current balance
        </div>
        <div className="flex items-end gap-3 mb-4">
          <div className="text-5xl font-bold">{me?.credits ?? 0}</div>
          <div className="text-muted pb-2">credits</div>
        </div>
        <p className="text-sm text-muted">
          1 credit ≈ 1 second of rendered video. A 15s render costs 10 credits.
        </p>
      </div>

      {/* Credit packs */}
      <h2 className="text-lg font-semibold mb-4">Top up</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {packs?.map((pack) => (
          <div
            key={pack.id}
            className={cn(
              "relative bg-surface border rounded-2xl p-6 transition-all",
              pack.popular
                ? "border-accent shadow-accent"
                : "border-border hover:border-neutral-700"
            )}
          >
            {pack.popular && (
              <Badge variant="accent" className="absolute -top-2.5 left-6">
                Most popular
              </Badge>
            )}
            <div className="text-3xl font-bold mb-1">{pack.credits}</div>
            <div className="text-sm text-muted mb-4">credits</div>
            <div className="text-2xl font-bold mb-1">${pack.priceUsd}</div>
            <div className="text-xs text-muted mb-5">
              ${(pack.priceUsd / pack.credits).toFixed(3)} per credit
            </div>
            <Button
              onClick={() => handleBuy(pack.id)}
              variant={pack.popular ? "default" : "secondary"}
              className="w-full"
              disabled={topUp.isPending}
            >
              {topUp.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Buy {pack.credits} credits
            </Button>
          </div>
        ))}
      </div>

      {/* Transaction history */}
      <h2 className="text-lg font-semibold mb-4">Recent activity</h2>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {transactions && transactions.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left px-5 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                  Reason
                </th>
                <th className="text-right px-5 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-right px-5 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                  When
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border-soft last:border-0">
                  <td className="px-5 py-3.5">
                    {tx.delta > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-success">
                        <ArrowDown size={13} />
                        Credit
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <ArrowUp size={13} />
                        Spend
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 capitalize text-muted">
                    {tx.reason.replace(/_/g, " ")}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold">
                    {tx.delta > 0 ? "+" : ""}
                    {tx.delta}
                  </td>
                  <td className="px-5 py-3.5 text-right text-muted">
                    {formatRelativeTime(tx.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-muted text-sm">
            No transactions yet
          </div>
        )}
      </div>
    </div>
  );
}
