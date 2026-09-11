// Fixed set of extra capabilities the HSV (super admin) can grant to an
// individual SVO user, on top of their base access (own projects' demand).
// The hsv role always has every capability implicitly — permissions only
// ever extend an svo account, never restrict an hsv one.
const PERMISSIONS = [
  { key: "viewDashboard", label: "Voir le Dashboard" },
  { key: "viewAllProjects", label: "Voir tous les projets (pas seulement les siens)" },
  { key: "manageProjects", label: "Créer / supprimer des projets, réaffecter le SVO" },
  { key: "manageAllocations", label: "Éditer l'affectation des ressources sur tous les projets" },
  { key: "proposeAllocations", label: "Proposer des affectations de ressources (à valider par le Head of Value Stream)" },
  { key: "viewDemandQueue", label: "Voir l'onglet Demandes à affecter" },
  { key: "managePool", label: "Voir et gérer le Pool de ressources" },
  { key: "manageRoles", label: "Voir et gérer l'onglet Rôles (comptes SVO, mots de passe)" },
  { key: "viewActivity", label: "Voir le journal d'activité" },
];
const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

function hasPermission(user, key) {
  return user.role === "hsv" || (user.permissions || []).includes(key);
}

module.exports = { PERMISSIONS, PERMISSION_KEYS, hasPermission };
