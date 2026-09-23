import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../api";
import { Card, CardContent } from "../components/ui/card";
import { SelectNative } from "../components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/table";

function formatWhen(iso) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ActivityLog({ svoUsers, onOpenProject }) {
  const [logs, setLogs] = useState(null);
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLogs(null);
    api.get(`/activity${userId ? `?userId=${userId}` : ""}`).then(setLogs).catch((e) => setError(e.message));
  }, [userId]);

  return (
    <div>
      <div className="flex justify-between items-end gap-3 mb-1 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Activité</h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            Historique des actions des SVO et du Head of Value Stream — créations, demandes, affectations.
          </p>
        </div>
        <SelectNative value={userId} onChange={(e) => setUserId(e.target.value)} className="min-w-52">
          <option value="">Tous les comptes</option>
          {svoUsers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectNative>
      </div>

      {error && <div className="text-destructive text-[12.5px] my-3">{error}</div>}

      {!logs ? (
        <div className="flex items-center gap-2 text-muted-foreground p-10">
          <Loader2 className="animate-spin" size={18} /> Chargement…
        </div>
      ) : (
        <Card className="mt-4">
          <CardContent className="p-0">
            <Table>
              <THead>
                <tr><TH>Quand</TH><TH>Qui</TH><TH>Action</TH><TH>Projet</TH></tr>
              </THead>
              <TBody>
                {logs.map((log) => (
                  <TR key={log.id}>
                    <TD className="text-muted-foreground whitespace-nowrap">{formatWhen(log.createdAt)}</TD>
                    <TD className="font-semibold">{log.userName}</TD>
                    <TD>{log.action}</TD>
                    <TD>
                      {log.projectId ? (
                        <button onClick={() => onOpenProject(log.projectId)} className="text-primary cursor-pointer text-[13px] hover:underline">
                          {log.projectName}
                        </button>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TD>
                  </TR>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Aucune activité.</td></tr>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
