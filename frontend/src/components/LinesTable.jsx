import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TEXT, MUTED, SURFACE, SURFACE2, BORDER, inputStyle, btnGhost } from "../styles";

// Locally-buffered editable card list: keystrokes update local state instantly, and
// commit to the server on blur (text/number/percent) or immediately on select change.
// `editable` gates whether adding new lines is offered at all; `rowEditable(line)`
// (optional, defaults to `editable`) governs whether a SPECIFIC existing row can be
// edited/deleted — e.g. a Team Lead who can only touch their own pending proposals,
// not lines someone else already approved.
//
// Each line renders as a card instead of a dense table row — with this many fields
// (period, resource, %, status, two comments, release), a single wide <tr> squeezed
// every input down to unreadable/untypeable widths. A column's `group` ("primary",
// the default, or "secondary") decides which of the card's two field rows it lands
// in; `full` puts it on its own full-width row below both (release's multi-control
// block needs the room). A column can also override row-level editability with its
// own `editable` (bool or `(line) => bool`) — e.g. a validation comment that only
// whoever approves should ever write, regardless of who else can touch the row.
export default function LinesTable({ lines, columns, addLabel, editable = true, rowEditable, onAdd, onPatch, onRemove }) {
  const [local, setLocal] = useState(lines);
  useEffect(() => setLocal(lines), [lines]);

  const isLineEditable = (line) => (rowEditable ? rowEditable(line) : editable);

  const setLocalValue = (id, key, value) => {
    setLocal((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  };

  const displayLabel = (col, line) => {
    if (col.type !== "select") return line[col.key] === "" || line[col.key] === undefined || line[col.key] === null ? "—" : line[col.key];
    const idx = col.options.indexOf(line[col.key]);
    if (idx === -1) {
      // `options` may be a restricted pick-list (e.g. a Team Lead's own
      // team) — fall back to an unrestricted lookup so a read-only row for
      // someone outside that list still shows its real label, not "—".
      return col.fallbackLabel ? (col.fallbackLabel(line[col.key]) ?? "—") : "—";
    }
    return col.optionLabels ? col.optionLabels[idx] : col.options[idx];
  };

  const renderControl = (c, line, cellEditable) => (
    !cellEditable ? (
      <div>
        <span style={{ fontSize: 13.5, color: c.type === "select" ? TEXT : MUTED }}>
          {c.type === "percent"
            ? (line[c.key] === "" || line[c.key] === undefined || line[c.key] === null ? "100%" : `${Math.round(Number(line[c.key]) * 100)}%`)
            : displayLabel(c, line)}
        </span>
        {c.type === "select" && c.hint && c.hint(line)}
      </div>
    ) : c.type === "select" ? (
      <div>
        <select value={line[c.key] ?? ""} onChange={(e) => {
          setLocalValue(line.id, c.key, e.target.value);
          onPatch(line.id, c.key, e.target.value);
        }} style={{ ...inputStyle, width: "100%" }}>
          <option value="">—</option>
          {c.options.map((opt, i) => (
            <option key={opt} value={opt}>{c.optionLabels ? c.optionLabels[i] : opt}</option>
          ))}
        </select>
        {c.hint && c.hint(line)}
      </div>
    ) : c.type === "percent" ? (
      <input type="number" min="0" max="200" placeholder="100"
        value={line[c.key] === "" || line[c.key] === undefined || line[c.key] === null ? "" : Math.round(Number(line[c.key]) * 100)}
        onChange={(e) => setLocalValue(line.id, c.key, e.target.value === "" ? "" : Number(e.target.value) / 100)}
        onBlur={(e) => onPatch(line.id, c.key, e.target.value === "" ? null : Number(e.target.value) / 100)}
        style={{ ...inputStyle, width: "100%" }} />
    ) : (
      <input type={c.type === "number" ? "number" : "text"} value={line[c.key] ?? ""}
        onChange={(e) => setLocalValue(line.id, c.key, c.type === "number" ? Number(e.target.value) : e.target.value)}
        onBlur={(e) => onPatch(line.id, c.key, c.type === "number" ? Number(e.target.value) : e.target.value)}
        style={{ ...inputStyle, width: "100%" }} />
    )
  );

  // A column can override row-level editability with its own — see the
  // file-level note on `group`/`editable` above.
  const renderField = (c, line, lineEditable) => {
    const cellEditable = c.editable === undefined ? lineEditable : (typeof c.editable === "function" ? c.editable(line) : c.editable);
    return (
      <div key={c.key} style={{ width: c.width || 160, flex: c.grow ? "1 1 220px" : "0 0 auto", minWidth: c.width || 120 }}>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{c.label}</div>
        {c.render ? c.render(line) : renderControl(c, line, cellEditable)}
      </div>
    );
  };

  const renderCard = (line) => {
    const lineEditable = isLineEditable(line);
    const primary = columns.filter((c) => (c.group || "primary") === "primary");
    const secondary = columns.filter((c) => c.group === "secondary");
    const full = columns.filter((c) => c.group === "full");
    return (
      <div key={line.id} style={{
        background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10,
      }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
          {primary.map((c) => renderField(c, line, lineEditable))}
          {editable && lineEditable && (
            <button onClick={() => onRemove(line.id)} title="Supprimer la ligne" aria-label="Supprimer la ligne" style={{
              background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4,
              display: "flex", alignSelf: "flex-end", marginLeft: "auto",
            }}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
        {secondary.length > 0 && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
            {secondary.map((c) => renderField({ ...c, grow: true }, line, lineEditable))}
          </div>
        )}
        {full.map((c) => {
          const content = c.render ? c.render(line) : renderControl(c, line, c.editable === undefined ? lineEditable : (typeof c.editable === "function" ? c.editable(line) : c.editable));
          // A render() that decides there's nothing to show (e.g. no
          // release in progress) shouldn't leave a bare divider behind.
          if (content === null || content === undefined) return null;
          return (
            <div key={c.key} style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
              {content}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ marginBottom: 10 }}>
      {local.map(renderCard)}
      {local.length === 0 && (
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20,
          textAlign: "center", color: MUTED, fontSize: 12.5,
        }}>
          Aucune ligne pour l'instant.
        </div>
      )}
      {editable && (
        <button onClick={() => onAdd()} style={{ ...btnGhost, fontSize: 12.5 }}>
          <Plus size={14} /> {addLabel}
        </button>
      )}
    </div>
  );
}
