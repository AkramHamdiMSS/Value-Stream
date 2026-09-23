import { Fragment, useEffect, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { Input } from "./ui/input";
import { SelectNative } from "./ui/select";
import { Button } from "./ui/button";
import { Table, THead, TBody, TH, TD } from "./ui/table";
import { cn } from "../lib/utils";
import { PROFILE_FIELDS } from "../lib/profiles";

const SQUADS = PROFILE_FIELDS.map((p) => ({ key: p.countKey, pctKey: p.pctKey, label: p.profile }));

// One demand line = one Début/Fin spanning four profile rows (Mobile/TPE
// Android/TPE Engage/Digital), each with its own headcount AND its own
// allocation % — Début and Fin are shown once per line (rowSpan) since the
// range applies to all four, but the % doesn't have to match across them.
//
// Keystrokes only update local state — nothing reaches the server until the
// line's own "Valider" button is clicked, which sends every changed field
// on that line in one request, instead of auto-saving on blur.
export default function DemandTable({ lines, periods, editable, onAdd, onSave, onRemove }) {
  const [local, setLocal] = useState(lines);
  useEffect(() => setLocal(lines), [lines]);

  const setLocalValue = (id, key, value) => {
    setLocal((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  };
  const periodLabel = (id) => periods.find((p) => p.id === id)?.label || id || "—";

  const FIELD_KEYS = ["periodStart", "periodEnd", ...SQUADS.map((sq) => sq.key), ...SQUADS.map((sq) => sq.pctKey), "comment"];
  const normalize = (key, v) => {
    if (SQUADS.some((sq) => sq.key === key)) return v === "" || v === undefined || v === null ? 0 : Number(v);
    if (SQUADS.some((sq) => sq.pctKey === key)) return v === "" || v === undefined || v === null ? null : Number(v);
    return v === undefined || v === "" ? null : v;
  };
  const isDirty = (line) => {
    const orig = lines.find((l) => l.id === line.id);
    if (!orig) return false;
    return FIELD_KEYS.some((k) => normalize(k, line[k]) !== normalize(k, orig[k]));
  };
  const saveLine = (line) => {
    const orig = lines.find((l) => l.id === line.id);
    const patch = {};
    for (const k of FIELD_KEYS) {
      const a = normalize(k, line[k]);
      if (a !== normalize(k, orig?.[k])) patch[k] = a;
    }
    if (Object.keys(patch).length > 0) onSave(line.id, patch);
  };

  const colCount = 6 + (editable ? 1 : 0);

  return (
    <div>
      <Table className="mb-2.5">
        <THead>
          <tr>
            <TH>Début</TH><TH>Fin</TH><TH>Profil</TH><TH>Nombre de personnes</TH><TH>Allocation % (vide = 100%)</TH><TH>Commentaire</TH>
            {editable && <TH></TH>}
          </tr>
        </THead>
        <TBody>
          {local.map((line) => {
            const dirty = editable && isDirty(line);
            return (
              <Fragment key={line.id}>
                {SQUADS.map((sq, i) => (
                  <tr key={sq.key} className={cn(i === 0 && "border-t", dirty && i === 0 && "bg-primary/5")}>
                    {i === 0 && (
                      <>
                        <TD rowSpan={SQUADS.length} className="align-top py-3">
                          {editable ? (
                            <SelectNative value={line.periodStart ?? ""} onChange={(e) => setLocalValue(line.id, "periodStart", e.target.value)} className="h-8 w-32">
                              {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </SelectNative>
                          ) : <span>{periodLabel(line.periodStart)}</span>}
                        </TD>
                        <TD rowSpan={SQUADS.length} className="align-top py-3">
                          {editable ? (
                            <SelectNative value={line.periodEnd ?? ""} onChange={(e) => setLocalValue(line.id, "periodEnd", e.target.value)} className="h-8 w-32">
                              {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </SelectNative>
                          ) : <span>{periodLabel(line.periodEnd)}</span>}
                        </TD>
                      </>
                    )}
                    <TD><span>{sq.label}</span></TD>
                    <TD>
                      {editable ? (
                        <Input type="number" min="0" value={line[sq.key] ?? 0}
                          onChange={(e) => setLocalValue(line.id, sq.key, e.target.value === "" ? "" : Number(e.target.value))}
                          className="h-8 w-20" />
                      ) : <span className="text-muted-foreground">{line[sq.key] ?? 0}</span>}
                    </TD>
                    <TD>
                      {editable ? (
                        <Input type="number" min="0" max="200" placeholder="100"
                          value={line[sq.pctKey] === "" || line[sq.pctKey] === undefined || line[sq.pctKey] === null ? "" : Math.round(Number(line[sq.pctKey]) * 100)}
                          onChange={(e) => setLocalValue(line.id, sq.pctKey, e.target.value === "" ? "" : Number(e.target.value) / 100)}
                          className="h-8 w-24" />
                      ) : <span className="text-muted-foreground">{line[sq.pctKey] === null || line[sq.pctKey] === undefined ? "100%" : `${Math.round(Number(line[sq.pctKey]) * 100)}%`}</span>}
                    </TD>
                    {i === 0 && (
                      <TD rowSpan={SQUADS.length} className="align-top py-3">
                        {editable ? (
                          <Input value={line.comment ?? ""} placeholder="Contexte, urgence…"
                            onChange={(e) => setLocalValue(line.id, "comment", e.target.value)} className="h-8 w-52" />
                        ) : (
                          <span className={cn(line.comment ? "" : "text-muted-foreground italic")}>
                            {line.comment || "Aucun commentaire."}
                          </span>
                        )}
                      </TD>
                    )}
                    {i === 0 && editable && (
                      <TD rowSpan={SQUADS.length} className="align-top py-3">
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => saveLine(line)} disabled={!dirty}
                            className={cn(dirty && "text-primary border-primary/50")}>
                            <Check size={12} /> Valider
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onRemove(line.id)} aria-label="Supprimer la ligne"
                            className="text-muted-foreground hover:text-destructive h-8 w-8">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TD>
                    )}
                  </tr>
                ))}
              </Fragment>
            );
          })}
          {local.length === 0 && (
            <tr><td colSpan={colCount} className="px-4 py-4 text-center text-muted-foreground text-[12.5px]">Aucune ligne pour l'instant.</td></tr>
          )}
        </TBody>
      </Table>
      {editable && (
        <Button variant="outline" size="sm" onClick={() => onAdd()} className="mb-2.5">
          <Plus size={14} /> Ajouter une ligne
        </Button>
      )}
    </div>
  );
}
