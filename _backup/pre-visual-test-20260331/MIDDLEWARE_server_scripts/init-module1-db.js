const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'SUBWAY';

  const schemaPath = path.resolve(__dirname, '../../db/sql/module1_schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const adminConn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  try {
    await adminConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
    );
  } finally {
    await adminConn.end();
  }

  const dbConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true
  });

  try {
    await dbConn.query(schemaSql);
    console.log(`Module1 schema is ready in database: ${database}`);
  } finally {
    await dbConn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
