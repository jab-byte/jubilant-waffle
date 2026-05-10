import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/mysql/client"

// 获取所有设置
export async function GET() {
  try {
    const rows = await query<any[]>(`SELECT \`key\`, \`values\` FROM app_settings`)
    // 将 JSON 字符串转换为数组
    const settings = rows.map((row: any) => ({
      key: row.key,
      values: typeof row.values === "string" ? JSON.parse(row.values) : row.values,
    }))
    return NextResponse.json(settings)
  } catch (error: any) {
    console.error("[API] GET /api/settings error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 更新设置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, values } = body

    if (!key || !Array.isArray(values)) {
      return NextResponse.json({ error: "无效的设置数据" }, { status: 400 })
    }

    const valuesJson = JSON.stringify(values)

    // 使用 UPSERT 语法 (INSERT ... ON DUPLICATE KEY UPDATE)
    await query(
      `INSERT INTO app_settings (\`key\`, \`values\`) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE \`values\` = ?, updated_at = NOW()`,
      [key, valuesJson, valuesJson]
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[API] PUT /api/settings error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
