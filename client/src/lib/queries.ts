import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import * as api from "@/lib/api";
import type {
  AdminSettings,
  AspectRatio,
  Project,
  UploadLottieAssetInput,
  User,
  VideoPlan,
} from "@/types";

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
      // Stop polling on any terminal/editable state — only render-in-progress
      // states need live updates.
      const idle =
        status === "DONE" ||
        status === "FAILED" ||
        status === "READY_TO_EDIT";
      return idle ? false : 2000;
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ prompt, durationSec, referenceImage, aspectRatio }: { prompt: string; durationSec?: number; referenceImage?: string; aspectRatio?: AspectRatio }) =>
      api.createProject(prompt, durationSec, referenceImage, aspectRatio),
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

export function useUpdateProject(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sceneJson?: VideoPlan }) => api.updateProject(id!, input),
    onSuccess: (project) => {
      qc.setQueryData(["project", id], project);
    },
  });
}

export function useGenerateProject(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ prompt, durationSec, referenceImage }: { prompt: string; durationSec?: number; referenceImage?: string }) =>
      api.generateProject(id!, prompt, durationSec, referenceImage),
    onSuccess: (project) => {
      qc.setQueryData(["project", id], project);
      qc.invalidateQueries({ queryKey: ["me"] });
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

export function useAskAssistant() {
  return useMutation({
    mutationFn: (message: string) => api.askAssistant(message),
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

export function useProviderKeys(enabled = true) {
  return useQuery({
    queryKey: ["admin-provider-keys"],
    queryFn: api.getProviderKeys,
    enabled,
  });
}

export function useSaveProviderKeys() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keys: Record<string, string>) => api.saveProviderKeys(keys),
    onSuccess: (providers) => {
      qc.setQueryData(["admin-provider-keys"], providers);
    },
  });
}

export function useProviderModels(enabled = true) {
  return useQuery({
    queryKey: ["admin-provider-models"],
    queryFn: api.getProviderModels,
    enabled,
  });
}

export function useProvidersConfig(enabled = true) {
  return useQuery({
    queryKey: ["admin-providers-config"],
    queryFn: api.getProvidersConfig,
    enabled,
  });
}

export function useSaveProvidersConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cfg: api.ProvidersConfig) => api.saveProvidersConfig(cfg),
    onSuccess: (cfg) => qc.setQueryData(["admin-providers-config"], cfg),
  });
}

export function useSaveProviderModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (models: Record<string, string>) => api.saveProviderModels(models),
    onSuccess: (models) => {
      qc.setQueryData(["admin-provider-models"], models);
    },
  });
}

export function useLottieAssets(enabled = true) {
  return useQuery({
    queryKey: ["admin-lottie-assets"],
    queryFn: api.listLottieAssets,
    enabled,
  });
}

export function useUploadLottieAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadLottieAssetInput) => api.uploadLottieAsset(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-lottie-assets"] });
    },
  });
}
