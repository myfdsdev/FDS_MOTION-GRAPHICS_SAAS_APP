import { AppSetting } from "../models.js";

const SETTINGS_KEY = "app_settings";

const DEFAULT_SETTINGS = {
  allowUserApiKeys: true,
};

function normalizeSettings(value = {}) {
  return {
    allowUserApiKeys:
      typeof value.allowUserApiKeys === "boolean"
        ? value.allowUserApiKeys
        : DEFAULT_SETTINGS.allowUserApiKeys,
  };
}

export async function getAppSettings() {
  const row = await AppSetting.findOne({ key: SETTINGS_KEY }).lean();
  return normalizeSettings(row?.value);
}

export async function updateAppSettings(patch) {
  const current = await getAppSettings();
  const next = normalizeSettings({ ...current, ...patch });

  await AppSetting.updateOne(
    { key: SETTINGS_KEY },
    { $set: { value: next } },
    { upsert: true }
  );

  return next;
}
