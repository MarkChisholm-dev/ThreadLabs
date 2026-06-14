import { useEffect, useState } from "react";
import { createItem, deleteItem, getItems } from "../api.js";

export function useWardrobe(onError) {
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);

  async function refreshItems() {
    setLoadingItems(true);
    try {
      const rows = await getItems();
      setItems(rows || []);
    } catch (err) {
      onError?.(err.message || "Unable to load items");
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    refreshItems();
  }, []);

  async function handleCreate(formData) {
    setUploading(true);
    onError?.("");
    try {
      await createItem(formData);
      await refreshItems();
    } catch (err) {
      onError?.(err.message || "Unable to create item");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    onError?.("");
    try {
      await deleteItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      onError?.(err.message || "Unable to delete item");
    }
  }

  return {
    items,
    uploading,
    loadingItems,
    refreshItems,
    handleCreate,
    handleDelete,
  };
}
