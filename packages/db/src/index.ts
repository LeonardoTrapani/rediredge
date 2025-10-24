import { drizzle } from "drizzle-orm/node-postgres";

export { and, eq, or, sql } from "drizzle-orm";

export const db = drizzle(process.env.DATABASE_URL || "");
