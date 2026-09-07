const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { generatePeriods } = require("../src/lib/periods");

const prisma = new PrismaClient();

const POOL_SEED = [
  { key: "p1", name: "Abir Hcine", squad: "Mobile", sousEquipe: "Mobile", roleTitle: "Team Lead" },
  { key: "p2", name: "Taher Bekri", squad: "Mobile", sousEquipe: "Mobile", roleTitle: "Tech Lead" },
  { key: "p3", name: "Sinda Arous", squad: "Mobile", sousEquipe: "Mobile", roleTitle: "Développeur" },
  { key: "p4", name: "Narjess Ben Slimene", squad: "Mobile", sousEquipe: "Mobile", roleTitle: "Développeur" },
  { key: "p5", name: "Ekbel Zrelli", squad: "Mobile", sousEquipe: "Mobile", roleTitle: "Développeur" },
  { key: "p6", name: "Firas Zarrouk", squad: "Mobile", sousEquipe: "Mobile", roleTitle: "Développeur" },
  { key: "p7", name: "Moncef Essalah", squad: "TPE", sousEquipe: "TPE Android", roleTitle: "Team Lead" },
  { key: "p8", name: "Ali Ouled Bouzid", squad: "TPE", sousEquipe: "TPE Android", roleTitle: "Développeur" },
  { key: "p9", name: "Idriss Ghoul", squad: "TPE", sousEquipe: "TPE Android", roleTitle: "Développeur" },
  { key: "p10", name: "Jihed Becher", squad: "TPE", sousEquipe: "TPE Android", roleTitle: "Développeur" },
  { key: "p11", name: "Oussama Cheikh", squad: "TPE", sousEquipe: "TPE Engage", roleTitle: "Team Lead" },
  { key: "p12", name: "Melek Abidi", squad: "TPE", sousEquipe: "TPE Engage", roleTitle: "Développeur" },
  { key: "p13", name: "Skander Mhiri", squad: "TPE", sousEquipe: "TPE Engage", roleTitle: "Développeur" },
  { key: "p14", name: "Aymen Moncer", squad: "Digital", sousEquipe: "Digital", roleTitle: "Team Lead" },
  { key: "p15", name: "Abderraouf Zayen", squad: "Digital", sousEquipe: "Digital", roleTitle: "Tech Lead" },
  { key: "p16", name: "Abdelkader BelhajSlimene", squad: "Digital", sousEquipe: "Digital", roleTitle: "Développeur" },
  { key: "p17", name: "Acil Farhat", squad: "Digital", sousEquipe: "Digital", roleTitle: "Développeur" },
  { key: "p18", name: "Dhia Kahri", squad: "Digital", sousEquipe: "Digital", roleTitle: "Développeur" },
  { key: "p19", name: "Fatma Mbarek", squad: "Digital", sousEquipe: "Digital", roleTitle: "Développeur" },
  { key: "p20", name: "Ghazi Ben Halima", squad: "Digital", sousEquipe: "Digital", roleTitle: "Développeur" },
  { key: "p21", name: "Hatem Zaiem", squad: "Digital", sousEquipe: "Digital", roleTitle: "Développeur" },
  { key: "p22", name: "Karim Chakroun", squad: "Digital", sousEquipe: "Digital", roleTitle: "Développeur" },
  { key: "p23", name: "Khaled Guesmi", squad: "Digital", sousEquipe: "Digital", roleTitle: "Développeur" },
  { key: "p24", name: "Najla Abidi", squad: "Digital", sousEquipe: "Digital", roleTitle: "Développeur" },
  { key: "p25", name: "Salma Mouelhi", squad: "Digital", sousEquipe: "Digital", roleTitle: "Développeur" },
  { key: "p26", name: "Skander Turki", squad: "Digital", sousEquipe: "Digital", roleTitle: "Développeur" },
];

