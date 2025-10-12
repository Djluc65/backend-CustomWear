const nodemailer = require('nodemailer');

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

function createTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 587);
  const secureEnv = process.env.EMAIL_SECURE;
  const secure = secureEnv ? secureEnv === 'true' : port === 465;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    if (isDev) {
      console.warn('[Mailer] Config SMTP manquante; mode développement: email non envoyé, simulé.');
      return null;
    }
    throw new Error('Configuration SMTP manquante (EMAIL_HOST/USER/PASS)');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

async function sendEmail({ to, subject, html, text, from }) {
  const transporter = createTransporter();
  const defaultFrom = process.env.EMAIL_FROM || (process.env.EMAIL_USER ? `"CustomWear" <${process.env.EMAIL_USER}>` : undefined);

  if (!transporter) {
    // Mode dev sans config: simuler l'envoi et logguer le contenu minimal
    console.log('[Mailer:DEV] Email simulé', { to, subject });
    return { simulated: true, to, subject };
  }

  const info = await transporter.sendMail({
    from: from || defaultFrom,
    to,
    subject,
    html,
    text
  });
  console.log('[Mailer] Email envoyé', { messageId: info.messageId, to });
  return info;
}

module.exports = { sendEmail };