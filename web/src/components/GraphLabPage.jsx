import { useEffect, useRef, useState } from "react";
import { LGraph, LGraphCanvas, LiteGraph } from "litegraph.js";
import "litegraph.js/css/litegraph.css";
import { API_BASE, getItems, saveOutfit } from "../api.js";

const STORAGE_KEY = "dressup.graphlab.pure.v1";
const IMAGE_CACHE = new Map();
let nodesRegistered = false;

function pickOne(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  return list[Math.floor(Math.random() * list.length)] || null;
}

function withLockFlag(item, locked) {
  if (!item) {
    return null;
  }
  return {
    ...item,
    __locked: Boolean(locked),
  };
}

function stripInternal(item) {
  if (!item) {
    return null;
  }
  const next = { ...item };
  delete next.__locked;
  return next;
}

function getCachedImage(url) {
  if (!url) {
    return null;
  }

  if (!IMAGE_CACHE.has(url)) {
    const image = new Image();
    image.src = url;
    IMAGE_CACHE.set(url, image);
  }

  return IMAGE_CACHE.get(url);
}

class OutfitItemPickerNode {
  constructor(category, title) {
    this.category = category;
    this.title = title;
    this.size = [270, 245];
    this.properties = {
      itemLabel: "None",
      itemId: "",
      locked: false,
    };

    this._labelToId = new Map();
    this._selectedItem = null;

    this.addOutput(category, "object");
    this.itemWidget = this.addWidget(
      "combo",
      "item",
      "None",
      (value) => {
        const label = String(value || "None");
        this.properties.itemLabel = label;
        this.properties.itemId = this._labelToId.get(label) || "";
      },
      { values: ["None"] },
    );

    this.addWidget("toggle", "lock item", false, (value) => {
      this.properties.locked = Boolean(value);
    });
  }

  getCategoryItems() {
    return (this.graph?.dressupItems || []).filter((item) => item.category === this.category);
  }

  syncWidgetOptions() {
    const items = this.getCategoryItems();
    const labels = ["None"];
    this._labelToId.clear();

    items.forEach((item, index) => {
      const baseName = String(item.name || "Unnamed").trim() || "Unnamed";
      const label = `${baseName} #${String(index + 1).padStart(2, "0")}`;
      labels.push(label);
      this._labelToId.set(label, item.id);
    });

    this.itemWidget.options.values = labels;

    if (!labels.includes(this.properties.itemLabel)) {
      this.properties.itemLabel = "None";
      this.properties.itemId = "";
      this.itemWidget.value = "None";
    }
  }

  onExecute() {
    this.syncWidgetOptions();

    const items = this.getCategoryItems();
    this._selectedItem = items.find((item) => item.id === this.properties.itemId) || null;
    this.setOutputData(0, withLockFlag(this._selectedItem, this.properties.locked));
  }

