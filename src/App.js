import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend
} from "recharts";
import { supabase } from "./supabaseClient";

const CATEGORIES = [
  { code: "CLO", name: "Clothing", subs: ["Men's", "Women's", "Children's", "Winter Wear"] },
  { code: "FOO", name: "Footwear", subs: ["Men's", "Women's", "Children's"] },
  { code: "TOI", name: "Toiletries", subs: ["Hygiene Kits", "Soap/Shampoo", "Dental", "Feminine Products"] },
  { code: "HOU", name: "Household", subs: ["Bedding", "Kitchenware", "Cleaning Supplies"] },
  { code: "FOD", name: "Food", subs: ["Canned", "Dry Goods", "Perishable"] },
  { code: "MON", name: "Monetary", subs: ["Cash", "Check", "Online Transfer"] },
  { code: "MIS", name: "Miscellaneous", subs: ["Books", "Toys", "Electronics", "Other"] },
];

const CONDITIONS = ["New", "Gently Used", "Worn", "Unusable"];
const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899"];
const STATUS_COLORS = {
  Received: "#f59e0b",
  "In Storage": "#3b82f6",
  Distributed: "#10b981",
  Unusable: "#ef4444",
};

const genId = (catCode, existingItems) => {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const todayCount = existingItems.filter((i) => i.id && i.id.startsWith(`${catCode}-${ds}`)).length;
  const seq = String(todayCount + 1).padStart(4, "0");
  return `${catCode}-${ds}-${seq}`;
};

