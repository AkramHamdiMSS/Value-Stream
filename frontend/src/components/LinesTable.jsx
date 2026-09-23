import { useEffect, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { cn } from "../lib/utils";
import { Input } from "./ui/input";
import { SelectNative } from "./ui/select";
import { Button } from "./ui/button";

// Locally-buffered editable card list: keystrokes only update local state —
// nothing reaches the server until the card's own "Enregistrer" button is
// clicked, which sends every changed field on that line in one request. No
// more silent auto-save on blur, which made it too easy to commit a change
// by accident just by clicking away. `render`-based columns (status,
// release) are exempt — they already have their own explicit action button
// (Valider/Libérer/Confirmer), so nothing here duplicates that.
//
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
export default function LinesTable({ lines, columns, addLabel, editable = true, rowEditable, onAdd, onSave, onRemove }) {
  const [local, setLocal] = useState(lines);
  useEffect(() => setLocal(lines), [lines]);

  const isLineEditable = (line) => (rowEditable ? rowEditable(line) : editable);

  const setLocalValue = (id, key, value) => {
    setLocal((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  };

  // `options`/`optionLabels` can be a static array or a `(line) => array`
  // function — e.g. a backup picker whose candidates depend on the row's
  // own (possibly just-edited) primary resource, not the same fixed list
  // for every row.
  const resolveOptions = (col, line) => (typeof col.options === "function" ? col.options(line) : col.options);
  const resolveOptionLabels = (col, line) => (typeof col.optionLabels === "function" ? col.optionLabels(line) : col.optionLabels);

  const displayLabel = (col, line) => {
    if (col.type !== "select") return line[col.key] === "" || line[col.key] === undefined || line[col.key] === null ? "—" : line[col.key];
    const options = resolveOptions(col, line);
    const optionLabels = resolveOptionLabels(col, line);
    const idx = options.indexOf(line[col.key]);
    if (idx === -1) {
      // `options` may be a restricted pick-list (e.g. a Team Lead's own
      // team) — fall back to an unrestricted lookup so a read-only row for
      // someone outside that list still shows its real label, not "—".
      return col.fallbackLabel ? (col.fallbackLabel(line[col.key]) ?? "—") : "—";
    }
    return optionLabels ? optionLabels[idx] : options[idx];
  };

  // Plain (non-render) columns are the ones this card's single Enregistrer
  // button covers — a render() column already manages its own commit.
  const plainColumns = columns.filter((c) => !c.render);
  const normalize = (c, v) => {
    if (c.type === "percent") return v === "" || v === undefined || v === null ? null : Number(v);
    if (v === undefined || v === "") return null;
    return v;
  };
  const isDirty = (line) => {
    const orig = lines.find((l) => l.id === line.id);
    if (!orig) return false;
    return plainColumns.some((c) => normalize(c, line[c.key]) !== normalize(c, orig[c.key]));
  };
  const buildPatch = (line) => {
    const orig = lines.find((l) => l.id === line.id);
    const patch = {};
    for (const c of plainColumns) {
      const a = normalize(c, line[c.key]);
      const b = normalize(c, orig?.[c.key]);
      if (a !== b) patch[c.key] = a;
    }
    return patch;
  };
  const saveLine = (line) => {
    const patch = buildPatch(line);
    if (Object.keys(patch).length > 0) onSave(line.id, patch);
  };

  const renderControl = (c, line, cellEditable) => (
    !cellEditable ? (
      <div>
        <span className={cn("text-[13.5px]", c.type === "select" ? "text-foreground" : "text-muted-foreground")}>
          {c.type === "percent"
            ? (line[c.key] === "" || line[c.key] === undefined || line[c.key] === null ? "100%" : `${Math.round(Number(line[c.key]) * 100)}%`)
            : displayLabel(c, line)}
        </span>
        {c.type === "select" && c.hint && c.hint(line)}
      </div>
    ) : c.type === "select" ? (
      <div>
        <SelectNative value={line[c.key] ?? ""} onChange={(e) => setLocalValue(line.id, c.key, e.target.value)} className="h-8 w-full">
          <option value="">—</option>
          {resolveOptions(c, line).map((opt, i) => {
            const optionLabels = resolveOptionLabels(c, line);
            return <option key={opt} value={opt}>{optionLabels ? optionLabels[i] : opt}</option>;
          })}
        </SelectNative>
        {c.hint && c.hint(line)}
      </div>
    ) : c.type === "percent" ? (
      <Input type="number" min="0" max="200" placeholder="100"
        value={line[c.key] === "" || line[c.key] === undefined || line[c.key] === null ? "" : Math.round(Number(line[c.key]) * 100)}
        onChange={(e) => setLocalValue(line.id, c.key, e.target.value === "" ? "" : Number(e.target.value) / 100)}
        className="h-8 w-full" />
    ) : (
      <Input type={c.type === "number" ? "number" : "text"} value={line[c.key] ?? ""}
        onChange={(e) => setLocalValue(line.id, c.key, c.type === "number" ? Number(e.target.value) : e.target.value)}
        className="h-8 w-full" />
    )
  );

  // A column can override row-level editability with its own — see the
  // file-level note on `group`/`editable` above.
  const renderField = (c, line, lineEditable) => {
    const cellEditable = c.editable === undefined ? lineEditable : (typeof c.editable === "function" ? c.editable(line) : c.editable);
    return (
      <div key={c.key} style={{ width: c.width || 160, flex: c.grow ? "1 1 220px" : "0 0 auto", minWidth: c.width || 120 }}>
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{c.label}</div>
        {c.render ? c.render(line) : renderControl(c, line, cellEditable)}
      </div>
    );
  };

  const renderCard = (line) => {
    const lineEditable = isLineEditable(line);
    const dirty = lineEditable && isDirty(line);
    const primary = columns.filter((c) => (c.group || "primary") === "primary");
    const secondary = columns.filter((c) => c.group === "secondary");
    const full = columns.filter((c) => c.group === "full");
    return (
      <div key={line.id} className={cn("bg-muted/40 border rounded-xl p-3.5 mb-2.5", dirty ? "border-primary/50" : "border-border")}>
        <div className="flex gap-3.5 flex-wrap items-start">
          {primary.map((c) => renderField(c, line, lineEditable))}
          {editable && lineEditable && (
            <div className="flex gap-1.5 self-end ml-auto">
              <Button variant="secondary" size="sm" onClick={() => saveLine(line)} disabled={!dirty}
                className={cn(dirty && "text-primary")}>
                <Check size={13} /> Valider
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onRemove(line.id)} title="Supprimer la ligne" aria-label="Supprimer la ligne"
                className="text-muted-foreground hover:text-destructive h-8 w-8">
                <Trash2 size={15} />
              </Button>
            </div>
          )}
        </div>
        {secondary.length > 0 && (
          <div className="flex gap-3.5 flex-wrap mt-3 pt-3 border-t border-border">
            {secondary.map((c) => renderField({ ...c, grow: true }, line, lineEditable))}
          </div>
        )}
        {full.map((c) => {
          const content = c.render ? c.render(line) : renderControl(c, line, c.editable === undefined ? lineEditable : (typeof c.editable === "function" ? c.editable(line) : c.editable));
          // A render() that decides there's nothing to show (e.g. no
          // release in progress) shouldn't leave a bare divider behind.
          if (content === null || content === undefined) return null;
          return (
            <div key={c.key} className="mt-3 pt-3 border-t border-border">
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
        <div className="bg-card border border-border rounded-xl p-5 text-center text-muted-foreground text-[12.5px]">
          Aucune ligne pour l'instant.
        </div>
      )}
      {editable && (
        <Button variant="outline" size="sm" onClick={() => onAdd()}>
          <Plus /> {addLabel}
        </Button>
      )}
    </div>
  );
}