  onDrawForeground(ctx) {
    if (!ctx) {
      return;
    }

    const boxX = 10;
    const boxY = 64;
    const boxW = this.size[0] - 20;
    const boxH = 155;

    ctx.save();
    ctx.fillStyle = "#f2e4ff";
    ctx.strokeStyle = "#7d56a3";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    if (this._selectedItem?.imageUrl) {
      const image = getCachedImage(`${API_BASE}${this._selectedItem.imageUrl}`);
      if (image?.complete) {
        ctx.drawImage(image, boxX + 8, boxY + 8, boxW - 16, boxH - 42);
      }
    }

    ctx.fillStyle = "#2f1840";
    ctx.font = "12px sans-serif";
    const text = this._selectedItem ? this._selectedItem.name : `Select ${this.category}`;
    ctx.fillText(text.slice(0, 30), boxX + 8, boxY + boxH - 14);

    if (this.properties.locked) {
      ctx.fillStyle = "#fff7ce";
      ctx.strokeStyle = "#8a6c22";
      ctx.beginPath();
      ctx.roundRect(this.size[0] - 82, 8, 72, 20, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#5c430c";
      ctx.fillText("LOCKED", this.size[0] - 74, 22);
    }
    ctx.restore();
  }
}

class TopNode extends OutfitItemPickerNode {
  constructor() {
    super("top", "Top");
  }
}

class BottomNode extends OutfitItemPickerNode {
  constructor() {
    super("bottom", "Bottom");
  }
}

class ShoesNode extends OutfitItemPickerNode {
  constructor() {
    super("shoes", "Shoes");
  }
}

class AccessoriesNode extends OutfitItemPickerNode {
  constructor() {
    super("accessory", "Accessories");
  }
}

class ConstraintsNode {
  constructor() {
    this.size = [300, 235];
    this.properties = {
      formality: "any",
      minWarmth: 1,
      maxWarmth: 5,
      colorHarmony: "balanced",
      noRepeat: true,
    };

    this.addOutput("constraints", "object");
    this.addWidget("combo", "formality", this.properties.formality, (value) => {
      this.properties.formality = String(value || "any");
    }, { values: ["any", "casual", "office", "date-night", "formal", "athleisure"] });
    this.addWidget("number", "min warmth", this.properties.minWarmth, (value) => {
      this.properties.minWarmth = Math.max(1, Math.min(5, Number(value || 1)));
    });
    this.addWidget("number", "max warmth", this.properties.maxWarmth, (value) => {
      this.properties.maxWarmth = Math.max(1, Math.min(5, Number(value || 5)));
    });
    this.addWidget("combo", "color harmony", this.properties.colorHarmony, (value) => {
      this.properties.colorHarmony = String(value || "balanced");
    }, { values: ["balanced", "contrast", "neutral"] });
    this.addWidget("toggle", "no repeat item", this.properties.noRepeat, (value) => {
      this.properties.noRepeat = Boolean(value);
    });
  }

  onExecute() {
    this.setOutputData(0, { ...this.properties });
  }
}

class VariationsNode {
  constructor() {
    this.size = [350, 280];
    this._last = [];
    this._badges = [];

    this.addInput("top", "object");
    this.addInput("bottom", "object");
    this.addInput("shoes", "object");
    this.addInput("accessory", "object");
    this.addInput("constraints", "object");
    this.addOutput("compare", "array");

    this.addWidget("button", "build 3", "Build 3 Variations", () => this.generate());
  }

  pickFor(category, fixed, usedIds, constraints) {
    if (fixed) {
      return fixed;
    }

    let pool = (this.graph?.dressupItems || []).filter((item) => item.category === category);
    if (constraints?.formality && constraints.formality !== "any") {
      pool = pool.filter((item) => !item.occasions?.length || item.occasions.includes(constraints.formality));
    }
    if (constraints?.noRepeat) {
      pool = pool.filter((item) => !usedIds.has(item.id));
    }

    return pickOne(pool) || null;
  }

