const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { config } = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');

config({ path: path.resolve(__dirname, '../.env') });

function askHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Cette commande doit être exécutée dans un terminal interactif.'));
  }

  return new Promise((resolve, reject) => {
    let value = '';
    let swallowLineFeed = false;
    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (swallowLineFeed) {
          swallowLineFeed = false;
          if (character === '\n') continue;
        }
        if (character === '\u0003') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          reject(new Error('Opération annulée.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          swallowLineFeed = character === '\r';
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
        } else if (character >= ' ') {
          value += character;
        }
      }
    };

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL est absent. Vérifiez la configuration locale avant de continuer.');
  }

  const emailPrompt = readline.createInterface({ input: stdin, output: stdout });
  const email = (await emailPrompt.question('Adresse e-mail du compte administrateur plateforme : ')).trim().toLowerCase();
  emailPrompt.close();

  let password = await askHidden('Nouveau mot de passe (saisie masquée) : ');
  const confirmation = await askHidden('Confirmez le nouveau mot de passe : ');
  if (password !== confirmation) throw new Error('Les mots de passe ne correspondent pas.');
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/.test(password)) {
    throw new Error('Le mot de passe doit contenir entre 12 et 128 caractères, avec une minuscule, une majuscule et un chiffre.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Adresse e-mail invalide.');

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true, platformAdmin: { select: { id: true, isActive: true } } },
    });
    if (!user?.isActive || !user.platformAdmin?.isActive) {
      throw new Error('Aucun compte administrateur plateforme actif ne correspond à cette adresse dans la base configurée. Aucun changement effectué.');
    }

    const passwordHash = await hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.platformAuditLog.create({
        data: {
          action: 'PLATFORM_ADMIN_PASSWORD_RESET',
          entityType: 'PlatformAdmin',
          entityId: user.platformAdmin.id,
          details: { method: 'local-recovery-command' },
        },
      }),
    ]);
    stdout.write('Mot de passe administrateur réinitialisé. Connectez-vous avec le nouveau mot de passe.\n');
  } finally {
    password = '';
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  stdout.write(`${error.message}\n`);
  process.exitCode = 1;
});