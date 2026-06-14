import { useEffect, useState } from "react";
import { getConfig, updateConfig } from "../api.js";

export function useConfig(onError) {
  const [config, setConfig] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);

  async function refreshConfig() {
    try {
      const nextConfig = await getConfig();
      setConfig(nextConfig || null);
    } catch (err) {
      onError?.(err.message || "Unable to load config");
    }
  }

  useEffect(() => {
    refreshConfig();
  }, []);

  async function handleSaveConfig(nextConfig) {
    setSavingConfig(true);
    onError?.("");
    try {
      const saved = await updateConfig(nextConfig);
      setConfig(saved);
      return saved;
    } catch (err) {
      onError?.(err.message || "Unable to save config");
      return null;
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleAddConfigTag(kind, value) {
    const normalized = String(value || "").trim();
    if (!normalized || !config) {
      return;
    }

    const current = Array.isArray(config[kind]) ? config[kind] : [];
    if (current.includes(normalized)) {
      return;
    }

    await handleSaveConfig({
      ...config,
      [kind]: [...current, normalized],
    });
  }

  return {
    config,
    savingConfig,
    refreshConfig,
    handleSaveConfig,
    handleAddConfigTag,
  };
}