  generate() {
    const topIn = this.getInputData(0) || null;
    const bottomIn = this.getInputData(1) || null;
    const shoesIn = this.getInputData(2) || null;
    const accessoryIn = this.getInputData(3) || null;
    const constraints = this.getInputData(4) || {};
    const used = new Set();
    const variations = [];

    for (let index = 0; index < 3; index += 1) {
      const top = this.pickFor("top", topIn?.__locked ? topIn : null, used, constraints) || topIn || null;
      const bottom = this.pickFor("bottom", bottomIn?.__locked ? bottomIn : null, used, constraints) || bottomIn || null;
      const shoes = this.pickFor("shoes", shoesIn?.__locked ? shoesIn : null, used, constraints) || shoesIn || null;
      const accessory =
        this.pickFor("accessory", accessoryIn?.__locked ? accessoryIn : null, used, constraints) || accessoryIn || null;

      [top, bottom, shoes, accessory].filter(Boolean).forEach((item) => {
        if (constraints?.noRepeat) {
          used.add(item.id);
        }
      });

      const warmthValues = [top, bottom, shoes, accessory]
        .filter(Boolean)
        .map((item) => Number(item.warmthLevel ?? 3));
      const avgWarmth = warmthValues.length
        ? warmthValues.reduce((sum, value) => sum + value, 0) / warmthValues.length
        : 0;
      const lowConfidence = !top || !bottom;
      const categoryMismatch = [top, bottom, shoes, accessory]
        .filter(Boolean)
        .some((item) => !["top", "bottom", "shoes", "accessory"].includes(item.category));

      variations.push({
        name: `Variation ${index + 1}`,
        items: {
          top: stripInternal(top),
          bottom: stripInternal(bottom),
          shoes: stripInternal(shoes),
          accessory: stripInternal(accessory),
        },
        diagnostics: {
          avgWarmth: Number(avgWarmth.toFixed(2)),
          lowConfidence,
          categoryMismatch,
        },
      });
    }

    this._last = variations;
    this._badges = [
      variations.some((row) => row.diagnostics.lowConfidence) ? "low-confidence match" : null,
      variations.some((row) => row.diagnostics.categoryMismatch) ? "category mismatch" : null,
    ].filter(Boolean);

    if (this.graph) {
      this.graph.compareOutfits = variations;
      this.graph.statusMessage = "Built 3 variations";
      this.graph.statusTone = "success";
      this.graph.setDirtyCanvas(true, true);
      if (typeof this.graph.onCompareOutfits === "function") {
        this.graph.onCompareOutfits(variations);
      }
    }

    this.setOutputData(0, variations);
  }

  onExecute() {
    this.setOutputData(0, this._last);
  }

  onDrawForeground(ctx) {
    if (!ctx) {
      return;
    }

    ctx.save();
    ctx.fillStyle = "#2f1840";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Generated: ${this._last.length}`, 12, 76);

    if (this._badges.length) {
      ctx.fillStyle = "#7b1d35";
      this._badges.forEach((badge, index) => {
        ctx.fillText(badge, 12, 100 + index * 18);
      });
    }
    ctx.restore();
  }
}

class NameOutfitNode {
  constructor() {
    this.size = [320, 255];
    this.properties = {
      outfitName: "My Outfit",
    };
    this._latestOutfit = null;
    this._badges = [];

    this.addInput("top", "object");
    this.addInput("bottom", "object");
    this.addInput("shoes", "object");
    this.addInput("accessory", "object");
    this.addOutput("outfit", "object");

    this.addWidget("text", "name", this.properties.outfitName, (value) => {
      this.properties.outfitName = String(value || "").trim() || "My Outfit";
    });

    this.addWidget("button", "build outfit", "Build Outfit", () => {
      this.buildOutfit();
    });
  }

  onExecute() {
    const nextOutfit = {
      name: this.properties.outfitName,
      top: this.getInputData(0) || null,
      bottom: this.getInputData(1) || null,
      shoes: this.getInputData(2) || null,
      accessory: this.getInputData(3) || null,
    };

    this._latestOutfit = nextOutfit;
    this.setOutputData(0, nextOutfit);
  }

  buildOutfit() {
    if (this.graph) {
      this.graph.runStep(1, true);
    }

    const outfit = this._latestOutfit || {
      name: this.properties.outfitName,
      top: null,
      bottom: null,
      shoes: null,
      accessory: null,
    };

    const missing = [];
    if (!outfit.top) missing.push("top");
    if (!outfit.bottom) missing.push("bottom");
    const categoryMismatch = [outfit.top, outfit.bottom, outfit.shoes, outfit.accessory]
      .filter(Boolean)
      .some((item) => !["top", "bottom", "shoes", "accessory"].includes(item.category));
    const lowConfidence = !outfit.shoes;
    this._badges = [
      missing.length ? `missing required item: ${missing.join(", ")}` : null,
      categoryMismatch ? "category mismatch" : null,
      lowConfidence ? "low-confidence match" : null,
    ].filter(Boolean);

    if (this.graph) {
      this.graph.namedOutfit = outfit;
      this.graph.statusMessage = missing.length
        ? `Missing required items: ${missing.join(", ")}`
        : `Built outfit \"${outfit.name}\"`;
      this.graph.statusTone = missing.length ? "error" : "success";
      this.graph.setDirtyCanvas(true, true);

      if (typeof this.graph.onOutfitBuilt === "function") {
        this.graph.onOutfitBuilt({
          outfit,
          missing,
          diagnostics: {
            categoryMismatch,
            lowConfidence,
          },
        });
      }
    }
  }

