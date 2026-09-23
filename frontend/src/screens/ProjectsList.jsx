import { Plus, Search, Trash2 } from "lucide-react";
import { round1 } from "../lib/util";
import { Button } from "../components/ui/button";
import { Badge2 } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/table";

export default function ProjectsList({ projects, search, setSearch, canViewAll, canManage, user, onSelect, onCreate, onDelete }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4 gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{canViewAll ? "Tous les projets" : "Mes projets"}</h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            {canViewAll ? "Vue d'ensemble — tous les SVO." : `Projets dont vous êtes le SVO (${user.name}).`}
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={onCreate}><Plus size={14} /> Nouveau projet</Button>
        )}
      </div>

      <div className="relative mb-4 max-w-xs">
        <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un projet ou un SVO" className="pl-8" />
      </div>

      <Table>
        <THead>
          <tr>
            <TH>Projet</TH><TH>SVO</TH><TH>Statut</TH><TH>Besoin</TH><TH>Alloué</TH><TH>Demande</TH>{canManage && <TH></TH>}
          </tr>
        </THead>
        <TBody>
          {projects.map((p) => (
            <TR key={p.id} className="cursor-pointer" onClick={() => onSelect(p.id)}>
              <TD className="font-semibold">{p.name}</TD>
              <TD>{p.svo?.name || <span className="text-muted-foreground">—</span>}</TD>
              <TD className="text-muted-foreground">{p.status}</TD>
              <TD>{round1(p.totals.demand.total)}</TD>
              <TD>{round1(p.totals.alloc.total)}</TD>
              <TD>
                {p.demandSubmitted
                  ? <Badge2 variant="success">Soumise</Badge2>
                  : <Badge2 variant="secondary">Brouillon</Badge2>}
              </TD>
              {canManage && (
                <TD>
                  <Button variant="ghost" size="icon" aria-label="Supprimer" className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}>
                    <Trash2 size={14} />
                  </Button>
                </TD>
              )}
            </TR>
          ))}
          {projects.length === 0 && (
            <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
              {canViewAll ? "Aucun projet." : "Aucun projet ne vous est encore assigné par le Head of Value Stream."}
            </td></tr>
          )}
        </TBody>
      </Table>
    </div>
  );
}
