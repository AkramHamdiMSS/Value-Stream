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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Mirrors the portal's own look (BrandHeader/BrandMark, card + sidebar
// tokens from index.css's light theme — see frontend/src/styles.js) rather
// than a generic transactional-email template. Table-based layout and
// inline styles throughout: Outlook desktop's renderer ignores flexbox,
// grid and <style> blocks, so this is the one layout approach that holds up
// across every client, not just modern ones.
function buildEmailHtml(subject, text, link) {
  const href = link || process.env.APP_URL;
  const label = link ? "Voir le projet" : "Ouvrir Pilotage ressources";
  return `<div style="background:#f5f5fc;padding:32px 12px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td style="background:#ffffff;border:1px solid #e1e0f0;border-radius:14px;overflow:hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:18px 24px;border-bottom:1px solid #e1e0f0;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:32px;height:32px;background:#5251d9;border-radius:8px;text-align:center;vertical-align:middle;">
              <span style="color:#ffffff;font-weight:700;font-size:13px;font-family:Arial,sans-serif;line-height:32px;">MS</span>
            </td>
            <td style="padding-left:10px;">
              <div style="font-size:12px;font-weight:700;color:#14142b;">MS Solutions</div>
              <div style="font-size:10px;color:#5b5d7a;text-transform:uppercase;letter-spacing:0.06em;">Pilotage ressources</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:26px 24px 22px;">
          <h1 style="margin:0 0 12px;font-size:17px;line-height:1.4;font-weight:700;color:#14142b;">${escapeHtml(subject)}</h1>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#14142b;white-space:pre-line;">${escapeHtml(text)}</p>
          ${href ? `<div style="margin-top:20px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#5251d9;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:9px 18px;border-radius:8px;">${label}</a></div>` : ""}
        </td></tr>
        <tr><td style="padding:14px 24px;background:#efeef9;border-top:1px solid #e1e0f0;">
          <p style="margin:0;font-size:11px;color:#5b5d7a;">Notification automatique — Pilotage ressources, MS Solutions. Ne pas répondre à cet email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

// APP_URL + "?project=<id>" — the frontend (see App.jsx) reads that query
// param on load/login and jumps straight to the project, so the button in
// the email lands the reader exactly where the action they need to take
// actually lives, not just the app's home screen.
function projectLink(projectId) {
  if (!process.env.APP_URL || !projectId) return null;
  return `${process.env.APP_URL.replace(/\/$/, "")}/?project=${projectId}`;
}

async function sendEmail(to, subject, text, link) {
  if (!to) return;
  const t = getTransporter();
  if (!t) {
    console.log(`[EMAIL SIMULÉ] À: ${to}\nObjet: ${subject}\n${text}${link ? `\nLien: ${link}` : ""}\n`);
    return;
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: link ? `${text}\n\n${link}` : text,
      html: buildEmailHtml(subject, text, link),
    });
  } catch (e) {
    console.error(`Échec d'envoi email à ${to}:`, e.message);
  }
}

async function notifyHSV(subject, text, link) {
  const hsvUsers = await prisma.user.findMany({ where: { role: "hsv" } });
  await Promise.all(hsvUsers.map((u) => sendEmail(u.email, subject, text, link)));
}

async function notifyUser(user, subject, text, link) {
  if (!user) return;
  await sendEmail(user.email, subject, text, link);
}

async function notifyPoolMember(poolMember, subject, text, link) {
  if (!poolMember) return;
  await sendEmail(poolMember.email, subject, text, link);
}

// The Team/Tech Lead(s) "of" a sous-équipe are Users holding proposeAllocations
// whose own pool entry (matched by name, the existing convention in this app)
// sits in that sous-équipe.
async function notifyTeamLeadsForSousEquipe(sousEquipe, subject, text, link) {
  if (!sousEquipe) return;
  const members = await prisma.poolMember.findMany({ where: { sousEquipe }, select: { name: true } });
  if (members.length === 0) return;
  const leads = await prisma.user.findMany({
    where: { name: { in: members.map((m) => m.name) }, permissions: { has: "proposeAllocations" } },
  });
  await Promise.all(leads.map((u) => sendEmail(u.email, subject, text, link)));
}

// Same idea as above but scoped to a whole squad (Mobile/TPE/Digital) rather
// than a sous-équipe — used for demand, which is only ever expressed at
// squad granularity (see DemandLine.profile), so every lead of that squad
// can start planning who they might propose.
async function notifyTeamLeadsForSquad(squad, subject, text, link) {
  if (!squad) return;
  const members = await prisma.poolMember.findMany({ where: { squad }, select: { name: true } });
  if (members.length === 0) return;
  const leads = await prisma.user.findMany({
    where: { name: { in: members.map((m) => m.name) }, permissions: { has: "proposeAllocations" } },
  });
  await Promise.all(leads.map((u) => sendEmail(u.email, subject, text, link)));
}

module.exports = { sendEmail, notifyHSV, notifyUser, notifyPoolMember, notifyTeamLeadsForSousEquipe, notifyTeamLeadsForSquad, projectLink };
