import { useEffect, useState } from "react";

const DEFAULT_CATEGORIES = ["top", "bottom", "shoes", "accessory"];
const DEFAULT_OCCASIONS = ["casual"];
const DEFAULT_SEASONS = ["spring", "summer"];
const DEFAULT_STYLES = [];

function selectedOptions(event) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

export default function UploadForm({ onCreate, loading, config, onAddConfigTag }) {
  const categories = config?.categories || DEFAULT_CATEGORIES;
  const occasionTags = config?.occasionTags || DEFAULT_OCCASIONS;
  const seasonTags = config?.seasonTags || DEFAULT_SEASONS;
  const styleTags = config?.styleTags || DEFAULT_STYLES;

  const [form, setForm] = useState({
    name: "",
    category: categories[0] || "top",
    seasons: seasonTags.slice(0, 2),
    occasions: occasionTags.slice(0, 1),
    styleTags: [],
    warmthLevel: 3,
    image: null,
  });
  const [newOccasion, setNewOccasion] = useState("");
  const [newSeason, setNewSeason] = useState("");
  const [newStyle, setNewStyle] = useState("");

  useEffect(() => {
    setForm((prev) => {
      const nextCategory = categories.includes(prev.category) ? prev.category : categories[0] || "top";
      const nextOccasions = prev.occasions.filter((tag) => occasionTags.includes(tag));
      const nextSeasons = prev.seasons.filter((tag) => seasonTags.includes(tag));
      const nextStyleTags = prev.styleTags.filter((tag) => styleTags.includes(tag));

      return {
        ...prev,
        category: nextCategory,
        occasions: nextOccasions.length ? nextOccasions : occasionTags.slice(0, 1),
        seasons: nextSeasons.length ? nextSeasons : seasonTags.slice(0, 2),
        styleTags: nextStyleTags,
      };
    });
  }, [categories, occasionTags, seasonTags, styleTags]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function addTag(kind, value, resetInput, attachToField) {
    if (!config?.[kind] || typeof onAddConfigTag !== "function") {
      return;
    }

    const normalized = String(value || "").trim();
    if (!normalized) {
      return;
    }

    await onAddConfigTag(kind, normalized);
    if (attachToField) {
      setForm((prev) => {
        const current = Array.isArray(prev[attachToField]) ? prev[attachToField] : [];
        if (current.includes(normalized)) {
          return prev;
        }
        return {
          ...prev,
          [attachToField]: [...current, normalized],
        };
      });
    }
    resetInput("");
  }

  async function submit(event) {
    event.preventDefault();

    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("category", form.category);
    form.seasons.forEach((tag) => fd.append("seasons", tag));
    form.occasions.forEach((tag) => fd.append("occasions", tag));
    form.styleTags.forEach((tag) => fd.append("styleTags", tag));
    fd.append("warmthLevel", String(form.warmthLevel));
    if (form.image) {
      fd.append("image", form.image);
    }

    await onCreate(fd);
    setForm((prev) => ({ ...prev, name: "", image: null }));
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>Add Wardrobe Item</h2>
      <label>
        Name
        <input
          required
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="White Oxford Shirt"
        />
      </label>

      <label>
        Category
        <select
          value={form.category}
          onChange={(e) => updateField("category", e.target.value)}
        >
          {categories.map((category) => (
            <option value={category} key={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label>
        Occasions
        <select
          multiple
          value={form.occasions}
          onChange={(e) => updateField("occasions", selectedOptions(e))}
        >
          {occasionTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </label>
      <div className="row compact-row tag-inline-add">
        <input
          value={newOccasion}
          onChange={(e) => setNewOccasion(e.target.value)}
          placeholder="Add custom occasion"
        />
        <button
          onClick={async () =>
            addTag("occasionTags", newOccasion, setNewOccasion, "occasions")
          }
          type="button"
        >
          Add
        </button>
      </div>

      <label>
        Seasons
        <select
          multiple
          value={form.seasons}
          onChange={(e) => updateField("seasons", selectedOptions(e))}
        >
          {seasonTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </label>
      <div className="row compact-row tag-inline-add">
        <input
          value={newSeason}
          onChange={(e) => setNewSeason(e.target.value)}
          placeholder="Add custom season"
        />
        <button
          onClick={async () => addTag("seasonTags", newSeason, setNewSeason, "seasons")}
          type="button"
        >
          Add
        </button>
      </div>

      <label>
        Style Tags (optional)
        <select
          multiple
          value={form.styleTags}
          onChange={(e) => updateField("styleTags", selectedOptions(e))}
        >
          {styleTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </label>
      <div className="row compact-row tag-inline-add">
        <input
          value={newStyle}
          onChange={(e) => setNewStyle(e.target.value)}
          placeholder="Add custom style"
        />
        <button
          onClick={async () => addTag("styleTags", newStyle, setNewStyle, "styleTags")}
          type="button"
        >
          Add
        </button>
      </div>

      <label>
        Warmth Level (1 cool to 5 warm)
        <input
          type="number"
          min="1"
          max="5"
          value={form.warmthLevel}
          onChange={(e) => updateField("warmthLevel", Number(e.target.value))}
        />
      </label>

      <label>
        Photo
        <input
          type="file"
          accept="image/*"
          required
          onChange={(e) => updateField("image", e.target.files?.[0] || null)}
        />
      </label>

      <button disabled={loading} type="submit">
        {loading ? "Uploading..." : "Add Item"}
      </button>
    </form>
  );
}
