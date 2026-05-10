"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import {
  Download,
  Upload,
  Plus,
  FileSpreadsheet,
  Trash2,
  Search,
  Pencil,
  LogOut,
  Users,
  Settings,
  X,
  Loader2,
  Paperclip,
  ImageIcon,
  FileText,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// 使用阿里云 MySQL API 代替 Supabase
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ADMIN_USER = "admin"
const ADMIN_PWD = "123456"

const STATUS_OPTIONS = ["未沟通", "已沟通", "已成交", "无意向"] as const
type StatusType = (typeof STATUS_OPTIONS)[number]

// 附件功能需要配置阿里云 OSS（暂时禁用）
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

type Attachment = {
  path: string
  url: string
  name: string
  type: string
  size: number
  uploadedAt: string
}

type CommunicationLog = {
  id: string
  content: string
  attachments: Attachment[]
  createdAt: string // ISO timestamp
}

type Customer = {
  id: string
  douyin: string
  wechat: string
  type: string
  clientgender: string
  studentname: string
  studentgender: string
  city: string
  grade: string
  score: string
  phone: string
  source: string
  follower: string
  school: string
  status: StatusType
  logs: CommunicationLog[]
  createTime: string
  createdAt: string // ISO timestamp from DB, used for filtering
}

const DEFAULT_SOURCES = ["地推", "转介绍", "抖音", "微信", "门店", "其他"]
const DEFAULT_FOLLOWERS = ["老师A", "老师B", "老师C", "其他"]