const BarcodeDisplay = ({ code }) => {
  const bars = useMemo(() => {
    let result = [];
    let seed = 0;
    for (let i = 0; i < code.length; i++) seed += code.charCodeAt(i) * (i + 1);
    for (let i = 0; i < 50; i++) {
      seed = (seed * 31 + 7) % 997;
      result.push(seed % 3 === 0 ? 2 : 1);
    }
    return result;
  }, [code]);

  return (
    <svg viewBox="0 0 200 60" style={{ width: "100%", maxWidth: 220, display: "block" }}>
      <rect x="0" y="0" width="200" height="60" fill="white" rx="4" />
      {bars.map((w, i) => (
        <rect key={i} x={10 + i * 3.6} y="5" width={w} height="35" fill="black" />
      ))}
      <text x="100" y="52" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#333">
        {code}
      </text>
    </svg>
  );
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: "#475569",
  marginBottom: 4,
  display: "block",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 24,
  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
};

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [items, setItems] = useState([]);
  const [monetary, setMonetary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, monetaryRes] = await Promise.all([
        supabase.from("items").select("*").order("created_at", { ascending: false }),
        supabase.from("monetary").select("*").order("created_at", { ascending: false }),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (monetaryRes.error) throw monetaryRes.error;

      setItems(
        (itemsRes.data || []).map((row) => ({
          id: row.id,
          cat: row.category,
          catName: row.category_name,
          sub: row.subcategory,
          qty: row.quantity,
          condition: row.condition,
          donor: row.donor,
          status: row.status,
          date: row.date,
          notes: row.notes || "",
          urgent: row.urgent || false,
          location: row.location || "",
        }))
      );

      setMonetary(
        (monetaryRes.data || []).map((row) => ({
          id: row.id,
          amount: parseFloat(row.amount),
          type: row.type,
          donor: row.donor,
          date: row.date,
          purpose: row.purpose || "General Fund",
          notes: row.notes || "",
        }))
      );
    } catch (err) {
      console.error("Error fetching data:", err);
      showToast("Error loading data. Check console.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const itemsSub = supabase
      .channel("items-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => {
        fetchData();
      })
      .subscribe();

    const monetarySub = supabase
      .channel("monetary-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "monetary" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(itemsSub);
      supabase.removeChannel(monetarySub);
    };
  }, [fetchData]);

  const addItem = async (entry) => {
    const { error } = await supabase.from("items").insert({
      id: entry.id,
      category: entry.cat,
      category_name: entry.catName,
      subcategory: entry.sub,
      quantity: entry.qty,
      condition: entry.condition,
      donor: entry.donor,
      status: entry.status,
      date: entry.date,
      notes: entry.notes,
      urgent: entry.urgent,
      location: entry.location,
    });
    if (error) {
      console.error("Insert error:", error);
      showToast("Error saving item. Try again.");
      return false;
    }
    return true;
  };

  const updateItem = async (id, updates) => {
    const dbUpdates = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.qty !== undefined) dbUpdates.quantity = updates.qty;

    const { error } = await supabase.from("items").update(dbUpdates).eq("id", id);
    if (error) {
      console.error("Update error:", error);
      showToast("Error updating item. Try again.");
      return false;
    }
    return true;
  };

  const addMonetary = async (entry) => {
    const { error } = await supabase.from("monetary").insert({
      id: entry.id,
      amount: entry.amount,
      type: entry.type,
      donor: entry.donor,
      date: entry.date,
      purpose: entry.purpose,
      notes: entry.notes,
    });
    if (error) {
      console.error("Insert error:", error);
      showToast("Error saving donation. Try again.");
      return false;
    }
    return true;
  };

  const nav = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "receive", icon: "📦", label: "Receive" },
    { id: "inventory", icon: "🏷️", label: "Inventory" },
    { id: "distribute", icon: "🚚", label: "Distribute" },
    { id: "monetary", icon: "💰", label: "Monetary" },
    { id: "reports", icon: "📋", label: "Reports" },
  ];

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui", color: "#6366f1" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Loading Inventory System...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#f1f5f9", minHeight: "100vh" }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#10b981", color: "#fff", padding: "10px 24px", borderRadius: 8, fontWeight: 600, zIndex: 999, boxShadow: "0 4px 12px rgba(0,0,0,.15)", fontSize: 14 }}>
          {toast}
        </div>
      )}

      <div style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", padding: "16px 24px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🤝 NGO Inventory Manager</h1>
        <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.8 }}>Donation Tracking & Distribution System</p>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "8px 12px", background: "#fff", borderBottom: "1px solid #e2e8f0", overflowX: "auto", flexWrap: "wrap" }}>
        {nav.map((n) => (
          <button
            key={n.id}
            onClick={() => setPage(n.id)}
            style={{
              padding: "8px 14px",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: page === n.id ? 700 : 500,
              background: page === n.id ? "#eef2ff" : "transparent",
              color: page === n.id ? "#4f46e5" : "#64748b",
              whiteSpace: "nowrap",
            }}
          >
            {n.icon} {n.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
        {page === "dashboard" && <Dashboard items={items} monetary={monetary} />}
        {page === "receive" && (
          <ReceiveForm items={items} monetary={monetary} addItem={addItem} addMonetary={addMonetary} showToast={showToast} />
        )}
        {page === "inventory" && (
          <InventoryView items={items} updateItem={updateItem} showToast={showToast} />
        )}
        {page === "distribute" && (
          <DistributeView items={items} addItem={addItem} updateItem={updateItem} showToast={showToast} />
        )}
        {page === "monetary" && <MonetaryView monetary={monetary} />}
        {page === "reports" && <ReportsView items={items} monetary={monetary} />}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ ...cardStyle, padding: "16px 20px", flex: "1 1 140px", minWidth: 140, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Dashboard({ items, monetary }) {
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const inStock = items.filter((i) => i.status === "In Storage").reduce((s, i) => s + i.qty, 0);
  const distributed = items.filter((i) => i.status === "Distributed").reduce((s, i) => s + i.qty, 0);
  const totalMoney = monetary.reduce((s, m) => s + m.amount, 0);
  const urgent = items.filter((i) => i.urgent && i.status !== "Distributed");

  const catData = CATEGORIES.filter((c) => c.code !== "MON")
    .map((c) => ({
      name: c.name,
      qty: items.filter((i) => i.cat === c.code).reduce((s, i) => s + i.qty, 0),
    }))
    .filter((d) => d.qty > 0);

  const statusData = Object.entries(
    items.reduce((a, i) => {
      a[i.status] = (a[i.status] || 0) + i.qty;
      return a;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard icon="📦" label="Total Items Received" value={totalQty} color="#6366f1" />
        <StatCard icon="🏷️" label="Currently In Storage" value={inStock} color="#3b82f6" />
        <StatCard icon="🚚" label="Items Distributed" value={distributed} color="#10b981" />
        <StatCard icon="💰" label="Monetary Donations" value={`$${totalMoney.toLocaleString()}`} color="#f59e0b" />
        {urgent.length > 0 && <StatCard icon="⚡" label="Urgent Items" value={urgent.length} color="#ef4444" />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#334155" }}>Inventory by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={catData}>
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="qty" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#334155" }}>Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                fontSize={11}
              >
                {statusData.map((e, i) => (
                  <Cell key={i} fill={STATUS_COLORS[e.name] || COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {urgent.length > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 16, marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#dc2626" }}>⚡ Urgent / Perishable Items</h3>
          {urgent.map((i) => (
            <div key={i.id} style={{ fontSize: 13, padding: "4px 0", color: "#991b1b" }}>
              • {i.catName} — {i.sub} (Qty: {i.qty}) — {i.id}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReceiveForm({ items, monetary, addItem, addMonetary, showToast }) {
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");
  const [qty, setQty] = useState("");
  const [cond, setCond] = useState("New");
  const [donor, setDonor] = useState("");
  const [notes, setNotes] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [monAmt, setMonAmt] = useState("");
  const [monType, setMonType] = useState("Cash");
  const [monPurpose, setMonPurpose] = useState("General Fund");
  const [lastEntry, setLastEntry] = useState(null);
  const [saving, setSaving] = useState(false);

  const isMonetary = cat === "MON";
  const catObj = CATEGORIES.find((c) => c.code === cat);

  const reset = () => {
    setSub("");
    setQty("");
    setCond("New");
    setNotes("");
    setUrgent(false);
    setMonAmt("");
    setMonPurpose("General Fund");
  };

  const submit = async () => {
    if (!cat || saving) return;
    setSaving(true);

    if (isMonetary) {
      if (!monAmt || isNaN(monAmt)) { setSaving(false); return; }
      const entry = {
        id: genId("MON", monetary),
        amount: parseFloat(monAmt),
        type: monType,
        donor: donor || "Anonymous",
        date: new Date().toISOString().split("T")[0],
        purpose: monPurpose,
        notes,
      };
      const ok = await addMonetary(entry);
      if (ok) {
        setLastEntry({ ...entry, isMon: true });
        showToast(`Monetary donation $${monAmt} logged!`);
      }
    } else {
      if (!sub || !qty || isNaN(qty)) { setSaving(false); return; }
      const entry = {
        id: genId(cat, items),
        cat,
        catName: catObj.name,
        sub,
        qty: parseInt(qty),
        condition: cond,
        donor: donor || "Anonymous",
        status: "Received",
        date: new Date().toISOString().split("T")[0],
        notes,
        urgent,
        location: "",
      };
      const ok = await addItem(entry);
      if (ok) {
        setLastEntry(entry);
        showToast(`${catObj.name} — ${sub} (x${qty}) received!`);
      }
    }

    reset();
    setSaving(false);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#1e293b" }}>📦 Receive New Donation</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Category *</label>
            <select value={cat} onChange={(e) => { setCat(e.target.value); setSub(""); }} style={inputStyle}>
              <option value="">— Select Category —</option>
              {CATEGORIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>

          {cat && !isMonetary && (
            <>
              <div>
                <label style={labelStyle}>Subcategory *</label>
                <select value={sub} onChange={(e) => setSub(e.target.value)} style={inputStyle}>
                  <option value="">— Select —</option>
                  {catObj?.subs.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Quantity *</label>
                  <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 25" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Condition</label>
                  <select value={cond} onChange={(e) => setCond(e.target.value)} style={inputStyle}>
                    {CONDITIONS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {isMonetary && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Amount ($) *</label>
                  <input type="number" min="0" step="0.01" value={monAmt} onChange={(e) => setMonAmt(e.target.value)} placeholder="500.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select value={monType} onChange={(e) => setMonType(e.target.value)} style={inputStyle}>
                    {CATEGORIES.find((c) => c.code === "MON").subs.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Purpose</label>
                <input value={monPurpose} onChange={(e) => setMonPurpose(e.target.value)} placeholder="General Fund" style={inputStyle} />
              </div>
            </>
          )}

          {cat && (
            <>
              <div>
                <label style={labelStyle}>Donor Name (optional)</label>
                <input value={donor} onChange={(e) => setDonor(e.target.value)} placeholder="Leave blank for Anonymous" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special notes..." style={inputStyle} />
              </div>
              {!isMonetary && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: urgent ? "#dc2626" : "#64748b" }}>
                  <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
                  ⚡ Mark as Urgent / Perishable
                </label>
              )}
              <button
                onClick={submit}
                disabled={saving}
                style={{
                  padding: "12px",
                  background: saving ? "#94a3b8" : "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                  marginTop: 4,
                }}
              >
                {saving ? "Saving..." : isMonetary ? "💰 Log Monetary Donation" : "📦 Receive & Generate Barcode"}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#1e293b" }}>🏷️ Last Entry</h2>
        {lastEntry ? (
          <div style={{ textAlign: "center" }}>
            {!lastEntry.isMon && <BarcodeDisplay code={lastEntry.id} />}
            <div style={{ marginTop: 16, background: "#f8fafc", borderRadius: 8, padding: 16, textAlign: "left" }}>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 2 }}>
                <strong>ID:</strong> {lastEntry.id}<br />
                {lastEntry.isMon ? (
                  <>
                    <strong>Amount:</strong> ${lastEntry.amount}<br />
                    <strong>Type:</strong> {lastEntry.type}<br />
                    <strong>Purpose:</strong> {lastEntry.purpose}<br />
                  </>
                ) : (
                  <>
                    <strong>Category:</strong> {lastEntry.catName} → {lastEntry.sub}<br />
                    <strong>Quantity:</strong> {lastEntry.qty}<br />
                    <strong>Condition:</strong> {lastEntry.condition}<br />
                  </>
                )}
                <strong>Donor:</strong> {lastEntry.donor}<br />
                <strong>Date:</strong> {lastEntry.date}
              </div>
            </div>
            {!lastEntry.isMon && (
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 12 }}>
                🖨️ Print this label and attach to the donation box
              </p>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: 40, fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
            Submit an entry to see the barcode label here
          </div>
        )}
      </div>
    </div>
  );
}

function InventoryView({ items, updateItem, showToast }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filtered = items.filter((i) => {
    if (search) {
      const q = search.toLowerCase();
      if (!i.id.toLowerCase().includes(q) && !i.donor.toLowerCase().includes(q) && !i.catName.toLowerCase().includes(q))
        return false;
    }
    if (filterCat && i.cat !== filterCat) return false;
    if (filterStatus && i.status !== filterStatus) return false;
    return true;
  });

  const moveToStorage = async (id) => {
    const loc = `Shelf ${String.fromCharCode(65 + Math.floor(Math.random() * 5))}${Math.floor(Math.random() * 9) + 1}`;
    const ok = await updateItem(id, { status: "In Storage", location: loc });
    if (ok) showToast("Item moved to storage!");
  };

  const smallInput = { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, outline: "none" };

  return (
    <div style={cardStyle}>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "#1e293b" }}>🏷️ Full Inventory</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <input placeholder="🔍 Search by ID, donor, category..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...smallInput, flex: "1 1 200px" }} />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={smallInput}>
          <option value="">All Categories</option>
          {CATEGORIES.filter((c) => c.code !== "MON").map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={smallInput}>
          <option value="">All Statuses</option>
          <option>Received</option>
          <option>In Storage</option>
          <option>Distributed</option>
        </select>
      </div>

      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
        Showing {filtered.length} of {items.length} items
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              {["ID", "Category", "Sub", "Qty", "Condition", "Donor", "Status", "Location", "Action"].map((h) => (
                <th key={h} style={{ padding: "10px 8px", textAlign: "left", color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} style={{ borderBottom: "1px solid #f1f5f9", background: i.urgent && i.status !== "Distributed" ? "#fef2f2" : "transparent" }}>
                <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 11 }}>{i.id}</td>
                <td style={{ padding: "10px 8px" }}>{i.catName}</td>
                <td style={{ padding: "10px 8px" }}>{i.sub}</td>
                <td style={{ padding: "10px 8px", fontWeight: 700 }}>{i.qty}</td>
                <td style={{ padding: "10px 8px" }}>{i.condition}</td>
                <td style={{ padding: "10px 8px" }}>{i.donor}</td>
                <td style={{ padding: "10px 8px" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[i.status] + "20", color: STATUS_COLORS[i.status] }}>
                    {i.status}
                  </span>
                </td>
                <td style={{ padding: "10px 8px", fontSize: 12, color: "#64748b" }}>{i.location || "—"}</td>
                <td style={{ padding: "10px 8px" }}>
                  {i.status === "Received" && (
                    <button onClick={() => moveToStorage(i.id)} style={{ padding: "4px 10px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                      → Storage
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No items match your filters</div>
      )}
    </div>
  );
}

function DistributeView({ items, addItem, updateItem, showToast }) {
  const [scanId, setScanId] = useState("");
  const [distQty, setDistQty] = useState("");
  const [found, setFound] = useState(null);

  const lookup = () => {
    const item = items.find((i) => i.id.toLowerCase() === scanId.toLowerCase() && i.status === "In Storage");
    setFound(item || "not_found");
  };

  const distribute = async () => {
    if (!found || found === "not_found") return;
    const q = parseInt(distQty) || found.qty;

    if (q >= found.qty) {
      const ok = await updateItem(found.id, { status: "Distributed", location: "" });
      if (ok) showToast(`${found.catName} (x${found.qty}) marked as distributed!`);
    } else {
      const ok1 = await updateItem(found.id, { qty: found.qty - q });
      if (ok1) {
        const distEntry = {
          id: found.id + "-D" + Date.now(),
          cat: found.cat,
          catName: found.catName,
          sub: found.sub,
          qty: q,
          condition: found.condition,
          donor: found.donor,
          status: "Distributed",
          date: new Date().toISOString().split("T")[0],
          notes: `Partial distribution from ${found.id}`,
          urgent: false,
          location: "",
        };
        await addItem(distEntry);
        showToast(`${q} of ${found.qty} ${found.catName} distributed!`);
      }
    }

    setScanId("");
    setDistQty("");
    setFound(null);
  };

  const available = items.filter((i) => i.status === "In Storage");
  const smallInput = { padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#1e293b" }}>🚚 Distribute Items</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            placeholder="Enter or scan barcode ID..."
            value={scanId}
            onChange={(e) => setScanId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            style={{ ...smallInput, flex: 1 }}
          />
          <button onClick={lookup} style={{ padding: "10px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Look Up
          </button>
        </div>

        {found === "not_found" && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 16, color: "#dc2626", fontSize: 13 }}>
            ❌ Item not found in storage. Check the ID or it may already be distributed.
          </div>
        )}

        {found && found !== "not_found" && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#166534" }}>✅ Item Found</h3>
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.8 }}>
              <strong>{found.catName}</strong> → {found.sub}<br />
              Qty Available: <strong>{found.qty}</strong> | Condition: {found.condition}<br />
              Location: {found.location}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input type="number" min="1" max={found.qty} placeholder={`Qty (max ${found.qty})`} value={distQty} onChange={(e) => setDistQty(e.target.value)} style={{ ...smallInput, flex: 1 }} />
              <button onClick={distribute} style={{ padding: "10px 20px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                ✅ Distribute
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "#1e293b" }}>📋 Available for Distribution</h2>
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {available.map((i) => (
            <div
              key={i.id}
              onClick={() => { setScanId(i.id); setFound(i); }}
              style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}
            >
              <div>
                <strong>{i.catName}</strong> — {i.sub}
                <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{i.id}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>×{i.qty}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{i.location}</div>
              </div>
            </div>
          ))}
          {available.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No items in storage</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MonetaryView({ monetary }) {
  const total = monetary.reduce((s, m) => s + m.amount, 0);
  const byType = monetary.reduce((a, m) => { a[m.type] = (a[m.type] || 0) + m.amount; return a; }, {});
  const typeData = Object.entries(byType).map(([name, value]) => ({ name, value }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "#1e293b" }}>💰 Monetary Donations</h2>
        <div style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: 12, padding: 20, color: "#fff", marginBottom: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Total Monetary Donations</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>${total.toLocaleString()}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{monetary.length} transactions</div>
        </div>
        {monetary.map((m) => (
          <div key={m.id} style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <div>
              <strong>${m.amount}</strong> — {m.type}<br />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{m.donor} • {m.purpose}</span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{m.date}</div>
          </div>
        ))}
      </div>
      <div style={cardStyle}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#334155" }}>By Payment Type</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={typeData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: $${value}`} fontSize={12}>
              {typeData.map((_, i) => (
                <Cell key={i} fill={COLORS[i]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `$${v}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ReportsView({ items, monetary }) {
  const totalReceived = items.reduce((s, i) => s + i.qty, 0);
  const totalDistributed = items.filter((i) => i.status === "Distributed").reduce((s, i) => s + i.qty, 0);
  const totalInStock = items.filter((i) => i.status === "In Storage").reduce((s, i) => s + i.qty, 0);
  const totalMoney = monetary.reduce((s, m) => s + m.amount, 0);
  const unusable = items.filter((i) => i.condition === "Unusable").reduce((s, i) => s + i.qty, 0);
  const uniqueDonors = new Set([...items.map((i) => i.donor), ...monetary.map((m) => m.donor)]).size;

  const catBreakdown = CATEGORIES.filter((c) => c.code !== "MON")
    .map((c) => {
      const catItems = items.filter((i) => i.cat === c.code);
      return {
        name: c.name,
        received: catItems.reduce((s, i) => s + i.qty, 0),
        distributed: catItems.filter((i) => i.status === "Distributed").reduce((s, i) => s + i.qty, 0),
      };
    })
    .filter((d) => d.received > 0);

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>📋 Year-End Report</h2>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>Generated: {new Date().toLocaleDateString()}</span>
      </div>

      <div style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", borderRadius: 12, padding: 24, color: "#fff", marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Executive Summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16 }}>
          {[
            { l: "Items Received", v: totalReceived },
            { l: "Items Distributed", v: totalDistributed },
            { l: "Currently In Stock", v: totalInStock },
            { l: "Monetary Received", v: `$${totalMoney.toLocaleString()}` },
            { l: "Unique Donors", v: uniqueDonors },
            { l: "Distribution Rate", v: totalReceived ? `${Math.round((totalDistributed / totalReceived) * 100)}%` : "0%" },
          ].map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,.15)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{s.v}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <h3 style={{ fontSize: 15, color: "#334155", margin: "0 0 12px" }}>Category Breakdown: Received vs Distributed</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={catBreakdown}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Legend />
          <Bar dataKey="received" fill="#6366f1" name="Received" radius={[4, 4, 0, 0]} />
          <Bar dataKey="distributed" fill="#10b981" name="Distributed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {unusable > 0 && (
        <div style={{ background: "#fef2f2", borderRadius: 8, padding: 12, marginTop: 16, fontSize: 13, color: "#991b1b" }}>
          ⚠️ <strong>{unusable}</strong> items were received in unusable condition and could not be distributed.
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, background: "#f8fafc", borderRadius: 8, fontSize: 12, color: "#64748b", textAlign: "center" }}>
        This report is auto-generated from the NGO Inventory Management System. All data is pulled from live inventory records.
      </div>
    </div>
  );
}