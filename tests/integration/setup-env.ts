import { testDatabaseUrl } from "./helpers";

// Los tests nunca tocan la base de desarrollo: todo apunta a db-test.
process.env.DATABASE_URL = testDatabaseUrl();
