import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/mysql/client"

// 获取所有客户
export async function GET() {
  try {
    const rows = await query(
      `SELECT * FROM customers ORDER BY created_at DESC`
    )
    return NextResponse.json(rows)
  } catch (error: any) {
    console.error("[API] GET /api/customers error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 创建客户
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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
    } = body

    const id = crypto.randomUUID()
    const logsJson = JSON.stringify(logs)

    await query(
      `INSERT INTO customers (id, douyin, wechat, type, clientgender, studentname, studentgender, city, grade, score, phone, source, follower, school, status, logs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, douyin, wechat, type, clientgender, studentname, studentgender, city, grade, score, phone, source, follower, school, status, logsJson]
    )

    return NextResponse.json({ success: true, id })
  } catch (error: any) {
    console.error("[API] POST /api/customers error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
