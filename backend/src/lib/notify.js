const prisma = require("./prisma");

// Real SMTP sending only kicks in once SMTP_HOST is set in the environment —
// until then every notification is just logged, so the trigger logic below
// can be wired up and tested without any mail account. See .env.example for
// the variables to set when a real mailbox is ready.
let transporter;
function getTransporter() {
  if (transporter !== undefined) return transporter;
  if (!process.env.SMTP_HOST) {
    transporter = null;
    return transporter;
  }
  const nodemailer = require("nodemailer");
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

async function sendEmail(to, subject, text) {
  if (!to) return;
  const t = getTransporter();
  if (!t) {
    console.log(`[EMAIL SIMULÉ] À: ${to}\nObjet: ${subject}\n${text}\n`);
    return;
  }
  try {
    await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
  } catch (e) {
    console.error(`Échec d'envoi email à ${to}:`, e.message);
  }
}

async function notifyHSV(subject, text) {
  const hsvUsers = await prisma.user.findMany({ where: { role: "hsv" } });
  await Promise.all(hsvUsers.map((u) => sendEmail(u.email, subject, text)));
}

async function notifyUser(user, subject, text) {
  if (!user) return;
  await sendEmail(user.email, subject, text);
}

async function notifyPoolMember(poolMember, subject, text) {
  if (!poolMember) return;
  await sendEmail(poolMember.email, subject, text);
}

// The Team/Tech Lead(s) "of" a sous-équipe are Users holding proposeAllocations
// whose own pool entry (matched by name, the existing convention in this app)
// sits in that sous-équipe.
async function notifyTeamLeadsForSousEquipe(sousEquipe, subject, text) {
  if (!sousEquipe) return;
  const members = await prisma.poolMember.findMany({ where: { sousEquipe }, select: { name: true } });
  if (members.length === 0) return;
  const leads = await prisma.user.findMany({
    where: { name: { in: members.map((m) => m.name) }, permissions: { has: "proposeAllocations" } },
  });
  await Promise.all(leads.map((u) => sendEmail(u.email, subject, text)));
}

// Same idea as above but scoped to a whole squad (Mobile/TPE/Digital) rather
// than a sous-équipe — used for demand, which is only ever expressed at
// squad granularity (see DemandLine.profile), so every lead of that squad
// can start planning who they might propose.
async function notifyTeamLeadsForSquad(squad, subject, text) {
  if (!squad) return;
  const members = await prisma.poolMember.findMany({ where: { squad }, select: { name: true } });
  if (members.length === 0) return;
  const leads = await prisma.user.findMany({
    where: { name: { in: members.map((m) => m.name) }, permissions: { has: "proposeAllocations" } },
  });
  await Promise.all(leads.map((u) => sendEmail(u.email, subject, text)));
}

module.exports = { sendEmail, notifyHSV, notifyUser, notifyPoolMember, notifyTeamLeadsForSousEquipe, notifyTeamLeadsForSquad };
