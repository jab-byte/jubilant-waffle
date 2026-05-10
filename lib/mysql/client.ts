import mysql from "mysql2/promise"

// 创建连接池
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "zhaoSheng",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // MySQL 8.0 需要的认证插件
  // 如果遇到认证问题，可以在 MySQL 中执行:
  // ALTER USER 'your_user'@'%' IDENTIFIED WITH mysql_native_password BY 'your_password';
})

export async function getConnection() {
  return pool.getConnection()
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await pool.execute(sql, params)
  return rows as T
}

export default pool
