import { Plus, Search, Trash2 } from "lucide-react";
import { round1 } from "../lib/util";
import { SURFACE, SURFACE2, BORDER, MUTED, GREEN, CARD_SHADOW, inputStyle, btnPrimary, iconBtn } from "../styles";
import { Th, Td, Badge } from "../components/ui";

export default function ProjectsList({ projects, search, setSearch, canViewAll, canManage, user, onSelect, onCreate, onDelete }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{canViewAll ? "Tous les projets" : "Mes projets"}</h1>
          <p style={{ color: MUTED, fontSize: 13, margin: "4px 0 0" }}>
            {canViewAll ? "Vue d'ensemble — tous les SVO." : `Projets dont vous êtes le SVO (${user.name}).`}
          </p>
        </div>
        {canManage && (
          <button onClick={onCreate} style={btnPrimary}>
            <Plus size={15} /> Nouveau projet
          </button>
        )}
      </div>

      <div style={{ position: "relative", marginBottom: 16, maxWidth: 320 }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: MUTED }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un projet ou un SVO"
          style={{ ...inputStyle, paddingLeft: 32, width: "100%" }} />
      </div>

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", boxShadow: CARD_SHADOW }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: SURFACE2 }}>
              <Th>Projet</Th><Th>SVO</Th><Th>Statut</Th><Th>Besoin</Th><Th>Alloué</Th><Th>Demande</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${BORDER}`, cursor: "pointer" }} onClick={() => onSelect(p.id)}>
                <Td><span style={{ fontWeight: 600 }}>{p.name}</span></Td>
                <Td>{p.svo?.name || <span style={{ color: MUTED }}>—</span>}</Td>
                <Td><span style={{ color: MUTED }}>{p.status}</span></Td>
                <Td>{round1(p.totals.demand.total)}</Td>
                <Td>{round1(p.totals.alloc.total)}</Td>
                <Td>
                  {p.demandSubmitted
                    ? <Badge color={GREEN} text="Soumise" />
                    : <Badge color={MUTED} text="Brouillon" />}
                </Td>
                {canManage && (
                  <Td>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} style={iconBtn} aria-label="Supprimer">
                      <Trash2 size={14} />
                    </button>
                  </Td>
                )}
              </tr>
            ))}
            {projects.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: MUTED }}>
                {canViewAll ? "Aucun projet." : "Aucun projet ne vous est encore assigné par le Head of Value Stream."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
