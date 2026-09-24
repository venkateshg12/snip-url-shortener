import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 reads the connection URL from here, not from schema.prisma, and doesn't load .env itself.
// No DATABASE_URL (CI or Docker build steps) is fine for `prisma generate`; commands that connect
// then fail with "datasource required" instead of a confusing empty-URL error.
const url = process.env.DATABASE_URL;

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: { path: "prisma/migrations" },
    ...(url && { datasource: { url } }),
});
