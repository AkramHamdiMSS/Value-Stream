// Mirrors backend/src/lib/permissions.js — keep the two in sync.
export const PERMISSIONS = [
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
