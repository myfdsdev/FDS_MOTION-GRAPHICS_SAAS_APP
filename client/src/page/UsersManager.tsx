import { useState } from "react";
import { Trash2, Shield, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useMe, useAdminUsers, useAdminUpdateUser, useAdminDeleteUser } from "@/lib/queries";
import type { AdminUser } from "@/types";

export default function UsersManager() {
  const { data: me } = useMe();
  const { data: users = [], isLoading } = useAdminUsers();
  const updateUser = useAdminUpdateUser();
  const deleteUser = useAdminDeleteUser();
  const [editId, setEditId] = useState<string | null>(null);
  const [creditValue, setCreditValue] = useState("");

  const startEdit = (u: AdminUser) => {
    setEditId(u.id);
    setCreditValue(String(u.credits));
  };

  const saveCredits = async (u: AdminUser) => {
    const n = Number(creditValue);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a valid number");
      return;
    }
    try {
      await updateUser.mutateAsync({ id: u.id, credits: Math.round(n) });
      toast.success("Credits updated");
      setEditId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const toggleAdmin = async (u: AdminUser) => {
    try {
      await updateUser.mutateAsync({ id: u.id, role: u.isAdmin ? "user" : "admin" });
      toast.success(u.isAdmin ? "Admin removed" : "Made admin");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const remove = async (u: AdminUser) => {
    if (u.id === me?.id) {
      toast.error("You can't delete your own account.");
      return;
    }
    if (!window.confirm(`Delete ${u.email}? This removes their account and videos.`)) return;
    try {
      await deleteUser.mutateAsync(u.id);
      toast.success("User deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Users</h2>
          <p className="text-xs text-muted">Manage accounts, credits and access.</p>
        </div>
        <span className="text-xs text-muted">{users.length} total</span>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : users.length === 0 ? (
        <div className="text-sm text-muted">No users yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 px-3 font-medium">Credits</th>
                <th className="py-2 px-3 font-medium">Videos</th>
                <th className="py-2 px-3 font-medium">Role</th>
                <th className="py-2 px-3 font-medium">Joined</th>
                <th className="py-2 pl-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border-soft/60">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-fg">{u.name || "—"}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    {editId === u.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={creditValue}
                          onChange={(e) => setCreditValue(e.target.value)}
                          className="w-20 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent/50"
                        />
                        <button onClick={() => saveCredits(u)} className="text-accent hover:opacity-80" aria-label="Save">
                          <Check size={15} />
                        </button>
                        <button onClick={() => setEditId(null)} className="text-faint hover:text-fg" aria-label="Cancel">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(u)} className="rounded-md px-2 py-1 font-medium hover:bg-surface-2" title="Click to edit credits">
                        {u.credits.toLocaleString()}
                      </button>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-muted">{u.projectCount}</td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => toggleAdmin(u)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
                        u.isAdmin ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted hover:text-fg"
                      }`}
                      title="Toggle admin role"
                    >
                      <Shield size={11} /> {u.isAdmin ? "Admin" : "User"}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="py-2.5 pl-3 text-right">
                    <button
                      onClick={() => remove(u)}
                      disabled={u.id === me?.id}
                      className="rounded-md p-1.5 text-faint hover:bg-danger/10 hover:text-danger disabled:opacity-30 disabled:hover:bg-transparent"
                      title={u.id === me?.id ? "You can't delete yourself" : "Delete user"}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
