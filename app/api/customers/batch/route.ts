import { NextRequest, NextResponse } from "next/server"
import { query, getConnection } from "@/lib/mysql/client"

// 批量导入客户
export async function POST(request: NextRequest) {
  const connection = await getConnection()
  try {
    const body = await request.json()
    const { customers } = body

    if (!Array.isArray(customers) || customers.length === 0) {
      return NextResponse.json({ error: "无效的客户数据" }, { status: 400 })
    }

    await connection.beginTransaction()

    for (const customer of customers) {
      const id = crypto.randomUUID()
      const {
        douyin = "",
        wechat = "",
        type = "未知",
        clientgender = "未知",
        studentname = "",
        studentgender = "未知",
        city = "",
        grade = "",
        score = "",
        phone = "",
        source = "",
        follower = "",
        school = "",
        status = "未沟通",
        logs = [],
      } = customer

      const logsJson = JSON.stringify(logs)

      await connection.execute(
        `INSERT INTO customers (id, douyin, wechat, type, clientgender, studentname, studentgender, city, grade, score, phone, source, follower, school, status, logs)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, douyin, wechat, type, clientgender, studentname, studentgender, city, grade, score, phone, source, follower, school, status, logsJson]
      )
    }

    await connection.commit()
    return NextResponse.json({ success: true, count: customers.length })
  } catch (error: any) {
    await connection.rollback()
    console.error("[API] POST /api/customers/batch error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    connection.release()
  }
}

// 清空所有客户
export async function DELETE() {
  try {
    await query(`DELETE FROM customers`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[API] DELETE /api/customers/batch error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