  onDrawForeground(ctx) {
    if (!ctx) {
      return;
    }

    const outfit = this._latestOutfit;
    const lines = [
      `Name: ${this.properties.outfitName}`,
      `Top: ${outfit?.top?.name || "-"}`,
      `Bottom: ${outfit?.bottom?.name || "-"}`,
      `Shoes: ${outfit?.shoes?.name || "-"}`,
      `Accessory: ${outfit?.accessory?.name || "-"}`,
    ];

    ctx.save();
    ctx.fillStyle = "#2f1840";
    ctx.font = "12px sans-serif";
    lines.forEach((line, index) => {
      ctx.fillText(line.slice(0, 38), 12, 92 + index * 20);
    });

    if (this._badges.length) {
      ctx.fillStyle = "#7b1d35";
      this._badges.forEach((badge, index) => {
        ctx.fillText(badge.slice(0, 40), 12, 204 + index * 16);
      });
    }
    ctx.restore();
  }
}

function registerNodes() {
  if (nodesRegistered) {
    return;
  }

  LiteGraph.registerNodeType("dressup/top", TopNode);
  LiteGraph.registerNodeType("dressup/bottom", BottomNode);
  LiteGraph.registerNodeType("dressup/shoes", ShoesNode);
  LiteGraph.registerNodeType("dressup/accessories", AccessoriesNode);
  LiteGraph.registerNodeType("dressup/constraints", ConstraintsNode);
  LiteGraph.registerNodeType("dressup/build_variations", VariationsNode);
  LiteGraph.registerNodeType("dressup/name_outfit", NameOutfitNode);
  nodesRegistered = true;
}

function buildStarterGraph(graph) {
  graph.clear();

  const topNode = LiteGraph.createNode("dressup/top");
  const bottomNode = LiteGraph.createNode("dressup/bottom");
  const shoesNode = LiteGraph.createNode("dressup/shoes");
  const accessoriesNode = LiteGraph.createNode("dressup/accessories");
  const constraintsNode = LiteGraph.createNode("dressup/constraints");
  const variationsNode = LiteGraph.createNode("dressup/build_variations");
  const nameOutfitNode = LiteGraph.createNode("dressup/name_outfit");

  topNode.pos = [80, 120];
  bottomNode.pos = [390, 120];
  shoesNode.pos = [700, 120];
  accessoriesNode.pos = [1010, 120];
  constraintsNode.pos = [1310, 120];
  variationsNode.pos = [920, 430];
  nameOutfitNode.pos = [540, 430];

  [topNode, bottomNode, shoesNode, accessoriesNode, constraintsNode, variationsNode, nameOutfitNode].forEach((node) => graph.add(node));

  topNode.connect(0, nameOutfitNode, 0);
  bottomNode.connect(0, nameOutfitNode, 1);
  shoesNode.connect(0, nameOutfitNode, 2);
  accessoriesNode.connect(0, nameOutfitNode, 3);

  topNode.connect(0, variationsNode, 0);
  bottomNode.connect(0, variationsNode, 1);
  shoesNode.connect(0, variationsNode, 2);
  accessoriesNode.connect(0, variationsNode, 3);
  constraintsNode.connect(0, variationsNode, 4);
}

