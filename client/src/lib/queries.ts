import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { AdminSettings, Project, User } from "@/types";

// ---------- Auth ----------

export function useMe(opts?: Omit<UseQueryOptions<User | null>, "queryKey" | "queryFn">) {
  return useQuery<User | null>({
    queryKey: ["me"],
    queryFn: api.getMe,
    staleTime: 1000 * 30,
    ...opts,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      email,
      password,
      name,
    }: {
      email: string;
      password: string;
      name: string;
    }) => api.register(email, password, name),
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      qc.setQueryData(["me"], null);
      qc.clear();
    },
  });
}

// ---------- Profile ----------

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: api.getProfile,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (profile) => {
      qc.setQueryData(["profile"], profile);
      qc.setQueryData(["me"], profile.user);
    },
  });
}

// ---------- Projects ----------

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
  });
}

export function useProject(id: string | undefined) {
  return useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "DONE" || status === "FAILED" ? false : 2000;
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ prompt, durationSec }: { prompt: string; durationSec?: number }) =>
      api.createProject(prompt, durationSec),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useRerender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.rerenderProject(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useEnhancePrompt() {
  return useMutation({
    mutationFn: (prompt: string) => api.enhancePrompt(prompt),
  });
}

// ---------- Billing ----------

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: api.listTransactions,
  });
}

export function useCreditPacks() {
  return useQuery({
    queryKey: ["credit-packs"],
    queryFn: api.getCreditPacks,
  });
}

export function useTopUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packId: string) => api.topUp(packId),
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// ---------- Admin ----------

export function useAdminOverview(enabled = true) {
  return useQuery({
    queryKey: ["admin-overview"],
    queryFn: api.getAdminOverview,
    enabled,
  });
}

export function useUpdateAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AdminSettings>) => api.updateAdminSettings(input),
    onSuccess: (settings) => {
      qc.setQueryData(["admin-overview"], (current: unknown) => {
        if (!current || typeof current !== "object") return current;
        return { ...current, settings };
      });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
}
