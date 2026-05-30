import { API_BASE } from "../api.js";

export default function WardrobeGrid({ items, onDelete }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Your Wardrobe</h2>
        <span>{items.length} items</span>
      </div>

      <div className="grid">
        {items.map((item) => (
          <article className="card" key={item.id}>
            <img src={`${API_BASE}${item.imageUrl}`} alt={item.name} loading="lazy" />
            <div className="card-body">
              <h3>{item.name}</h3>
              <p>{item.category}</p>
              <p>{item.occasions.join(", ") || "Any occasion"}</p>
              <button onClick={() => onDelete(item.id)} type="button">
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
