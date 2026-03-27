import { Pool } from "pg";

const pool = new Pool({
    user: "postgres",
    password: "postgres",
    host: "localhost",
    port: 5432,
    database: "family_expense",
});

console.log("DB_INFO:", process.env);


export default pool