export default function GraphLabPage() {
  const canvasRef = useRef(null);
  const graphRef = useRef(null);
  const graphCanvasRef = useRef(null);
  const autoSaveRef = useRef(null);
  const toastTimerRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [compareOutfits, setCompareOutfits] = useState([]);

  function showToast(message, tone = "success") {
    setToast({ message, tone });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2400);
  }

  useEffect(() => {
    document.body.classList.add("graph-lab-mode");
    registerNodes();

    const graph = new LGraph();
    graphRef.current = graph;

    if (canvasRef.current) {
      graphCanvasRef.current = new LGraphCanvas(canvasRef.current, graph);
      graphCanvasRef.current.bgcolor = "#efe3ff";
      graphCanvasRef.current.allow_dragcanvas = true;
      graphCanvasRef.current.allow_searchbox = true;
      graphCanvasRef.current.ds.scale = 0.86;
    }

    graph.onOutfitBuilt = async ({ outfit, missing }) => {
      if (Array.isArray(missing) && missing.length) {
        showToast(`Missing required items: ${missing.join(", ")}`, "error");
        return;
      }

      try {
        await saveOutfit({
          name: outfit.name,
          items: {
            top: outfit.top,
            bottom: outfit.bottom,
            shoes: outfit.shoes,
            accessory: outfit.accessory,
          },
        });
        showToast(`Saved outfit: ${outfit.name}`, "success");
      } catch {
        showToast("Outfit built but could not be saved", "error");
      }
    };

    graph.onCompareOutfits = (rows) => {
      setCompareOutfits(Array.isArray(rows) ? rows : []);
    };

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        graph.configure(JSON.parse(saved));
      } catch {
        buildStarterGraph(graph);
      }
    } else {
      buildStarterGraph(graph);
    }

    // Keep node execution running so dropdown widgets stay in sync with wardrobe data.
    graph.start(50);

    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(400, window.innerWidth);
      const height = Math.max(400, window.innerHeight);

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);

      if (graphCanvasRef.current) {
        graphCanvasRef.current.setDirty(true, true);
        graphCanvasRef.current.ds.scale = Math.min(1, Math.max(0.65, width / 1650));
      }
    };

    resize();
    window.addEventListener("resize", resize);

    autoSaveRef.current = window.setInterval(() => {
      if (graphRef.current) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(graphRef.current.serialize()));
      }
    }, 3000);

    return () => {
      document.body.classList.remove("graph-lab-mode");
      window.removeEventListener("resize", resize);

      if (autoSaveRef.current) {
        window.clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }

      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }

      if (graphCanvasRef.current) {
        graphCanvasRef.current.stopRendering();
        graphCanvasRef.current = null;
      }

      if (graphRef.current) {
        graphRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    async function loadItems() {
      try {
        const rows = await getItems();
        if (graphRef.current) {
          graphRef.current.dressupItems = rows;
          graphRef.current.statusMessage = `Wardrobe synced (${rows.length} items)`;
          graphRef.current.statusTone = "success";
          graphRef.current.runStep(1, true);
          graphRef.current.setDirtyCanvas(true, true);
        }
      } catch {
        if (graphRef.current) {
          graphRef.current.statusMessage = "Unable to load wardrobe data";
          graphRef.current.statusTone = "error";
          graphRef.current.setDirtyCanvas(true, true);
        }
      }
    }

    loadItems();
  }, []);

  return (
    <main className="graph-lab-pure">
      <canvas className="graph-full-canvas" ref={canvasRef} />
      {toast ? <div className={`graph-toast graph-toast-${toast.tone}`}>{toast.message}</div> : null}
      {compareOutfits.length ? (
        <section className="graph-compare-tray">
          <header>
            <h3>Compare Variations</h3>
            <button type="button" className="secondary-btn" onClick={() => setCompareOutfits([])}>
              Close
            </button>
          </header>
          <div className="graph-compare-grid">
            {compareOutfits.map((row, index) => (
              <article className="graph-compare-card" key={`${row.name}-${index}`}>
                <h4>{row.name}</h4>
                <p>
                  {row.items?.top?.name || "-"} / {row.items?.bottom?.name || "-"}
                </p>
                <p className="meta">
                  Shoes: {row.items?.shoes?.name || "None"} | Accessory: {row.items?.accessory?.name || "None"}
                </p>
                <p className="meta">Warmth: {row.diagnostics?.avgWarmth ?? "-"}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