function formatChineseTime(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}年${m}月${day}日`
}

function statusStyle(status: StatusType) {
  switch (status) {
    case "未沟通":
      return "bg-muted text-muted-foreground"
    case "已沟通":
      return "bg-blue-100 text-blue-700"
    case "已成交":
      return "bg-emerald-100 text-emerald-700"
    case "无意向":
      return "bg-rose-100 text-rose-700"
    default:
      return "bg-muted text-muted-foreground"
  }
}

type FormState = Omit<Customer, "id" | "createTime" | "createdAt"> & {
  id: string | null
  // 新日志草稿（未提交前的输入）
  newLogContent: string
  newLogAttachments: Attachment[]
}

function emptyForm(): FormState {
  return {
    id: null,
    douyin: "",
    wechat: "",
    type: "未知",
    clientgender: "未知",
    studentname: "",
    studentgender: "未知",
    city: "",
    grade: "",
    score: "",
    phone: "",
    source: "",
    follower: "",
    school: "",
    status: "未沟通",
    logs: [],
    newLogContent: "",
    newLogAttachments: [],
  }
}

function genId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isImage(type: string) {
  return type.startsWith("image/")
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

type DBRow = {
  id: string
  douyin: string | null
  wechat: string | null
  type: string | null
  clientgender: string | null
  studentname: string | null
  studentgender: string | null
  city: string | null
  grade: string | null
  score: string | null
  phone: string
  source: string | null
  follower: string | null
  school: string | null
  status: string
  logs: CommunicationLog[] | null
  remark?: string | null
  attachments?: Attachment[] | null
  created_at: string
}

function rowToCustomer(r: DBRow): Customer {
  let logs: CommunicationLog[] = Array.isArray(r.logs) ? r.logs : []

  // 向后兼容：若 logs 为空但存在旧的 remark / attachments，合成一条日志用于展示
  if (
    logs.length === 0 &&
    ((r.remark && r.remark.length > 0) ||
      (Array.isArray(r.attachments) && r.attachments.length > 0))
  ) {
    logs = [
      {
        id: `legacy-${r.id}`,
        content: r.remark ?? "",
        attachments: Array.isArray(r.attachments) ? r.attachments : [],
        createdAt: r.created_at,
      },
    ]
  }

  // 日志按时间倒序显示（最新在前）
  logs = [...logs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return {
    id: r.id,
    douyin: r.douyin ?? "",
    wechat: r.wechat ?? "",
    type: r.type ?? "未知",
    clientgender: r.clientgender ?? "未知",
    studentname: r.studentname ?? "",
    studentgender: r.studentgender ?? "未知",
    city: r.city ?? "",
    grade: r.grade ?? "",
    score: r.score ?? "",
    phone: r.phone,
    source: r.source ?? "",
    follower: r.follower ?? "",
    school: r.school ?? "",
    status: (STATUS_OPTIONS as readonly string[]).includes(r.status)
      ? (r.status as StatusType)
      : "未沟通",
    logs,
    createTime: formatChineseTime(r.created_at),
    createdAt: r.created_at,
  }
}

export default function Page() {
  // 移除 Supabase，改用 MySQL API

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginError, setLoginError] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const [tab, setTab] = useState<"customers" | "settings">("customers")

  const [dataList, setDataList] = useState<Customer[]>([])
  const [sourceList, setSourceList] = useState<string[]>(DEFAULT_SOURCES)
  const [followerList, setFollowerList] = useState<string[]>(DEFAULT_FOLLOWERS)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const [previewAllAttachments, setPreviewAllAttachments] = useState<Attachment[]>([])

  const [filterStatus, setFilterStatus] = useState<string>("")
  const [filterDate, setFilterDate] = useState<string>("")

  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState("录入客户信息")
  const [form, setForm] = useState<FormState>(emptyForm())

  const [newSource, setNewSource] = useState("")
  const [newFollower, setNewFollower] = useState("")

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  // 定义拖拽传感器（保证只创建一次）
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 登录状态仍用 localStorage（仅前端会话）
  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem("zsLoggedIn") === "1"
      if (loggedIn) setIsLoggedIn(true)
    } catch {}
  }, [])

  const loadCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers")
      if (!res.ok) {
        const err = await res.json()
        console.log("[v0] load customers error:", err.error)
        return
      }
      const data = await res.json()
      setDataList((data as DBRow[]).map(rowToCustomer))
    } catch (err: any) {
      console.log("[v0] load customers error:", err.message)
    }
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings")
      if (!res.ok) {
        const err = await res.json()
        console.log("[v0] load settings error:", err.error)
        return
      }
      const data = await res.json()
      const map: Record<string, string[]> = {}
      for (const row of data as { key: string; values: string[] }[]) {
        map[row.key] = row.values ?? []
      }
      if (map.sources?.length) setSourceList(map.sources)
      if (map.followers?.length) setFollowerList(map.followers)
    } catch (err: any) {
      console.log("[v0] load settings error:", err.message)
    }
  }, [])

  // 登录后拉取数据
  useEffect(() => {
    if (!isLoggedIn) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await Promise.all([loadCustomers(), loadSettings()])
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isLoggedIn, loadCustomers, loadSettings])

  const stats = useMemo(
    () => ({
      total: dataList.length,
      wait: dataList.filter((i) => i.status === "未沟通").length,
      talked: dataList.filter((i) => i.status === "已沟通").length,
      deal: dataList.filter((i) => i.status === "已成交").length,
    }),
    [dataList],
  )

  const filteredList = useMemo(() => {
    let list = dataList
    if (filterStatus) list = list.filter((i) => i.status === filterStatus)
    if (filterDate) {
      list = list.filter((i) => i.createdAt.slice(0, 10) === filterDate)
    }
    return list
  }, [dataList, filterStatus, filterDate])

  function handleLogin(e?: React.FormEvent) {
    e?.preventDefault()
    if (username === ADMIN_USER && password === ADMIN_PWD) {
      setIsLoggedIn(true)
      setLoginError(false)
      try {
        localStorage.setItem("zsLoggedIn", "1")
      } catch {}
    } else {
      setLoginError(true)
    }
  }

  function handleLogout() {
    try {
      localStorage.removeItem("zsLoggedIn")
    } catch {}
    setIsLoggedIn(false)
    setUsername("")
    setPassword("")
  }

  function openAddModal() {
    setModalTitle("录入客户信息")
    const f = emptyForm()
    f.source = sourceList[0] ?? ""
    f.follower = followerList[0] ?? ""
    setForm(f)
    setModalOpen(true)
  }

  function openEditModal(id: string) {
    const item = dataList.find((i) => i.id === id)
    if (!item) return
    setModalTitle("编辑信息")
    setForm({
      id: item.id,
      douyin: item.douyin,
      wechat: item.wechat,
      type: item.type,
      clientgender: item.clientgender,
      studentname: item.studentname,
      studentgender: item.studentgender,
      city: item.city,
      grade: item.grade,
      score: item.score,
      phone: item.phone,
      source: item.source,
      follower: item.follower,
      school: item.school,
      status: item.status,
      logs: item.logs ?? [],
      newLogContent: "",
      newLogAttachments: [],
    })
    setModalOpen(true)
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault()
    // 学生姓名和电话都为非必填项，允许保存空表单

    // 如���用户在"新日志草稿"里填了内容或选了附件，保存时自�����为一条日志追加
    let logsToSave = form.logs
    if (form.newLogContent.trim() || form.newLogAttachments.length > 0) {
      const draft: CommunicationLog = {
        id: genId(),
        content: form.newLogContent.trim(),
        attachments: form.newLogAttachments,
        createdAt: new Date().toISOString(),
      }
      logsToSave = [draft, ...form.logs]
    }

    setSaving(true)
    const payload = {
      douyin: form.douyin.trim(),
      wechat: form.wechat.trim(),
      type: form.type,
      clientgender: form.clientgender,
      studentname: form.studentname.trim(),
      studentgender: form.studentgender,
      city: form.city,
      grade: form.grade,
      score: form.score,
      phone: form.phone.trim(),
      source: form.source,
      follower: form.follower,
      school: form.school,
      status: form.status,
      logs: logsToSave,
      // 清空旧字段，避免历史数据干扰
      name: "",
      remark: "",
      attachments: [],
    }
    try {
      const url = form.id ? `/api/customers/${form.id}` : "/api/customers"
      const method = form.id ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      setSaving(false)
      if (!res.ok) {
        const err = await res.json()
        alert("保存失败：" + err.error)
        return
      }
      setModalOpen(false)
      await loadCustomers()
    } catch (err: any) {
      setSaving(false)
      alert("保存失败：" + err.message)
    }
  }

  async function deleteCustomer(id: string) {
    if (!confirm("确定删除该客户？")) return
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        alert("删除失败：" + err.error)
        return
      }
      setDataList((prev) => prev.filter((i) => i.id !== id))
    } catch (err: any) {
      alert("删除失败：" + err.message)
    }
  }

  async function onAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    // 附件上传功能需要配置阿里云 OSS，暂时禁用
    // 如需启用，请配置阿里云 OSS 并创建 /api/upload 接口
    e.target.value = ""
    alert("附件上传功能暂未启用。如需使用，请配置阿里云 OSS 存储服务。")
  }

  async function removeAttachment(index: number) {
    const target = form.newLogAttachments[index]
    if (!target) return
    if (!confirm(`确定删除附件「${target.name}」？`)) return
    // 附件删除（如需启用阿里云 OSS，可在此处添加删除逻辑）
    setForm((prev) => ({
      ...prev,
      newLogAttachments: prev.newLogAttachments.filter((_, i) => i !== index),
    }))
  }

  function openPreview(attachment: Attachment, allAttachments: Attachment[]) {
    setPreviewAttachment(attachment)
    setPreviewAllAttachments(allAttachments)
  }

  function nextAttachment() {
    if (!previewAttachment) return
    const idx = previewAllAttachments.findIndex((a) => a.path === previewAttachment.path)
    if (idx < previewAllAttachments.length - 1) {
      setPreviewAttachment(previewAllAttachments[idx + 1])
    }
  }

  function prevAttachment() {
    if (!previewAttachment) return
    const idx = previewAllAttachments.findIndex((a) => a.path === previewAttachment.path)
    if (idx > 0) {
      setPreviewAttachment(previewAllAttachments[idx - 1])
    }
  }

  function exportData() {
    const exp = dataList.map((i, idx) => ({
      序号: idx + 1,
      抖音昵称: i.douyin || "",
      微信备注: i.wechat || "",
      客户性质: i.type || "未知",
      客户性别: i.clientgender || "未知",
      学生姓名: i.studentname || "",
      学生性别: i.studentgender || "未知",
      城市: i.city || "",
      年级: i.grade || "",
      分数: i.score || "",
      联系电话: i.phone,
      信息来源: i.source || "",
      跟进人: i.follower || "",
      意向学校: i.school || "",
      状态: i.status,
      沟通日志条数: (i.logs ?? []).length,
      最新日志: (i.logs ?? [])[0]?.content?.substring(0, 100) || "",
      最新更新时间: (i.logs ?? [])[0]?.createdAt
        ? formatChineseTime((i.logs ?? [])[0].createdAt)
        : "",
      录入时间: i.createTime,
    }))
    const ws = XLSX.utils.json_to_sheet(exp)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "招生数据")
    XLSX.writeFile(wb, "南京中考招生客户数据.xlsx")
  }

  async function clearData() {
    if (!confirm("确定清空所有客户数据？此操作将从数据库永久删除，且不可撤销。")) return
    try {
      const res = await fetch("/api/customers/batch", { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        alert("清空失败：" + err.error)
        return
      }
      setDataList([])
    } catch (err: any) {
      alert("清空失败：" + err.message)
    }
  }

  // 列名映射：从 Excel 中文列名到数据库字段
  const COLUMN_MAPPING: Record<string, keyof Omit<Customer, 'id' | 'logs' | 'createTime' | 'createdAt'>> = {
    抖音昵称: 'douyin',
    微信备注: 'wechat',
    客户性质: 'type',
    客户性别: 'clientgender',
    学生姓名: 'studentname',
    学生性别: 'studentgender',
    城市: 'city',
    年级: 'grade',
    分数: 'score',
    联系电话: 'phone',
    信息来源: 'source',
    跟进人: 'follower',
    意向学校: 'school',
    状态: 'status',
  }

  async function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!worksheet) {
        alert('Excel 文件为空')
        return
      }

      const rawData = XLSX.utils.sheet_to_json(worksheet)
      if (rawData.length === 0) {
        alert('Excel 表格中没有数据行')
        return
      }

      // 验证列名
      const firstRow = rawData[0] as Record<string, any>
      const hasValidColumns = Object.keys(COLUMN_MAPPING).some(col => firstRow.hasOwnProperty(col))
      if (!hasValidColumns) {
        alert('Excel 列名不匹配，请确保包含以下列之一：' + Object.keys(COLUMN_MAPPING).join(', '))
        return
      }

      // 转换数据
      const converted = (rawData as Array<Record<string, any>>).map((row) => {
        const item: Partial<Customer> = {
          douyin: '',
          wechat: '',
          type: '未知',
          clientgender: '未知',
          studentname: '',
          studentgender: '未知',
          city: '',
          grade: '',
          score: '',
          phone: '',
          source: '',
          follower: '',
          school: '',
          status: '未沟通' as StatusType,
          logs: [],
        }

        // 映射列
        for (const [excelCol, dbField] of Object.entries(COLUMN_MAPPING)) {
          if (row.hasOwnProperty(excelCol) && row[excelCol] !== null && row[excelCol] !== undefined) {
            const value = String(row[excelCol]).trim()
            if (value) {
              if (dbField === 'status') {
                // 验证 status 值是否有效
                const validStatus = (STATUS_OPTIONS as readonly string[]).includes(value)
                item[dbField] = (validStatus ? value : '未沟通') as StatusType
              } else {
                ;(item as any)[dbField] = value
              }
            }
          }
        }

        return item
      })

      // 批量导入到数据库
      setLoading(true)
      const res = await fetch('/api/customers/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customers: converted.map(c => ({
            douyin: c.douyin || '',
            wechat: c.wechat || '',
            type: c.type,
            clientgender: c.clientgender,
            studentname: c.studentname || '',
            studentgender: c.studentgender,
            city: c.city || '',
            grade: c.grade || '',
            score: c.score || '',
            phone: c.phone || '',
            source: c.source || '',
            follower: c.follower || '',
            school: c.school || '',
            status: c.status,
            logs: c.logs || [],
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert('导入失败：' + err.error)
      } else {
        alert(`成功导入 ${converted.length} 条客户信息`)
        await loadCustomers()
      }
    } catch (err: any) {
      alert('文件解析失败：' + (err?.message ?? String(err)))
    } finally {
      setLoading(false)
    }
  }

  async function saveSetting(key: "sources" | "followers", values: string[]) {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, values }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert("保存设置失败：" + err.error)
        return false
      }
      return true
    } catch (err: any) {
      alert("保存设置失败：" + err.message)
      return false
    }
  }

  async function addSource() {
    const v = newSource.trim()
    if (!v || sourceList.includes(v)) return
    const next = [...sourceList, v]
    if (await saveSetting("sources", next)) {
      setSourceList(next)
      setNewSource("")
    }
  }
  async function delSource(idx: number) {
    if (!confirm("确定删除该来源？")) return
    const next = sourceList.filter((_, i) => i !== idx)
    if (await saveSetting("sources", next)) setSourceList(next)
  }
  async function addFollower() {
    const v = newFollower.trim()
    if (!v || followerList.includes(v)) return
    const next = [...followerList, v]
    if (await saveSetting("followers", next)) {
      setFollowerList(next)
      setNewFollower("")
    }
  }
  async function delFollower(idx: number) {
    if (!confirm("确定删除该跟进人？")) return
    const next = followerList.filter((_, i) => i !== idx)
    if (await saveSetting("followers", next)) setFollowerList(next)
  }

  // ========== 登录界面 ==========
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/10 text-blue-600">
              <Users className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl text-balance">南京中考招生咨询管理系统</CardTitle>
            <p className="text-sm text-muted-foreground">请���用管理员账号登录</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">管理员账号</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入账号"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">登录密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
              </div>
              {loginError && (
                <p className="text-sm text-rose-600 text-center">账号或密码错误，请���试！</p>
              )}
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                登录系统
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                默认账号：admin　密码：123456
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    )
  }

  // ========== 主界面 ==========
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-3">
          <h1 className="text-lg md:text-xl font-bold">南京中考招生咨询管理系统</h1>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={tab === "customers" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTab("customers")}
              className={
                tab === "customers"
                  ? "bg-white text-blue-700 hover:bg-white/90"
                  : "text-white hover:bg-white/10 hover:text-white"
              }
            >
              <Users className="h-4 w-4" />
              客户管理
            </Button>
            <Button
              variant={tab === "settings" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTab("settings")}
              className={
                tab === "settings"
                  ? "bg-white text-blue-700 hover:bg-white/90"
                  : "text-white hover:bg-white/10 hover:text-white"
              }
            >
              <Settings className="h-4 w-4" />
              系统设置
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleLogout}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              退出
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {tab === "customers" ? (
          <>
            {/* 统计卡片 */}
            {/* 统计 - 超紧凑单行 */}
            <div className="flex flex-wrap gap-3 text-xs mb-2 py-1.5">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">总客户</span>
                <span className="font-bold text-blue-600">{stats.total}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">未沟通</span>
                <span className="font-bold text-slate-500">{stats.wait}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">已沟通</span>
                <span className="font-bold text-blue-600">{stats.talked}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">已成交</span>
                <span className="font-bold text-emerald-600">{stats.deal}</span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Button onClick={openAddModal} size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 px-2 text-xs">
                <Plus className="h-3 w-3" />
                <span>录入</span>
              </Button>
              <Button
                onClick={exportData}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2 text-xs"
              >
                <FileSpreadsheet className="h-3 w-3" />
                <span>导出</span>
              </Button>
              <Button
                onClick={() => importInputRef.current?.click()}
                size="sm"
                className="bg-blue-500 hover:bg-blue-600 text-white h-7 px-2 text-xs"
              >
                <Upload className="h-3 w-3" />
                <span>导入</span>
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportChange}
              />
              <Button onClick={clearData} variant="destructive" size="sm" className="h-7 px-2 text-xs">
                <Trash2 className="h-3 w-3" />
                <span>清空</span>
              </Button>
              {loading && (
                <span className="inline-flex items-center text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  加载中
                </span>
              )}
            </div>

            {/* 筛选 - 单行紧凑 */}
            <div className="flex flex-wrap gap-2 items-center mb-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">状态:</Label>
                <Select
                  value={filterStatus || "all"}
                  onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="h-7 w-28 text-xs py-1">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">日期:</Label>
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="h-7 text-xs w-36 py-1"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setFilterStatus("")
                  setFilterDate("")
                }}
              >
                <X className="h-3 w-3" />
                <span>重置</span>
              </Button>
              <Button size="sm" className="h-7 px-2 text-xs bg-slate-700 hover:bg-slate-800 text-white">
                <Search className="h-3 w-3" />
                <span>查询</span>
              </Button>
            </div>

            {/* 数据表格 */}
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100 hover:bg-slate-100">
                      <TableHead className="w-14">序号</TableHead>
                      <TableHead>抖音/微信</TableHead>
                      <TableHead>客户性质/性别</TableHead>
                      <TableHead>学生姓名/性别</TableHead>
                      <TableHead>城市</TableHead>
                      <TableHead>年级</TableHead>
                      <TableHead>分数</TableHead>
                      <TableHead>联系电话</TableHead>
                      <TableHead>信息来源</TableHead>
                      <TableHead>跟进人</TableHead>
                      <TableHead>意向学校</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="min-w-[200px]">沟通日志</TableHead>
                      <TableHead>录入时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={15} className="text-center py-10 text-muted-foreground">
                          {loading ? "加载中..." : "暂无数据，点击上方「录入客户信息」开始。"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredList.map((item, i) => (
                        <TableRow key={item.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="text-xs">{item.douyin || "-"} / {item.wechat || "-"}</TableCell>
                          <TableCell className="text-xs">{item.type || "未知"} / {item.clientgender || "未知"}</TableCell>
                          <TableCell className="text-xs">{item.studentname || "-"} + {item.studentgender || "未知"}</TableCell>
                          <TableCell>{item.city || "-"}</TableCell>
                          <TableCell>{item.grade || "-"}</TableCell>
                          <TableCell>{item.score || "-"}</TableCell>
                          <TableCell>{item.phone}</TableCell>
                          <TableCell>{item.source || "-"}</TableCell>
                          <TableCell>{item.follower || "-"}</TableCell>
                          <TableCell>{item.school || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={statusStyle(item.status)}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[300px]">
                            {item.logs && item.logs.length > 0 ? (
                              <div className="space-y-1">
                                <div className="font-medium text-slate-700">
                                  共 {item.logs.length} 条日志
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  <div className="font-medium">
                                    {formatChineseTime(item.logs[0].createdAt)}
                                  </div>
                                  <div className="whitespace-pre-wrap break-words line-clamp-2">
                                    {item.logs[0].content || "（无内容）"}
                                  </div>
                                  {item.logs[0].attachments.length > 0 && (
                                    <div className="text-blue-600 mt-1">
                                      ���含 {item.logs[0].attachments.length} 个附件
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {item.createTime}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 hover:text-blue-700"
                              onClick={() => openEditModal(item.id)}
                            >
                              <Pencil className="h-4 w-4" />
                              编辑
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600 hover:text-rose-700"
                              onClick={() => deleteCustomer(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              删除
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">信息来源管理</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="输入新来源（例如：公众号）"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addSource()
                      }
                    }}
                  />
                  <Button onClick={addSource} className="bg-blue-600 hover:bg-blue-700">
                    添加
                  </Button>
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event: DragEndEvent) => {
                    const { active, over } = event
                    if (over && active.id !== over.id) {
                      const oldIndex = sourceList.indexOf(active.id as string)
                      const newIndex = sourceList.indexOf(over.id as string)
                      setSourceList(arrayMove(sourceList, oldIndex, newIndex))
                      saveSetting("sources", arrayMove(sourceList, oldIndex, newIndex))
                    }
                  }}
                >
                  <SortableContext
                    items={sourceList}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {sourceList.map((s) => (
                        <SortableListItem
                          key={s}
                          id={s}
                          item={s}
                          onDelete={() => delSource(sourceList.indexOf(s))}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">跟进人管理</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="输入新跟进人"
                    value={newFollower}
                    onChange={(e) => setNewFollower(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addFollower()
                      }
                    }}
                  />
                  <Button onClick={addFollower} className="bg-blue-600 hover:bg-blue-700">
                    添加
                  </Button>
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event: DragEndEvent) => {
                    const { active, over } = event
                    if (over && active.id !== over.id) {
                      const oldIndex = followerList.indexOf(active.id as string)
                      const newIndex = followerList.indexOf(over.id as string)
                      setFollowerList(arrayMove(followerList, oldIndex, newIndex))
                      saveSetting("followers", arrayMove(followerList, oldIndex, newIndex))
                    }
                  }}
                >
                  <SortableContext
                    items={followerList}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {followerList.map((s) => (
                        <SortableListItem
                          key={s}
                          id={s}
                          item={s}
                          onDelete={() => delFollower(followerList.indexOf(s))}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* 表单对话框 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveForm} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="f-douyin">
                  抖音昵称
                </Label>
                <Input
                  id="f-douyin"
                  placeholder="非必填"
                  value={form.douyin}
                  onChange={(e) => setForm({ ...form, douyin: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-wechat">
                  微信备注
                </Label>
                <Input
                  id="f-wechat"
                  placeholder="非必填"
                  value={form.wechat}
                  onChange={(e) => setForm({ ...form, wechat: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>客户性质</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="未知">未知</SelectItem>
                    <SelectItem value="家长">家长</SelectItem>
                    <SelectItem value="学生">学生</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>客户性别</Label>
                <Select
                  value={form.clientgender}
                  onValueChange={(v) => setForm({ ...form, clientgender: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="未知">未知</SelectItem>
                    <SelectItem value="男">男</SelectItem>
                    <SelectItem value="女">女</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-student-name">
                  学生姓名
                </Label>
                <Input
                  id="f-student-name"
                  value={form.studentname}
                  onChange={(e) => setForm({ ...form, studentname: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>学生性别</Label>
                <Select
                  value={form.studentgender}
                  onValueChange={(v) => setForm({ ...form, studentgender: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="未知">未知</SelectItem>
                    <SelectItem value="男">男</SelectItem>
                    <SelectItem value="女">女</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-city">城市</Label>
                <Input
                  id="f-city"
                  placeholder="如：南京"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-grade">年级</Label>
                <Input
                  id="f-grade"
                  placeholder="如：初三"
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-score">分数</Label>
                <Input
                  id="f-score"
                  placeholder="如：620"
                  value={form.score}
                  onChange={(e) => setForm({ ...form, score: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-phone">
                  联系电话
                </Label>
                <Input
                  id="f-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>客户信息来源</Label>
                <Select
                  value={form.source || undefined}
                  onValueChange={(v) => setForm({ ...form, source: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceList.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>跟进人</Label>
                <Select
                  value={form.follower || undefined}
                  onValueChange={(v) => setForm({ ...form, follower: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {followerList.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="f-school">意向学校</Label>
                <Input
                  id="f-school"
                  value={form.school}
                  onChange={(e) => setForm({ ...form, school: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>当前状态</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as StatusType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-base font-semibold">沟通日志记录</Label>
                <div className="border rounded-lg p-4 bg-muted/20 space-y-4 max-h-80 overflow-y-auto">
                  {form.logs && form.logs.length > 0 ? (
                    <div className="space-y-4">
                      {form.logs.map((log, idx) => (
                        <div
                          key={log.id}
                          className="border-l-4 border-blue-400 pl-3 pb-3 text-sm"
                        >
                          <div className="font-medium text-blue-700">
                            {formatChineseTime(log.createdAt)}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words mt-1">
                            {log.content || "（无内容）"}
                          </div>
                          {log.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {log.attachments.map((a) => (
                                <button
                                  key={a.path}
                                  type="button"
                                  onClick={() => openPreview(a, log.attachments)}
                                  title={a.name}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded text-xs text-blue-600 hover:underline border hover:bg-blue-50 transition"
                                >
                                  {isImage(a.type) ? (
                                    <ImageIcon className="h-3 w-3" />
                                  ) : (
                                    <FileText className="h-3 w-3" />
                                  )}
                                  {a.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      暂无历史沟通记录
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2 border-t pt-4">
                <Label htmlFor="f-new-log">新增沟通记录</Label>
                <Textarea
                  id="f-new-log"
                  rows={3}
                  placeholder="记录本次沟通时间、内容、客户反馈等..."
                  value={form.newLogContent}
                  onChange={(e) => setForm({ ...form, newLogContent: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  填写后保存，将自动创建一条新的沟通日志记录。
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>附件（本次新增）</Label>
                  <span className="text-xs text-muted-foreground">
                    图片、PDF、Office 等，单个文件最大 10MB
                  </span>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                    onChange={onAttachmentChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                    {uploading ? "上传中..." : "添加附件"}
                  </Button>
                </div>

                {form.newLogAttachments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {form.newLogAttachments.map((a, idx) => (
                      <div
                        key={a.path}
                        className="group relative flex items-center gap-2 rounded-md border bg-muted/30 p-2"
                      >
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-shrink-0"
                        >
                          {isImage(a.type) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.url || "/placeholder.svg"}
                              alt={a.name}
                              className="h-12 w-12 object-cover rounded border"
                            />
                          ) : (
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded border bg-background text-muted-foreground">
                              <FileText className="h-5 w-5" />
                            </span>
                          )}
                        </a>
                        <div className="min-w-0 flex-1">
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            title={a.name}
                            className="block truncate text-xs font-medium hover:underline"
                          >
                            {a.name}
                          </a>
                          <div className="text-[11px] text-muted-foreground">
                            {formatSize(a.size)}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-rose-600 hover:text-rose-700"
                          onClick={() => removeAttachment(idx)}
                          aria-label="删除附件"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                取消
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </Button>
            </div>
          </form>
        </DialogContent>
        </Dialog>

      {/* 附件预览 Modal */}
      <Dialog
        open={!!previewAttachment}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAttachment(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-96 overflow-y-auto">
          {previewAttachment && (
            <div className="space-y-4">
              {/* 导航和关闭 */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={prevAttachment}
                    disabled={previewAllAttachments.length <= 1 || previewAllAttachments.findIndex(a => a.path === previewAttachment.path) === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={nextAttachment}
                    disabled={previewAllAttachments.length <= 1 || previewAllAttachments.findIndex(a => a.path === previewAttachment.path) === previewAllAttachments.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {previewAllAttachments.length > 1 && (
                    <span>
                      {previewAllAttachments.findIndex((a) => a.path === previewAttachment.path) + 1} /{" "}
                      {previewAllAttachments.length}
                    </span>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setPreviewAttachment(null)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* 文件信息 */}
              <div className="text-sm">
                <div className="font-medium break-words">{previewAttachment.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatSize(previewAttachment.size)} · {formatChineseTime(previewAttachment.uploadedAt)}
                </div>
              </div>

              {/* 内容预览 */}
              <div className="bg-muted/50 rounded-lg p-4 min-h-96 flex items-center justify-center">
                {isImage(previewAttachment.type) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewAttachment.url || "/placeholder.svg"}
                    alt={previewAttachment.name}
                    className="max-w-full max-h-96 object-contain"
                  />
                ) : previewAttachment.type.includes("video") ? (
                  <video
                    src={previewAttachment.url}
                    controls
                    className="max-w-full max-h-96"
                  />
                ) : (
                  <div className="text-center space-y-4">
                    <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="font-medium">暂不支持预览</p>
                      <p className="text-xs text-muted-foreground">
                        {previewAttachment.type || "文件"}
                      </p>
                    </div>
                    <a
                      href={previewAttachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      <Download className="h-4 w-4" />
                      下载文件
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 可排序列表项组件
function SortableListItem({
  id,
  item,
  onDelete,
}: {
  id: string
  item: string
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 justify-between border rounded-md px-3 py-2 hover:bg-slate-50"
    >
      <div className="flex items-center gap-2 flex-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-sm">{item}</span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="text-rose-600 hover:text-rose-700"
        onClick={onDelete}
      >
        删除
      </Button>
    </div>
  )
}
