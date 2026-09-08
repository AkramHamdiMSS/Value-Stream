require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const pool = require("./data/pool.json");
const projects = require("./data/projects.json");

const prisma = new PrismaClient();

// Data below is sourced from the team's real tracking workbook
// (Suivi_Projets_Pilotage_Ressources.xlsx — Pool / Vue Globale sheets), not the
// earlier prototype's placeholder seed. Projects start with no demand/allocation
// lines because none had been filled in the source workbook yet.

async function main() {
  console.log("Nettoyage des données existantes…");
  await prisma.allocationLine.deleteMany();
  await prisma.demandLine.deleteMany();
  await prisma.project.deleteMany();
  await prisma.poolMember.deleteMany();
  await prisma.user.deleteMany();

  console.log(`Création du pool (${pool.length} personnes)…`);
  for (const p of pool) {
    await prisma.poolMember.create({
      data: { name: p.name, squad: p.squad, sousEquipe: p.sousEquipe, roleTitle: p.roleTitle },
    });
  }

  console.log("Création du compte Head of Value Stream (mot de passe initial: admin)…");
  await prisma.user.create({
    data: { name: "Head of Value Stream", role: "hsv", passwordHash: await bcrypt.hash("admin", 10) },
  });

  const svoNames = [...new Set(projects.map((p) => p.svo))].sort();
  console.log(`Création des comptes SVO (${svoNames.join(", ")})…`);
  const svoByName = {};
  for (const name of svoNames) {
    svoByName[name] = await prisma.user.create({ data: { name, role: "svo" } });
  }

  console.log(`Création des projets (${projects.length})…`);
  for (const p of projects) {
    await prisma.project.create({
      data: {
        name: p.name,
        svoUserId: svoByName[p.svo].id,
        status: p.status,
        demandSubmitted: false,
      },
    });
  }

  console.log("Seed terminé.");
  console.log(`Connexion HSV: "Head of Value Stream" / mot de passe "admin" (à changer).`);
  console.log(`Comptes SVO créés sans mot de passe: ${svoNames.join(", ")}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
