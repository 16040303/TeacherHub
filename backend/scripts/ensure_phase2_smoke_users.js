require('dotenv/config');
const bcrypt = require('bcrypt');
const { PrismaClient, UserRole } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const parsedUrl = new URL(process.env.DATABASE_URL || 'mysql://root@localhost:3306/teacherhub');
const adapter = new PrismaMariaDb({
  host: parsedUrl.hostname,
  port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
  user: decodeURIComponent(parsedUrl.username || 'root'),
  password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
  database: parsedUrl.pathname.replace(/^\//, '') || undefined,
});

const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = 'SmokePass123!';
const smokePassword = process.env.PHASE2_SMOKE_PASSWORD && process.env.PHASE2_SMOKE_PASSWORD.trim()
  ? process.env.PHASE2_SMOKE_PASSWORD.trim()
  : DEFAULT_PASSWORD;

const accounts = [
  {
    fullName: 'Phase2 Smoke Teacher',
    email: 'teacher.smoke@test.com',
    role: UserRole.TEACHER,
  },
  {
    fullName: 'Phase2 Smoke Student',
    email: 'student.smoke@test.com',
    role: UserRole.STUDENT,
  },
];

async function ensureSmokeUser(account, passwordHash) {
  const existing = await prisma.user.findUnique({
    where: { email: account.email },
    select: {
      id: true,
      fullName: true,
      role: true,
      isEmailVerified: true,
    },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        fullName: account.fullName,
        email: account.email,
        password: passwordHash,
        role: account.role,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExp: null,
        passwordResetToken: null,
        passwordResetExp: null,
      },
    });
    return {
      email: account.email,
      action: 'created',
    };
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      fullName: account.fullName,
      role: account.role,
      password: passwordHash,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExp: null,
      passwordResetToken: null,
      passwordResetExp: null,
    },
  });

  return {
    email: account.email,
    action: 'updated',
  };
}

async function main() {
  const passwordHash = await bcrypt.hash(smokePassword, 10);
  const results = [];

  for (const account of accounts) {
    const result = await ensureSmokeUser(account, passwordHash);
    results.push(result);
  }

  process.stdout.write(
    JSON.stringify(
      {
        success: true,
        users: results,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    process.stderr.write(`ensure_phase2_smoke_users failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
