import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/mysql/client"

// 更新客户
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const logsJson = JSON.stringify(logs)

    await query(
      `UPDATE customers SET 
        douyin = ?, wechat = ?, type = ?, clientgender = ?, studentname = ?, 
        studentgender = ?, city = ?, grade = ?, score = ?, phone = ?, 
        source = ?, follower = ?, school = ?, status = ?, logs = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [douyin, wechat, type, clientgender, studentname, studentgender, city, grade, score, phone, source, follower, school, status, logsJson, id]
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[API] PUT /api/customers/[id] error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 删除客户
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await query(`DELETE FROM customers WHERE id = ?`, [id])
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[API] DELETE /api/customers/[id] error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