async function main() {
  console.log("Nettoyage des données existantes…");
  await prisma.allocationLine.deleteMany();
  await prisma.demandLine.deleteMany();
  await prisma.project.deleteMany();
  await prisma.poolMember.deleteMany();
  await prisma.user.deleteMany();

  console.log("Création du pool…");
  const poolByKey = {};
  for (const p of POOL_SEED) {
    poolByKey[p.key] = await prisma.poolMember.create({
      data: { name: p.name, squad: p.squad, sousEquipe: p.sousEquipe, roleTitle: p.roleTitle },
    });
  }

  console.log("Création du compte Head of Value Stream (mot de passe initial: admin)…");
  const hsv = await prisma.user.create({
    data: { name: "Head of Value Stream", role: "hsv", passwordHash: await bcrypt.hash("admin", 10) },
  });

  console.log("Création des comptes SVO…");
  // La plupart sont dupliqués depuis une personne du pool (nom complet repris tel quel).
  const svoFromPool = [
    ["p14", "Aymen Moncer"],
    ["p2", "Taher Bekri"],
    ["p15", "Abderraouf Zayen"],
    ["p1", "Abir Hcine"],
    ["p7", "Moncef Essalah"],
    ["p11", "Oussama Cheikh"],
    ["p16", "Abdelkader BelhajSlimene"],
  ];
  const svo = {};
  for (const [key, name] of svoFromPool) {
    svo[key] = await prisma.user.create({ data: { name, role: "svo" } });
  }
  // Un SVO n'est pas nécessairement dans le pool de développement.
  const akram = await prisma.user.create({ data: { name: "Akram", role: "svo" } });

  console.log("Création des projets…");
  const projectDefs = [
    { name: "SMT - BIAT", svo: svo.p14, status: "En cours (Dev)", demandSubmitted: true },
    { name: "SMT - Mobile Payment & Switch", svo: svo.p14, status: "Exploitation", demandSubmitted: true },
    { name: "MPAY - MPAY V1", svo: svo.p2, status: "En cours", demandSubmitted: true },
    { name: "Moamalat TPE", svo: svo.p7, status: "Nouvelles demandes en cours", demandSubmitted: false },
    { name: "Payfac", svo: svo.p15, status: "En cours de migration", demandSubmitted: false },
    { name: "BOA MPAY", svo: svo.p1, status: "Prêt / OK", demandSubmitted: false },
  ];
  const projects = [];
  for (const def of projectDefs) {
    projects.push(
      await prisma.project.create({
        data: { name: def.name, svoUserId: def.svo.id, status: def.status, demandSubmitted: def.demandSubmitted },
      })
    );
  }
  const [pr1, pr2, pr3] = projects;

  console.log("Création des lignes de besoin et d'affectation…");
  const period0 = generatePeriods(1)[0];

  await prisma.demandLine.create({ data: { projectId: pr1.id, period: period0, profile: "Digital", count: 2, pct: null } });
  await prisma.demandLine.create({ data: { projectId: pr2.id, period: period0, profile: "Digital", count: 1, pct: 0.6 } });
  await prisma.demandLine.create({ data: { projectId: pr3.id, period: period0, profile: "Mobile", count: 1, pct: null } });

  await prisma.allocationLine.create({ data: { projectId: pr1.id, period: period0, poolMemberId: poolByKey.p15.id, pct: 1, createdById: hsv.id } });
  await prisma.allocationLine.create({ data: { projectId: pr2.id, period: period0, poolMemberId: poolByKey.p15.id, pct: 0.5, createdById: hsv.id } });
  await prisma.allocationLine.create({ data: { projectId: pr3.id, period: period0, poolMemberId: poolByKey.p2.id, pct: 0.6, createdById: hsv.id } });

  console.log("Seed terminé.");
  console.log(`Connexion HSV: "Head of Value Stream" / mot de passe "admin" (à changer).`);
  console.log(`Comptes SVO créés sans mot de passe: ${[...Object.values(svo).map((u) => u.name), akram.name].join(", ")}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
