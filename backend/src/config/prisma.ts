import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient__: PrismaClient | undefined;
}

const parsedUrl = new URL(env.DATABASE_URL);

const adapter = new PrismaMariaDb({
  host: parsedUrl.hostname,
  port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
  user: decodeURIComponent(parsedUrl.username || "root"),
  password: parsedUrl.password
    ? decodeURIComponent(parsedUrl.password)
    : undefined,
  database: parsedUrl.pathname.replace(/^\//, "") || undefined,
});

const prisma =
  global.__prismaClient__ ??
  new PrismaClient({
    adapter,
  });

if (!env.IS_PRODUCTION) {
  global.__prismaClient__ = prisma;
}

export default prisma;
