import { useState } from "react";

function normalizeTag(value) {
  return String(value || "").trim();
}

function listWithAdded(list, rawValue) {
  const value = normalizeTag(rawValue);
  if (!value) {
    return list;
  }
  if (list.includes(value)) {
    return list;
  }
  return [...list, value];
}

function listWithout(list, value) {
  return list.filter((tag) => tag !== value);
}

function TagEditor({ title, description, list, lockedList, addValue, onAddValueChange, onAdd, onRemove }) {
  const lockedSet = new Set(lockedList || []);
  const [selectedTag, setSelectedTag] = useState("");

  return (
    <section className="settings-group">
      <h3>{title}</h3>
      <p className="meta">{description}</p>

      <div className="tag-list">
        {list.map((tag) => {
          const isLocked = lockedSet.has(tag);
          const isSelected = selectedTag === tag;
          if (isLocked) {
            return (
              <button
                className={`tag-chip locked ${isSelected ? "selected" : ""}`}
                key={tag}
                onClick={() => setSelectedTag(tag)}
                title="Default option (cannot be deleted)"
                type="button"
              >
                {tag}
              </button>
            );
          }

          return (
            <button
              className={`tag-chip ${isSelected ? "selected" : ""}`}
              key={tag}
              onClick={() => setSelectedTag(tag)}
              title="Select tag"
              type="button"
            >
              {tag}
              <span
                className="tag-remove"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(tag);
                  if (selectedTag === tag) {
                    setSelectedTag("");
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onRemove(tag);
                    if (selectedTag === tag) {
                      setSelectedTag("");
                    }
                  }
                }}
                title="Delete custom option"
              >
                x
              </span>
            </button>
          );
        })}
      </div>

      <div className="row compact-row">
        <input
          value={addValue}
          onChange={(e) => onAddValueChange(e.target.value)}
          placeholder={`Add ${title.toLowerCase()} option`}
        />
        <button onClick={onAdd} type="button">
          Add
        </button>
      </div>
    </section>
  );
}

export default function SettingsPanel({ config, saving, onSave }) {
  const [newCategory, setNewCategory] = useState("");
  const [newOccasion, setNewOccasion] = useState("");
  const [newSeason, setNewSeason] = useState("");
  const [newStyle, setNewStyle] = useState("");

  if (!config) {
    return null;
  }

  const defaults = config.lockedDefaults || {};

  async function update(next) {
    await onSave({
      ...config,
      ...next,
    });
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Tag Settings</h2>
        {saving ? <span className="meta">Saving...</span> : <span className="meta">Auto-saves</span>}
      </div>

      <TagEditor
        title="Categories"
        description="Controls clothing type dropdown choices when adding wardrobe items."
        list={config.categories}
        lockedList={defaults.categories}
        addValue={newCategory}
        onAddValueChange={setNewCategory}
        onAdd={async () => {
          await update({ categories: listWithAdded(config.categories, newCategory) });
          setNewCategory("");
        }}
        onRemove={(tag) => update({ categories: listWithout(config.categories, tag) })}
      />

      <TagEditor
        title="Occasions"
        description="Used in outfit generation filters and upload tagging."
        list={config.occasionTags}
        lockedList={defaults.occasionTags}
        addValue={newOccasion}
        onAddValueChange={setNewOccasion}
        onAdd={async () => {
          await update({ occasionTags: listWithAdded(config.occasionTags, newOccasion) });
          setNewOccasion("");
        }}
        onRemove={(tag) => update({ occasionTags: listWithout(config.occasionTags, tag) })}
      />

      <TagEditor
        title="Seasons"
        description="Shown as choices when tagging wardrobe items."
        list={config.seasonTags}
        lockedList={defaults.seasonTags}
        addValue={newSeason}
        onAddValueChange={setNewSeason}
        onAdd={async () => {
          await update({ seasonTags: listWithAdded(config.seasonTags, newSeason) });
          setNewSeason("");
        }}
        onRemove={(tag) => update({ seasonTags: listWithout(config.seasonTags, tag) })}
      />

      <TagEditor
        title="Styles"
        description="Optional style labels for your own wardrobe organization."
        list={config.styleTags}
        lockedList={defaults.styleTags}
        addValue={newStyle}
        onAddValueChange={setNewStyle}
        onAdd={async () => {
          await update({ styleTags: listWithAdded(config.styleTags, newStyle) });
          setNewStyle("");
        }}
        onRemove={(tag) => update({ styleTags: listWithout(config.styleTags, tag) })}
      />
    </section>
  );
}
