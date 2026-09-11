import { Fragment, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SURFACE, SURFACE2, BORDER, TEXT, MUTED, ACCENT, CARD_SHADOW, inputStyle, btnGhost, btnPrimary } from "../styles";
import { Th, Td } from "./ui";

// Locally-buffered editable table: keystrokes update local state instantly, and
// commit to the server on blur (text/number/percent) or immediately on select change.
// When `groupBy` names a column key (e.g. "period"), rows are grouped under a single
// header per distinct value instead of repeating that column on every row — only
// periods that actually have lines show up, plus whichever one the user just picked
// via "Ajouter une période". `maxPerGroup` hides a group's "+ ligne" once it's full
// (e.g. the 3 fixed profiles for a demand period).
export default function LinesTable({ lines, columns, addLabel, editable = true, onAdd, onPatch, onRemove, groupBy, maxPerGroup }) {
  const [local, setLocal] = useState(lines);
  useEffect(() => setLocal(lines), [lines]);
  const [pickingPeriod, setPickingPeriod] = useState(false);
  const [periodChoice, setPeriodChoice] = useState("");

  const setLocalValue = (id, key, value) => {
    setLocal((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  };

  const displayLabel = (col, line) => {
    if (col.type !== "select") return line[col.key] === "" || line[col.key] === undefined || line[col.key] === null ? "—" : line[col.key];
    const idx = col.options.indexOf(line[col.key]);
    if (idx === -1) return "—";
    return col.optionLabels ? col.optionLabels[idx] : col.options[idx];
  };

  const groupCol = groupBy ? columns.find((c) => c.key === groupBy) : null;
  const visibleColumns = groupCol ? columns.filter((c) => c.key !== groupBy) : columns;
  const colCount = visibleColumns.length + (editable ? 1 : 0);

  const groupLabel = (value) => {
    if (!groupCol) return value;
    const idx = groupCol.options.indexOf(value);
    if (idx === -1) return value || "—";
    return groupCol.optionLabels ? groupCol.optionLabels[idx] : groupCol.options[idx];
  };

  let groups = null;
  let availablePeriods = [];
  if (groupCol) {
    const byValue = new Map();
    for (const line of local) {
      const key = line[groupBy] ?? "";
      if (!byValue.has(key)) byValue.set(key, []);
      byValue.get(key).push(line);
    }
    const orderedKeys = groupCol.options.filter((v) => byValue.has(v));
    for (const k of byValue.keys()) if (!orderedKeys.includes(k)) orderedKeys.push(k);
    groups = orderedKeys.map((key) => ({ key, label: groupLabel(key), lines: byValue.get(key) || [] }));
    availablePeriods = groupCol.options
      .map((opt, i) => ({ value: opt, label: groupCol.optionLabels ? groupCol.optionLabels[i] : opt }))
      .filter((p) => !byValue.has(p.value));
  }

  const confirmAddPeriod = () => {
    if (!periodChoice) return;
    onAdd(periodChoice);
    setPickingPeriod(false);
    setPeriodChoice("");
  };

  const renderCell = (c, line) => (
    c.render ? (
      c.render(line)
    ) : !editable ? (
      <div>
        <span style={{ color: c.type === "select" ? TEXT : MUTED }}>
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
        }} style={{ ...inputStyle, width: c.width }}>
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
        style={{ ...inputStyle, width: c.width }} />
    ) : (
      <input type={c.type === "number" ? "number" : "text"} value={line[c.key] ?? ""}
        onChange={(e) => setLocalValue(line.id, c.key, c.type === "number" ? Number(e.target.value) : e.target.value)}
        onBlur={(e) => onPatch(line.id, c.key, c.type === "number" ? Number(e.target.value) : e.target.value)}
        style={{ ...inputStyle, width: c.width }} />
    )
  );

  const renderRow = (line) => (
    <tr key={line.id} style={{ borderTop: `1px solid ${BORDER}` }}>
      {visibleColumns.map((c) => <Td key={c.key}>{renderCell(c, line)}</Td>)}
      {editable && (
        <Td>
          <button onClick={() => onRemove(line.id)} style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4, display: "flex" }} aria-label="Supprimer la ligne">
            <Trash2 size={14} />
          </button>
        </Td>
      )}
    </tr>
  );

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: SURFACE2 }}>
            {groupCol && <Th>{groupCol.label}</Th>}
            {visibleColumns.map((c) => <Th key={c.key}>{c.label}</Th>)}
            {editable && <Th></Th>}
          </tr>
        </thead>
        <tbody>
          {groupCol ? (
            <>
              {groups.map((g) => {
                const full = maxPerGroup != null && g.lines.length >= maxPerGroup;
                return (
                  <Fragment key={g.key || "(sans période)"}>
                    <tr style={{ background: SURFACE2, borderTop: `1px solid ${BORDER}` }}>
                      <td colSpan={colCount + 1} style={{ padding: "6px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: TEXT }}>{g.label}</span>
                          {editable && !full && (
                            <button onClick={() => onAdd(g.key)} style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: 0, display: "flex", alignItems: "center", gap: 3 }}>
                              <Plus size={12} /> ligne
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {g.lines.map((line) => (
                      <tr key={line.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                        <Td></Td>
                        {visibleColumns.map((c) => <Td key={c.key}>{renderCell(c, line)}</Td>)}
                        {editable && (
                          <Td>
                            <button onClick={() => onRemove(line.id)} style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4, display: "flex" }} aria-label="Supprimer la ligne">
                              <Trash2 size={14} />
                            </button>
                          </Td>
                        )}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              {groups.length === 0 && (
                <tr><td colSpan={colCount + 1} style={{ padding: 16, textAlign: "center", color: MUTED, fontSize: 12.5 }}>Aucune ligne pour l'instant.</td></tr>
              )}
            </>
          ) : (
            <>
              {local.map(renderRow)}
              {local.length === 0 && (
                <tr><td colSpan={colCount} style={{ padding: 16, textAlign: "center", color: MUTED, fontSize: 12.5 }}>Aucune ligne pour l'instant.</td></tr>
              )}
            </>
          )}
        </tbody>
      </table>
      {editable && groupCol && (
        pickingPeriod ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: 10 }}>
            <select value={periodChoice} onChange={(e) => setPeriodChoice(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
              <option value="">Choisir une période…</option>
              {availablePeriods.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <button onClick={confirmAddPeriod} disabled={!periodChoice} style={{ ...btnPrimary, fontSize: 12.5, opacity: periodChoice ? 1 : 0.5, cursor: periodChoice ? "pointer" : "not-allowed" }}>Ajouter</button>
            <button onClick={() => { setPickingPeriod(false); setPeriodChoice(""); }} style={{ ...btnGhost, fontSize: 12.5 }}>Annuler</button>
          </div>
        ) : (
          <button onClick={() => setPickingPeriod(true)} disabled={availablePeriods.length === 0} style={{ ...btnGhost, margin: 10, fontSize: 12.5, opacity: availablePeriods.length === 0 ? 0.5 : 1 }}>
            <Plus size={14} /> {addLabel}
          </button>
        )
      )}
      {editable && !groupCol && (
        <button onClick={() => onAdd()} style={{ ...btnGhost, margin: 10, fontSize: 12.5 }}>
          <Plus size={14} /> {addLabel}
        </button>
      )}
    </div>
  );
}
