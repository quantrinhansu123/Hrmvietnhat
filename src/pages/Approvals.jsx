import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { fbGet, fbPush, fbUpdate } from '../services/firebase'
import { supabase } from '../services/supabase'
import { normalizeString } from '../utils/helpers'
import './Approvals.css'

const REQUESTS_PATH = 'hr/approvalRequests'
// Auth isn't wired up app-wide yet (no <AuthProvider>/login route mounted), so this page
// keeps its own lightweight "who am I" choice in localStorage and prefers a real auth user
// automatically the moment one becomes available.
const ME_STORAGE_KEY = 'apv_current_person'
const RECENT_TEMPLATES_KEY = 'apv_recent_templates'
const MAX_APPROVAL_STEPS = 4

const REQUEST_TEMPLATES = [
  {
    id: 'print',
    category: 'HÀNH CHÍNH',
    title: 'Đề xuất in ấn, ấn phẩm',
    description: 'Đề xuất nhu cầu in ấn hoặc sản xuất ấn phẩm.',
    icon: 'fa-file-circle-check',
    color: '#c8102e'
  },
  {
    id: 'recruit',
    category: 'NHÂN SỰ',
    title: 'ĐỀ XUẤT TUYỂN DỤNG NHÂN SỰ',
    description: 'Đề xuất nhu cầu tuyển dụng nhân sự mới.',
    icon: 'fa-file-circle-check',
    color: '#e11d48'
  },
  {
    id: 'transfer',
    category: 'NHÂN SỰ',
    title: 'ĐỀ XUẤT ĐIỀU CHUYỂN NHÂN SỰ',
    description: 'Đề xuất điều chuyển vị trí hoặc bộ phận nhân sự.',
    icon: 'fa-file-circle-check',
    color: '#9b0c24'
  },
  {
    id: 'appoint',
    category: 'NHÂN SỰ',
    title: 'ĐỀ XUẤT BỔ NHIỆM NHÂN SỰ',
    description: 'Đề xuất bổ nhiệm chức danh hoặc vị trí quản lý.',
    icon: 'fa-file-circle-check',
    color: '#b71c1c'
  },
  {
    id: 'salary-adjust',
    category: 'NHÂN SỰ',
    title: 'ĐỀ XUẤT ĐIỀU CHỈNH MỨC LƯƠNG',
    description: 'Đề xuất điều chỉnh mức lương theo năng lực hoặc thâm niên.',
    icon: 'fa-file-circle-check',
    color: '#dc2626'
  },
  {
    id: 'contract-type',
    category: 'NHÂN SỰ',
    title: 'ĐỀ XUẤT LOẠI HỢP ĐỒNG KÝ',
    description: 'Đề xuất loại hợp đồng lao động cần ký với nhân sự.',
    icon: 'fa-file-circle-check',
    color: '#c8102e'
  },
  {
    id: 'plan-travel',
    category: 'NHÂN SỰ',
    title: 'ĐỀ XUẤT KẾ HOẠCH & CÔNG TÁC PHÍ',
    description: 'Trình kế hoạch công tác và đề xuất công tác phí liên quan.',
    icon: 'fa-file-circle-check',
    color: '#e11d48'
  },
  {
    id: 'discipline',
    category: 'NHÂN SỰ',
    title: 'ĐỀ XUẤT XỬ LÝ VI PHẠM KỶ LUẬT',
    description: 'Đề xuất hình thức xử lý vi phạm kỷ luật lao động.',
    icon: 'fa-file-circle-check',
    color: '#9b0c24'
  },
  {
    id: 'late-early',
    category: 'VẮNG MẶT',
    title: 'Đi muộn/về sớm',
    description: 'Xin phép đi muộn hoặc về sớm trong ngày làm việc.',
    icon: 'fa-file-lines',
    color: '#b71c1c'
  },
  {
    id: 'leave',
    category: 'VẮNG MẶT',
    title: 'Đơn xin nghỉ phép',
    description: 'Gửi đơn xin nghỉ phép theo quy định của công ty.',
    icon: 'fa-file-circle-check',
    color: '#dc2626'
  },
  {
    id: 'proposal',
    category: 'CHUNG',
    title: 'ĐỀ XUẤT',
    description: 'Sử dụng khi cần trình đề xuất, xin ý kiến hoặc phê duyệt nội dung công việc.',
    icon: 'fa-file-signature',
    color: '#c8102e'
  }
]

const TEMPLATE_CATEGORIES = ['HÀNH CHÍNH', 'NHÂN SỰ', 'VẮNG MẶT', 'CHUNG']

function genCode() {
  return String(Date.now())
}

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${hh}:${mm} ${dd}/${mo}/${d.getFullYear()}`
}

function formatDateShort(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mo}/${d.getFullYear()}`
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1]?.[0]?.toUpperCase() || '?'
}

function statusBadge(status) {
  if (status === 'approved') return { cls: 'apv-badge--approved', label: 'Đã duyệt' }
  if (status === 'rejected') return { cls: 'apv-badge--rejected', label: 'Từ chối' }
  return { cls: 'apv-badge--pending', label: 'Chờ duyệt' }
}

function stepStatus(request, idx) {
  const step = request.approvalSteps[idx]
  if (step.decision === 'approved') return 'approved'
  if (step.decision === 'rejected') return 'rejected'
  if (idx === (request.currentStepIndex || 0) && request.status === 'pending') return 'pending'
  return 'waiting'
}

function Avatar({ name, avatar, size = 26 }) {
  return (
    <div className="apv-avatar" style={{ width: size, height: size, fontSize: size * 0.28 }}>
      {avatar ? <img src={avatar} alt={name || ''} /> : initials(name)}
    </div>
  )
}

function BottomSheet({ title, onClose, children }) {
  return (
    <div className="apv-reject-modal" onClick={onClose}>
      <div className="apv-reject-modal__box" onClick={(e) => e.stopPropagation()}>
        <div className="apv-reject-modal__title">{title}</div>
        {children}
      </div>
    </div>
  )
}

function PersonPickerSheet({ title, employees, onPick, onClose }) {
  const [q, setQ] = useState('')
  const filtered = employees.filter((e) =>
    normalizeString(e.ho_va_ten || e.name || '').includes(normalizeString(q))
  )
  return (
    <BottomSheet title={title} onClose={onClose}>
      <input
        autoFocus
        placeholder="Tìm nhân sự..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{
          width: '100%',
          border: '1px solid #e3e6ea',
          borderRadius: 10,
          padding: '9px 12px',
          fontSize: '.9rem',
          outline: 'none',
          marginBottom: 10
        }}
      />
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {filtered.length === 0 && <div className="apv-picker__empty">Không tìm thấy</div>}
        {filtered.map((e) => (
          <div key={e.id} className="apv-picker__item" onClick={() => onPick(e)}>
            <Avatar name={e.ho_va_ten || e.name} avatar={e.avatarDataUrl || e.avatarUrl || e.avatar} size={28} />
            <span>{e.ho_va_ten || e.name || 'N/A'}</span>
          </div>
        ))}
      </div>
    </BottomSheet>
  )
}

function EmployeePicker({ employees, onPick, onClose }) {
  const [q, setQ] = useState('')
  const filtered = employees.filter((e) =>
    normalizeString(e.ho_va_ten || e.name || '').includes(normalizeString(q))
  )
  return (
    <>
      <div className="apv-picker__backdrop" onClick={onClose} />
      <div className="apv-picker__panel">
        <div className="apv-picker__search">
          <input autoFocus placeholder="Tìm nhân sự..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {filtered.length === 0 ? (
          <div className="apv-picker__empty">Không tìm thấy</div>
        ) : (
          filtered.map((e) => (
            <div key={e.id} className="apv-picker__item" onClick={() => onPick(e)}>
              <Avatar name={e.ho_va_ten || e.name} avatar={e.avatarDataUrl || e.avatarUrl || e.avatar} size={26} />
              <span>{e.ho_va_ten || e.name || 'N/A'}</span>
            </div>
          ))
        )}
      </div>
    </>
  )
}

function emptyStep() {
  return { approverId: '', approverName: '', approverAvatar: '' }
}

function Approvals() {
  const auth = useAuth()
  const authUser = auth?.user || null
  const [searchParams, setSearchParams] = useSearchParams()

  const view = searchParams.get('view') || 'list' // list | create | detail
  const tab = searchParams.get('tab') || 'inbox' // inbox | sent | admin | templates | stats
  const subFilter = searchParams.get('filter') || 'todo' // todo | done
  const selectedId = searchParams.get('id') || null
  const templateParam = searchParams.get('template') || ''
  const statsPeriod = searchParams.get('period') || 'month' // week | month | year
  const statsDateParam = searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const statsDetailCode = searchParams.get('statEmp') || null

  const [employees, setEmployees] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const [meLocal, setMeLocal] = useState(null)
  const [showMePicker, setShowMePicker] = useState(false)

  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [recentTemplateIds, setRecentTemplateIds] = useState([])

  const selectedTemplate = useMemo(() => {
    return REQUEST_TEMPLATES.find((t) => t.id === templateParam)
      || REQUEST_TEMPLATES.find((t) => t.id === 'proposal')
      || REQUEST_TEMPLATES[0]
  }, [templateParam])

  // Create-form state
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState([])
  const [approverSteps, setApproverSteps] = useState([emptyStep()])
  const [followers, setFollowers] = useState([])
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [pickerStepIndex, setPickerStepIndex] = useState(null) // step index, or 'followers'
  const fileInputRef = useRef(null)

  // Decision state (detail view)
  const [rejectPrompt, setRejectPrompt] = useState(false)
  const [decisionComment, setDecisionComment] = useState('')
  const [deciding, setDeciding] = useState(false)

  const navigateApv = (patch, { replace = false } = {}) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') next.delete(key)
        else next.set(key, String(value))
      })
      return next
    }, { replace })
  }

  const setTabNav = (nextTab, nextFilter = 'todo') =>
    navigateApv({
      tab: nextTab,
      view: null,
      id: null,
      template: null,
      filter: nextFilter === 'todo' ? null : nextFilter
    })

  const setSubFilterNav = (nextFilter) =>
    navigateApv({ filter: nextFilter === 'todo' ? null : nextFilter })

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ME_STORAGE_KEY)
      if (stored) setMeLocal(JSON.parse(stored))
    } catch (e) {
      console.error('Failed to read stored identity', e)
    }
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_TEMPLATES_KEY) || '[]')
      if (Array.isArray(recent)) setRecentTemplateIds(recent)
    } catch (e) {
      console.error('Failed to read recent templates', e)
    }
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      // The real staff directory lives in Supabase (`users`, same table Employees.jsx
      // reads/writes) — only the columns the picker/avatars need are selected so this
      // stays fast even as the table grows (avoids the heavy documents/images blobs
      // that a `select('*')` would drag along).
      const [usersRes, reqData] = await Promise.all([
        supabase.from('users').select('id, name, department, avatar_url, employee_id, username, email'),
        fbGet(REQUESTS_PATH)
      ])
      if (usersRes.error) throw usersRes.error

      const empList = (usersRes.data || []).map((u) => ({
        id: u.id,
        ho_va_ten: u.name || '',
        bo_phan: u.department || '',
        avatarUrl: u.avatar_url || '',
        employeeId: u.employee_id || u.username || '',
        username: u.username || '',
        email: u.email || ''
      }))
      setEmployees(empList)

      const reqList = reqData ? Object.entries(reqData).map(([k, v]) => ({ ...v, id: k })) : []
      setRequests(reqList)
    } catch (e) {
      console.error('Lỗi tải dữ liệu phê duyệt:', e)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  // Prefer a real authenticated user the moment one is available; otherwise fall back
  // to the person chosen locally via the identity picker. Enrich from staff directory
  // so name + employee code always match the logged-in account record.
  const me = useMemo(() => {
    const base = authUser
      ? {
          id: authUser.id || authUser.employeeId || authUser.employee_id || '',
          name: authUser.ho_va_ten || authUser.name || authUser.email || 'Tôi',
          avatar: authUser.avatarDataUrl || authUser.avatarUrl || authUser.avatar_url || '',
          employeeCode:
            authUser.employee_id ||
            authUser.employeeId ||
            authUser.username ||
            authUser.ma_nhan_vien ||
            ''
        }
      : meLocal

    if (!base) return null

    const authEmail = authUser?.email || ''
    const emp = employees.find(
      (e) =>
        (base.id && String(e.id) === String(base.id)) ||
        (authEmail && e.email && normalizeString(e.email) === normalizeString(authEmail)) ||
        (base.employeeCode &&
          String(e.employeeId || e.username || '') === String(base.employeeCode)) ||
        (base.name &&
          base.name !== 'Tôi' &&
          normalizeString(e.ho_va_ten || e.name || '') === normalizeString(base.name))
    )

    if (!emp) return base

    return {
      id: base.id || emp.id || '',
      name:
        base.name && base.name !== 'Tôi'
          ? base.name
          : emp.ho_va_ten || emp.name || base.name,
      avatar: base.avatar || emp.avatarUrl || emp.avatarDataUrl || emp.avatar || '',
      employeeCode: base.employeeCode || emp.employeeId || emp.username || ''
    }
  }, [authUser, meLocal, employees])

  useEffect(() => {
    if (view === 'create' && selectedTemplate?.title) {
      setSubject(selectedTemplate.title)
    }
  }, [view, selectedTemplate?.id, selectedTemplate?.title])

  const resolveEmployeeCode = (requesterId, requesterName, requesterCode) => {
    if (requesterCode) return String(requesterCode)
    const emp = employees.find((e) =>
      (requesterId && String(e.id) === String(requesterId)) ||
      (requesterName && normalizeString(e.ho_va_ten || e.name || '') === normalizeString(requesterName))
    )
    return emp?.employeeId || emp?.username || requesterId || 'N/A'
  }

  const getWeekRange = (dateInput) => {
    const d = new Date(`${dateInput}T00:00:00`)
    if (isNaN(d.getTime())) return null
    const day = d.getDay() || 7 // Monday-start
    const start = new Date(d)
    start.setDate(d.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  const getPeriodRange = (period, dateInput) => {
    const base = new Date(`${dateInput}T00:00:00`)
    if (isNaN(base.getTime())) {
      const now = new Date()
      return getPeriodRange(period, now.toISOString().slice(0, 10))
    }
    if (period === 'week') return getWeekRange(dateInput)
    if (period === 'year') {
      const start = new Date(base.getFullYear(), 0, 1)
      const end = new Date(base.getFullYear(), 11, 31, 23, 59, 59, 999)
      return { start, end }
    }
    // month
    const start = new Date(base.getFullYear(), base.getMonth(), 1)
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }

  const formatPeriodLabel = (period, dateInput) => {
    const range = getPeriodRange(period, dateInput)
    if (!range) return ''
    const { start, end } = range
    if (period === 'week') {
      return `Tuần ${formatDateShort(start.toISOString())} – ${formatDateShort(end.toISOString())}`
    }
    if (period === 'year') return `Năm ${start.getFullYear()}`
    const mo = String(start.getMonth() + 1).padStart(2, '0')
    return `Tháng ${mo}/${start.getFullYear()}`
  }

  const statsByEmployee = useMemo(() => {
    const range = getPeriodRange(statsPeriod, statsDateParam)
    if (!range) return []
    const { start, end } = range
    const map = new Map()

    requests.forEach((r) => {
      const created = new Date(r.createdAt || 0)
      if (isNaN(created.getTime()) || created < start || created > end) return

      const code = resolveEmployeeCode(r.requesterId, r.requesterName, r.requesterCode)
      const key = String(code)
      if (!map.has(key)) {
        map.set(key, {
          employeeCode: key,
          employeeName: r.requesterName || '—',
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          byTemplate: {}
        })
      }
      const row = map.get(key)
      if (r.requesterName) row.employeeName = r.requesterName
      row.total += 1
      if (r.status === 'approved') row.approved += 1
      else if (r.status === 'rejected') row.rejected += 1
      else row.pending += 1
      const tpl = r.templateType || 'ĐỀ XUẤT'
      row.byTemplate[tpl] = (row.byTemplate[tpl] || 0) + 1
    })

    return [...map.values()].sort((a, b) => b.total - a.total || String(a.employeeCode).localeCompare(String(b.employeeCode)))
  }, [requests, employees, statsPeriod, statsDateParam])

  const statsSummary = useMemo(() => {
    return statsByEmployee.reduce(
      (acc, row) => {
        acc.employees += 1
        acc.total += row.total
        acc.pending += row.pending
        acc.approved += row.approved
        acc.rejected += row.rejected
        return acc
      },
      { employees: 0, total: 0, pending: 0, approved: 0, rejected: 0 }
    )
  }, [statsByEmployee])

  const filteredStats = useMemo(() => {
    const q = normalizeString(search)
    if (!q) return statsByEmployee
    return statsByEmployee.filter((row) =>
      normalizeString(`${row.employeeCode} ${row.employeeName}`).includes(q)
    )
  }, [statsByEmployee, search])

  const statsDetailEmployee = useMemo(
    () => statsByEmployee.find((row) => row.employeeCode === statsDetailCode) || null,
    [statsByEmployee, statsDetailCode]
  )

  const statsDetailRows = useMemo(() => {
    if (!statsDetailCode) return []
    const range = getPeriodRange(statsPeriod, statsDateParam)
    if (!range) return []
    const { start, end } = range
    return requests
      .filter((r) => {
        const created = new Date(r.createdAt || 0)
        if (isNaN(created.getTime()) || created < start || created > end) return false
        return String(resolveEmployeeCode(r.requesterId, r.requesterName, r.requesterCode)) === statsDetailCode
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [requests, statsDetailCode, statsPeriod, statsDateParam])

  const isMe = (personId, personName) => {
    if (!me) return false
    if (me.id && personId && String(me.id) === String(personId)) return true
    if (me.name && personName) return normalizeString(me.name) === normalizeString(personName)
    return false
  }

  const myCreateStats = useMemo(() => {
    const emptyBucket = () => ({ total: 0, byTemplate: {} })
    const result = {
      week: emptyBucket(),
      month: emptyBucket(),
      year: emptyBucket()
    }
    if (!me) return result

    const today = new Date().toISOString().slice(0, 10)
    const ranges = {
      week: getPeriodRange('week', today),
      month: getPeriodRange('month', today),
      year: getPeriodRange('year', today)
    }

    const mine = requests.filter((r) =>
      isMe(r.requesterId, r.requesterName) ||
      (me.employeeCode && String(r.requesterCode || '') === String(me.employeeCode))
    )

    mine.forEach((r) => {
      const created = new Date(r.createdAt || 0)
      if (isNaN(created.getTime())) return
      const tpl = r.templateType || 'ĐỀ XUẤT'
      ;(['week', 'month', 'year']).forEach((key) => {
        const range = ranges[key]
        if (!range || created < range.start || created > range.end) return
        result[key].total += 1
        result[key].byTemplate[tpl] = (result[key].byTemplate[tpl] || 0) + 1
      })
    })

    return result
  }, [requests, me, employees])

  const myApproveStats = useMemo(() => {
    const emptyBucket = () => ({ total: 0, byTemplate: {} })
    const result = {
      week: emptyBucket(),
      month: emptyBucket(),
      year: emptyBucket()
    }
    if (!me) return result

    const today = new Date().toISOString().slice(0, 10)
    const ranges = {
      week: getPeriodRange('week', today),
      month: getPeriodRange('month', today),
      year: getPeriodRange('year', today)
    }

    requests.forEach((r) => {
      const myStep = (r.approvalSteps || []).find(
        (s) => isMe(s.approverId, s.approverName) && s.decision === 'approved'
      )
      if (!myStep || !myStep.decidedAt) return
      const decided = new Date(myStep.decidedAt)
      if (isNaN(decided.getTime())) return
      const tpl = r.templateType || 'ĐỀ XUẤT'
      ;(['week', 'month', 'year']).forEach((key) => {
        const range = ranges[key]
        if (!range || decided < range.start || decided > range.end) return
        result[key].total += 1
        result[key].byTemplate[tpl] = (result[key].byTemplate[tpl] || 0) + 1
      })
    })

    return result
  }, [requests, me])

  const isMyTurn = (r) => {
    const step = (r.approvalSteps || [])[r.currentStepIndex || 0]
    return r.status === 'pending' && !!step && !step.decision && isMe(step.approverId, step.approverName)
  }

  // The step assigned to the current user, if any — used to tell "I already
  // decided this" apart from "not my turn yet" (e.g. still waiting on an earlier approver).
  const myDecidedStep = (r) =>
    (r.approvalSteps || []).find((s) => isMe(s.approverId, s.approverName) && !!s.decision)

  const inboxRequests = useMemo(
    () => requests.filter((r) => (r.approvalSteps || []).some((s) => isMe(s.approverId, s.approverName))),
    [requests, me]
  )
  const sentRequests = useMemo(
    () => requests.filter((r) => isMe(r.requesterId, r.requesterName)),
    [requests, me]
  )

  const baseList = tab === 'inbox' ? inboxRequests : tab === 'sent' ? sentRequests : requests
  const todoList = baseList.filter((r) => (tab === 'inbox' ? isMyTurn(r) : r.status === 'pending'))
  const doneList = baseList.filter((r) => {
    if (todoList.includes(r)) return false
    // "Hoàn thành" in Gửi đến only counts requests this account has personally
    // approved/rejected — not ones still waiting on someone earlier in the chain.
    if (tab === 'inbox') return !!myDecidedStep(r)
    return true
  })

  const activeList = (subFilter === 'todo' ? todoList : doneList)
    .filter((r) => {
      if (!search.trim()) return true
      const q = normalizeString(search)
      return (
        normalizeString(r.subject || '').includes(q) ||
        normalizeString(r.content || '').includes(q) ||
        String(r.code || '').includes(search.trim())
      )
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const selectedRequest = requests.find((r) => r.id === selectedId) || null

  // ---- Create form helpers ----
  const resetForm = (defaultSubject = '') => {
    setSubject(defaultSubject)
    setContent('')
    setAttachments([])
    setApproverSteps([emptyStep()])
    setFollowers([])
    setErrors({})
    setPickerStepIndex(null)
  }

  const rememberTemplate = (templateId) => {
    setRecentTemplateIds((prev) => {
      const next = [templateId, ...prev.filter((id) => id !== templateId)].slice(0, 5)
      try {
        localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(next))
      } catch (e) {
        console.error('Failed to store recent templates', e)
      }
      return next
    })
  }

  const openCreate = (template) => {
    if (!me) {
      setShowMePicker(true)
      return
    }
    const tpl = template || selectedTemplate || REQUEST_TEMPLATES.find((t) => t.id === 'proposal') || REQUEST_TEMPLATES[0]
    resetForm(tpl.title || '')
    rememberTemplate(tpl.id)
    navigateApv({ view: 'create', template: tpl.id, id: null })
  }

  const openDetail = (id) => {
    navigateApv({ view: 'detail', id, template: null })
  }

  const openStatsDetail = (employeeCode) => navigateApv({ statEmp: employeeCode })
  const closeStatsDetail = () => navigateApv({ statEmp: null })

  const goBackToList = () => {
    navigateApv({ view: null, id: null, template: null })
    setRejectPrompt(false)
    setDecisionComment('')
  }

  const filteredTemplates = useMemo(() => {
    const q = normalizeString(search)
    if (!q) return REQUEST_TEMPLATES
    return REQUEST_TEMPLATES.filter((t) =>
      normalizeString(`${t.title} ${t.category} ${t.description}`).includes(q)
    )
  }, [search])

  const recentTemplates = useMemo(
    () => recentTemplateIds
      .map((id) => REQUEST_TEMPLATES.find((t) => t.id === id))
      .filter(Boolean),
    [recentTemplateIds]
  )

  const updateStep = (idx, patch) =>
    setApproverSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  const addStep = () => setApproverSteps((prev) => [...prev, emptyStep()])
  const removeStep = (idx) => setApproverSteps((prev) => prev.filter((_, i) => i !== idx))

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || [])
    // Only file names are kept for display — there is no file-storage backend wired
    // up for this module yet, so the actual bytes are not persisted.
    setAttachments((prev) => [...prev, ...files.map((f) => ({ name: f.name }))])
    e.target.value = ''
  }

  const validateForm = () => {
    const errs = {}
    if (!subject.trim()) errs.subject = 'Vui lòng chọn về việc'
    if (!content.trim()) errs.content = 'Vui lòng nhập nội dung'
    if (!approverSteps.some((s) => s.approverId)) {
      errs.approvers = 'Vui lòng chọn ít nhất 1 người phê duyệt'
    } else if (approverSteps.some((s) => !s.approverId)) {
      errs.approvers = 'Vui lòng chọn đầy đủ người phê duyệt hoặc xóa bước còn trống'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmitRequest = async () => {
    if (!me) {
      setShowMePicker(true)
      return
    }
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const now = new Date().toISOString()
      const payload = {
        code: genCode(),
        templateType: selectedTemplate?.title || 'ĐỀ XUẤT',
        templateId: selectedTemplate?.id || 'proposal',
        subject: subject.trim(),
        content: content.trim(),
        attachments,
        requesterId: me.id || '',
        requesterCode: me.employeeCode || resolveEmployeeCode(me.id, me.name, '') || '',
        requesterName: me.name,
        requesterAvatar: me.avatar || '',
        followers,
        status: 'pending',
        currentStepIndex: 0,
        approvalSteps: approverSteps
          .filter((s) => s.approverId)
          .map((s) => ({ ...s, decision: null, decidedAt: null, comment: '' })),
        createdAt: now
      }
      await fbPush(REQUESTS_PATH, payload)
      showToast('Đã nộp yêu cầu')
      resetForm()
      navigateApv({ tab: 'sent', filter: null, view: null, id: null, template: null })
      await loadData()
    } catch (e) {
      console.error(e)
      showToast('Có lỗi khi nộp yêu cầu')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Decision helpers (detail view) ----
  const handleDecision = async (decision, comment = '', requestOverride = null) => {
    const target = requestOverride || selectedRequest
    if (!target) return
    setDeciding(true)
    try {
      const idx = target.currentStepIndex || 0
      const decidedAt = new Date().toISOString()
      const steps = (target.approvalSteps || []).map((s, i) =>
        i === idx
          ? {
              ...s,
              decision,
              decidedAt,
              comment,
              decidedById: me?.id || s.approverId || '',
              decidedByName: me?.name || s.approverName || '',
              decidedByAvatar: me?.avatar || s.approverAvatar || ''
            }
          : s
      )
      let status = target.status
      let currentStepIndex = target.currentStepIndex || 0
      if (decision === 'rejected') {
        status = 'rejected'
      } else if (idx === steps.length - 1) {
        status = 'approved'
      } else {
        currentStepIndex = idx + 1
      }
      await fbUpdate(`${REQUESTS_PATH}/${target.id}`, {
        approvalSteps: steps,
        status,
        currentStepIndex
      })
      showToast(decision === 'approved' ? 'Đã đồng ý' : 'Đã từ chối')
      setRejectPrompt(false)
      setDecisionComment('')
      await loadData()
    } catch (e) {
      console.error(e)
      showToast('Có lỗi xảy ra')
    } finally {
      setDeciding(false)
    }
  }

  const pickMe = (emp) => {
    const person = {
      id: emp.id,
      name: emp.ho_va_ten || emp.name || 'N/A',
      avatar: emp.avatarDataUrl || emp.avatarUrl || emp.avatar || '',
      employeeCode: emp.employeeId || emp.username || ''
    }
    setMeLocal(person)
    try {
      localStorage.setItem(ME_STORAGE_KEY, JSON.stringify(person))
    } catch (e) {
      console.error('Failed to store identity', e)
    }
    setShowMePicker(false)
  }

  return (
    <div className="apv-page">
      <div className="apv" data-view={view} data-tab={tab}>
        {loading ? (
          <div className="loadingState">Đang tải dữ liệu...</div>
        ) : view === 'create' ? (
          <>
            <div className="apv-topbar">
              <button className="apv-topbar__back" onClick={goBackToList}>
                <i className="fas fa-arrow-left"></i>
              </button>
              <div className="apv-topbar__title">Tạo yêu cầu</div>
            </div>

            <div className="apv-body">
              <div className="apv-card-block">
                <div className="apv-template-info">
                  <div className="apv-template-info__icon" style={{ background: selectedTemplate?.color || '#c8102e' }}>
                    <i className={`fas ${selectedTemplate?.icon || 'fa-file-signature'}`}></i>
                  </div>
                  <div>
                    <div className="apv-template-info__title">{selectedTemplate?.title || 'ĐỀ XUẤT'}</div>
                    <div className="apv-template-info__desc">
                      {selectedTemplate?.description ||
                        'Sử dụng khi bạn cần trình đề xuất, xin ý kiến hoặc phê duyệt một nội dung công việc.'}
                    </div>
                  </div>
                </div>

                <div className="apv-my-stats">
                  <div className="apv-my-stats__head">
                    <strong>Lịch sử đề xuất của bạn</strong>
                    <span>
                      {me?.name || 'Nhân viên hiện tại'}
                      {me?.employeeCode ? ` · Mã NV: ${me.employeeCode}` : ''}
                    </span>
                  </div>
                  <div className="apv-my-stats__periods">
                    {[
                      ['week', 'Tuần này', myCreateStats.week],
                      ['month', 'Tháng này', myCreateStats.month],
                      ['year', 'Năm nay', myCreateStats.year]
                    ].map(([key, label, bucket]) => {
                      const currentType = selectedTemplate?.title || 'ĐỀ XUẤT'
                      const currentCount = bucket.byTemplate[currentType] || 0
                      const otherTypes = Object.entries(bucket.byTemplate)
                      return (
                        <div key={key} className="apv-my-stats__period-card">
                          <div className="apv-my-stats__period-top">
                            <span>{label}</span>
                            <strong>{bucket.total}</strong>
                          </div>
                          <div className="apv-my-stats__current">
                            Mẫu đang chọn: <b>{currentCount}</b> lần
                          </div>
                          <div className="apv-my-stats__types">
                            {otherTypes.length === 0 ? (
                              <span className="apv-my-stats__empty">Chưa có đề xuất</span>
                            ) : (
                              otherTypes
                                .sort((a, b) => b[1] - a[1])
                                .map(([name, count]) => (
                                  <span
                                    key={name}
                                    className={name === currentType ? 'is-active' : ''}
                                  >
                                    {name}: <b>{count}</b>
                                  </span>
                                ))
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="apv-card-block">
                <div className="apv-field-row">
                  <div className="apv-field">
                    <label>Họ và tên</label>
                    <input
                      type="text"
                      className="apv-input--readonly"
                      value={me?.name || ''}
                      readOnly
                      disabled
                      placeholder="Theo tài khoản đăng nhập"
                    />
                  </div>
                  <div className="apv-field">
                    <label>Mã nhân sự</label>
                    <input
                      type="text"
                      className="apv-input--readonly"
                      value={me?.employeeCode || ''}
                      readOnly
                      disabled
                      placeholder="Theo tài khoản đăng nhập"
                    />
                  </div>
                </div>

                <div className="apv-field">
                  <label>
                    Về việc<span className="req">*</span>
                  </label>
                  <select
                    className="apv-select"
                    value={selectedTemplate?.id || ''}
                    onChange={(e) => {
                      const tpl = REQUEST_TEMPLATES.find((t) => t.id === e.target.value)
                      if (!tpl) return
                      setSubject(tpl.title)
                      rememberTemplate(tpl.id)
                      navigateApv({ template: tpl.id })
                      if (errors.subject) setErrors((prev) => ({ ...prev, subject: undefined }))
                    }}
                  >
                    <option value="" disabled>
                      Chọn mẫu yêu cầu
                    </option>
                    {TEMPLATE_CATEGORIES.map((category) => {
                      const items = REQUEST_TEMPLATES.filter((t) => t.category === category)
                      if (!items.length) return null
                      return (
                        <optgroup key={category} label={category}>
                          {items.map((tpl) => (
                            <option key={tpl.id} value={tpl.id}>
                              {tpl.title}
                            </option>
                          ))}
                        </optgroup>
                      )
                    })}
                  </select>
                  {errors.subject && <div className="apv-field-error">{errors.subject}</div>}
                </div>

                <div className="apv-field">
                  <label>
                    Nội dung<span className="req">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={'Kính gửi Ban Lãnh đạo Công ty,\n\nNội dung đề xuất...'}
                  />
                  {errors.content && <div className="apv-field-error">{errors.content}</div>}
                </div>

                <div className="apv-field">
                  <label>Đính kèm</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFilesSelected}
                  />
                  <button type="button" className="apv-attach-btn" onClick={() => fileInputRef.current?.click()}>
                    <i className="fas fa-paperclip"></i> Thêm tập tin
                  </button>
                  {attachments.length > 0 && (
                    <div className="apv-attach-list">
                      {attachments.map((a, i) => (
                        <div key={i} className="apv-attach-chip">
                          <i className="fas fa-paperclip"></i>
                          <span>{a.name}</span>
                          <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}>
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="apv-card-block">
                <div className="apv-card-block__title">Người theo dõi</div>
                {followers.length > 0 && (
                  <div className="apv-attach-list" style={{ marginBottom: 8 }}>
                    {followers.map((f, i) => (
                      <div key={f.id} className="apv-attach-chip">
                        <Avatar name={f.name} avatar={f.avatar} size={22} />
                        <span>{f.name}</span>
                        <button onClick={() => setFollowers((prev) => prev.filter((_, j) => j !== i))}>
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="apv-picker">
                  <button type="button" className="apv-attach-btn" onClick={() => setPickerStepIndex('followers')}>
                    <i className="fas fa-bell"></i> Thêm người theo dõi
                  </button>
                  {pickerStepIndex === 'followers' && (
                    <EmployeePicker
                      employees={employees.filter((e) => !followers.some((f) => f.id === e.id))}
                      onPick={(emp) => {
                        setFollowers((prev) => [
                          ...prev,
                          {
                            id: emp.id,
                            name: emp.ho_va_ten || emp.name || 'N/A',
                            avatar: emp.avatarDataUrl || emp.avatarUrl || emp.avatar || ''
                          }
                        ])
                        setPickerStepIndex(null)
                      }}
                      onClose={() => setPickerStepIndex(null)}
                    />
                  )}
                </div>
              </div>

              <div className="apv-card-block">
                <div className="apv-card-block__title">Luồng phê duyệt</div>
                <div className="apv-timeline">
                  <div className="apv-tl-step">
                    <div className="apv-tl-step__rail">
                      <div className="apv-tl-step__dot apv-tl-step__dot--muted">
                        <i className="fas fa-circle" style={{ fontSize: 6 }}></i>
                      </div>
                      <div className="apv-tl-step__line apv-tl-step__line--done"></div>
                    </div>
                    <div className="apv-tl-step__body" style={{ paddingBottom: 14 }}>
                      <div className="apv-tl-step__title" style={{ fontWeight: 400, color: '#98a2b3', fontSize: '.82rem' }}>
                        Bắt đầu
                      </div>
                    </div>
                  </div>

                  <div className="apv-tl-step">
                    <div className="apv-tl-step__rail">
                      <div className="apv-tl-step__dot apv-tl-step__dot--submit">
                        <i className="fas fa-user"></i>
                      </div>
                      <div className="apv-tl-step__line apv-tl-step__line--done"></div>
                    </div>
                    <div className="apv-tl-step__body">
                      <div className="apv-tl-step__title">Nộp yêu cầu</div>
                      <div className="apv-tl-approver">
                        <Avatar name={me?.name} avatar={me?.avatar} size={26} />
                        <span className="apv-tl-approver__name">{me?.name || 'Bạn'}</span>
                      </div>
                    </div>
                  </div>

                  {approverSteps.map((step, idx) => (
                    <div className="apv-tl-step" key={idx}>
                      <div className="apv-tl-step__rail">
                        <div className="apv-tl-step__dot apv-tl-step__dot--waiting">
                          <i className="fas fa-stamp"></i>
                        </div>
                        <div className="apv-tl-step__line"></div>
                      </div>
                      <div className="apv-tl-step__body">
                        <div className="apv-tl-step__title">
                          Phê duyệt
                          {approverSteps.length > 1 && (
                            <button
                              className="apv-tl-remove-approver"
                              title="Xóa bước phê duyệt"
                              onClick={() => removeStep(idx)}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </div>
                        <div className="apv-picker">
                          {step.approverId ? (
                            <div className="apv-tl-approver">
                              <Avatar name={step.approverName} avatar={step.approverAvatar} size={26} />
                              <span className="apv-tl-approver__name">{step.approverName}</span>
                              <button
                                className="apv-tl-remove-approver"
                                onClick={() => updateStep(idx, emptyStep())}
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            </div>
                          ) : (
                            <div className="apv-tl-add-approver" onClick={() => setPickerStepIndex(idx)}>
                              <i className="fas fa-user-plus"></i> Chọn người phê duyệt
                            </div>
                          )}
                          {pickerStepIndex === idx && (
                            <EmployeePicker
                              employees={employees}
                              onPick={(emp) => {
                                updateStep(idx, {
                                  approverId: emp.id,
                                  approverName: emp.ho_va_ten || emp.name || 'N/A',
                                  approverAvatar: emp.avatarDataUrl || emp.avatarUrl || emp.avatar || ''
                                })
                                setPickerStepIndex(null)
                              }}
                              onClose={() => setPickerStepIndex(null)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {approverSteps.length < MAX_APPROVAL_STEPS && (
                    <button type="button" className="apv-tl-add-step" onClick={addStep}>
                      <i className="fas fa-plus"></i> Thêm bước phê duyệt
                    </button>
                  )}

                  <div className="apv-tl-step" style={{ marginTop: 10 }}>
                    <div className="apv-tl-step__rail">
                      <div className="apv-tl-step__dot apv-tl-step__dot--muted">
                        <i className="fas fa-circle" style={{ fontSize: 6 }}></i>
                      </div>
                    </div>
                    <div className="apv-tl-step__body">
                      <div className="apv-tl-step__title" style={{ fontWeight: 400, color: '#98a2b3', fontSize: '.82rem' }}>
                        Kết thúc
                      </div>
                    </div>
                  </div>
                </div>
                {errors.approvers && <div className="apv-field-error">{errors.approvers}</div>}
              </div>
            </div>

            <div className="apv-actionbar">
              <button className="apv-btn apv-btn--primary" disabled={submitting} onClick={handleSubmitRequest}>
                {submitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Đang nộp...
                  </>
                ) : (
                  'Nộp yêu cầu'
                )}
              </button>
            </div>
          </>
        ) : view === 'detail' && selectedRequest ? (
          <>
            <div className="apv-topbar">
              <button className="apv-topbar__back" onClick={goBackToList}>
                <i className="fas fa-arrow-left"></i>
              </button>
              <div className="apv-topbar__title">Xem yêu cầu</div>
            </div>

            <div className="apv-body">
              <div className="apv-card-block">
                <div className="apv-detail-head">
                  <div className="apv-template-info">
                    <div className="apv-template-info__icon">
                      <i className="fas fa-file-signature"></i>
                    </div>
                    <div>
                      <div className="apv-template-info__title">{selectedRequest.templateType || 'ĐỀ XUẤT'}</div>
                      <div className="apv-detail-head__meta">Số: {selectedRequest.code}</div>
                    </div>
                  </div>
                  <span className={`apv-badge ${statusBadge(selectedRequest.status).cls}`}>
                    {statusBadge(selectedRequest.status).label}
                  </span>
                </div>
                <div className="apv-detail-submitter">
                  <Avatar name={selectedRequest.requesterName} avatar={selectedRequest.requesterAvatar} size={34} />
                  <div>
                    <div className="apv-detail-submitter__name">{selectedRequest.requesterName}</div>
                    <div className="apv-detail-submitter__date">{formatDateTime(selectedRequest.createdAt)}</div>
                  </div>
                </div>
              </div>

              <div className="apv-card-block">
                <div className="apv-field">
                  <label>Về việc</label>
                  <div className="apv-detail-text">{selectedRequest.subject}</div>
                </div>
                <div className="apv-field">
                  <label>Nội dung</label>
                  <div className="apv-detail-text">{selectedRequest.content}</div>
                </div>
                <div className="apv-field">
                  <label>Đính kèm</label>
                  {(selectedRequest.attachments || []).length > 0 ? (
                    <div className="apv-attach-list">
                      {selectedRequest.attachments.map((a, i) => (
                        <div key={i} className="apv-attach-chip">
                          <i className="fas fa-paperclip"></i>
                          <span>{a.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="apv-detail-text" style={{ color: '#98a2b3' }}>
                      Không có tập tin
                    </div>
                  )}
                </div>
              </div>

              <div className="apv-card-block">
                <div className="apv-card-block__title">Luồng phê duyệt</div>
                <div className="apv-timeline">
                  <div className="apv-tl-step">
                    <div className="apv-tl-step__rail">
                      <div className="apv-tl-step__dot apv-tl-step__dot--muted">
                        <i className="fas fa-circle" style={{ fontSize: 6 }}></i>
                      </div>
                      <div className="apv-tl-step__line apv-tl-step__line--done"></div>
                    </div>
                    <div className="apv-tl-step__body" style={{ paddingBottom: 14 }}>
                      <div className="apv-tl-step__title" style={{ fontWeight: 400, color: '#98a2b3', fontSize: '.82rem' }}>
                        Bắt đầu
                      </div>
                    </div>
                  </div>

                  <div className="apv-tl-step">
                    <div className="apv-tl-step__rail">
                      <div className="apv-tl-step__dot apv-tl-step__dot--submit">
                        <i className="fas fa-check"></i>
                      </div>
                      <div className="apv-tl-step__line apv-tl-step__line--done"></div>
                    </div>
                    <div className="apv-tl-step__body">
                      <div className="apv-tl-step__title">Nộp yêu cầu</div>
                      <div className="apv-tl-approver">
                        <Avatar name={selectedRequest.requesterName} avatar={selectedRequest.requesterAvatar} size={26} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="apv-tl-approver__name">{selectedRequest.requesterName}</div>
                          <div className="apv-tl-approver__meta">Đã nộp • {formatDateTime(selectedRequest.createdAt)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedRequest.approvalSteps.map((step, idx) => {
                    const st = stepStatus(selectedRequest, idx)
                    const dotIcon =
                      st === 'approved' ? 'fa-check' : st === 'rejected' ? 'fa-times' : st === 'pending' ? 'fa-ellipsis-h' : 'fa-stamp'
                    return (
                      <div className="apv-tl-step" key={idx}>
                        <div className="apv-tl-step__rail">
                          <div className={`apv-tl-step__dot apv-tl-step__dot--${st}`}>
                            <i className={`fas ${dotIcon}`}></i>
                          </div>
                          <div className={`apv-tl-step__line ${st === 'approved' ? 'apv-tl-step__line--done' : ''}`}></div>
                        </div>
                        <div className="apv-tl-step__body">
                          <div className="apv-tl-step__title">
                            Phê duyệt
                            <span className={`apv-tl-step__status apv-tl-step__status--${st}`}>
                              {st === 'approved'
                                ? 'Đồng ý'
                                : st === 'rejected'
                                  ? 'Từ chối'
                                  : st === 'pending'
                                    ? 'Đang thực hiện'
                                    : 'Chờ đến lượt'}
                            </span>
                          </div>
                          <div className="apv-tl-approver">
                            <Avatar
                              name={step.decidedByName || step.approverName}
                              avatar={step.decidedByAvatar || step.approverAvatar}
                              size={26}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="apv-tl-approver__name">
                                {step.decidedByName || step.approverName}
                              </div>
                              {step.decidedAt ? (
                                <div className="apv-tl-approver__meta apv-tl-approver__meta--decision">
                                  {st === 'approved' ? 'Đã duyệt' : st === 'rejected' ? 'Đã từ chối' : 'Đã xử lý'}
                                  {' bởi '}
                                  <b>{step.decidedByName || step.approverName}</b>
                                  {' • '}
                                  {formatDateTime(step.decidedAt)}
                                </div>
                              ) : (
                                <div className="apv-tl-approver__meta">Người được chỉ định duyệt</div>
                              )}
                              {step.comment && <div className="apv-tl-approver__meta">"{step.comment}"</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  <div className="apv-tl-step">
                    <div className="apv-tl-step__rail">
                      <div
                        className={`apv-tl-step__dot ${selectedRequest.status === 'approved' ? 'apv-tl-step__dot--approved' : 'apv-tl-step__dot--muted'
                          }`}
                      >
                        <i className="fas fa-circle" style={{ fontSize: 6 }}></i>
                      </div>
                    </div>
                    <div className="apv-tl-step__body">
                      <div className="apv-tl-step__title" style={{ fontWeight: 400, color: '#98a2b3', fontSize: '.82rem' }}>
                        Kết thúc
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedRequest.followers?.length > 0 && (
                <div className="apv-card-block">
                  <div className="apv-card-block__title">Người theo dõi</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedRequest.followers.map((f) => (
                      <div key={f.id} className="apv-attach-chip" style={{ padding: '5px 10px' }}>
                        <Avatar name={f.name} avatar={f.avatar} size={20} />
                        <span>{f.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(selectedRequest.approvalSteps || []).some((s) => isMe(s.approverId, s.approverName)) && (
                <div className="apv-card-block">
                  <div className="apv-my-stats">
                    <div className="apv-my-stats__head">
                      <strong>Số lần duyệt của bạn</strong>
                      <span>
                        {me?.name || 'Nhân viên hiện tại'}
                        {me?.employeeCode ? ` · Mã NV: ${me.employeeCode}` : ''}
                      </span>
                    </div>
                    <div className="apv-my-stats__periods">
                      {[
                        ['week', 'Tuần này', myApproveStats.week],
                        ['month', 'Tháng này', myApproveStats.month],
                        ['year', 'Năm nay', myApproveStats.year]
                      ].map(([key, label, bucket]) => {
                        const currentType = selectedRequest.templateType || 'ĐỀ XUẤT'
                        const currentCount = bucket.byTemplate[currentType] || 0
                        const otherTypes = Object.entries(bucket.byTemplate)
                        return (
                          <div key={key} className="apv-my-stats__period-card">
                            <div className="apv-my-stats__period-top">
                              <span>{label}</span>
                              <strong>{bucket.total}</strong>
                            </div>
                            <div className="apv-my-stats__current">
                              Mẫu này: <b>{currentCount}</b> lần
                            </div>
                            <div className="apv-my-stats__types">
                              {otherTypes.length === 0 ? (
                                <span className="apv-my-stats__empty">Chưa duyệt lần nào</span>
                              ) : (
                                otherTypes
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([name, count]) => (
                                    <span key={name} className={name === currentType ? 'is-active' : ''}>
                                      {name}: <b>{count}</b>
                                    </span>
                                  ))
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedRequest.status === 'pending' && (isMyTurn(selectedRequest) || tab === 'admin') && (
              <div className="apv-actionbar" style={{ flexWrap: 'wrap' }}>
                {!isMyTurn(selectedRequest) && (
                  <div className="apv-actionbar__notice">
                    <i className="fas fa-user-shield"></i> Bạn đang duyệt thay{' '}
                    <b>{(selectedRequest.approvalSteps || [])[selectedRequest.currentStepIndex || 0]?.approverName || 'người được chỉ định'}</b>
                  </div>
                )}
                <button className="apv-btn apv-btn--reject" disabled={deciding} onClick={() => setRejectPrompt(true)}>
                  <i className="fas fa-times"></i> Từ chối
                </button>
                <button className="apv-btn apv-btn--approve" disabled={deciding} onClick={() => handleDecision('approved')}>
                  <i className="fas fa-check"></i> Đồng ý
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="apv-topbar">
              <div className="apv-topbar__icon">
                <i className="fas fa-stamp"></i>
              </div>
              <div className="apv-topbar__title">
                {tab === 'templates' ? 'Mẫu yêu cầu' : tab === 'stats' ? 'Thống kê đề xuất' : 'Phê duyệt'}
                <small>
                  {tab === 'templates'
                    ? 'Chọn mẫu để tạo yêu cầu mới'
                    : tab === 'stats'
                      ? 'Theo mã nhân viên · Tuần / Tháng / Năm'
                      : 'Đề xuất & yêu cầu công việc'}
                </small>
              </div>
              {authUser ? (
                <div className="apv-topbar__icon" title={me?.name}>
                  <Avatar name={me?.name} avatar={me?.avatar} size={30} />
                </div>
              ) : (
                <button className="apv-topbar__icon" title={me ? `Bạn: ${me.name}` : 'Chọn bạn là ai'} onClick={() => setShowMePicker(true)}>
                  {me ? <Avatar name={me.name} avatar={me.avatar} size={30} /> : <i className="fas fa-user"></i>}
                </button>
              )}
            </div>

            <div className="apv-search">
              <i className="fas fa-search"></i>
              <input
                placeholder={tab === 'stats' ? 'Tìm theo mã NV, họ tên...' : 'Tìm kiếm'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="apv-tabs">
              <button
                className={tab === 'inbox' ? 'active' : ''}
                onClick={() => setTabNav('inbox')}
              >
                Gửi đến
              </button>
              <button
                className={tab === 'sent' ? 'active' : ''}
                onClick={() => setTabNav('sent')}
              >
                Gửi đi
              </button>
              <button
                className={tab === 'admin' ? 'active' : ''}
                onClick={() => setTabNav('admin')}
              >
                Quản trị
              </button>
              <button
                className={tab === 'templates' ? 'active' : ''}
                onClick={() => setTabNav('templates')}
              >
                Mẫu yêu cầu
              </button>
              <button
                className={tab === 'stats' ? 'active' : ''}
                onClick={() => setTabNav('stats')}
              >
                Thống kê
              </button>
            </div>

            {tab === 'templates' ? (
              <div className="apv-templates">
                {recentTemplates.length > 0 && !normalizeString(search) && (
                  <section className="apv-template-group">
                    <h4>Chỉnh sửa gần nhất</h4>
                    <div className="apv-template-list">
                      {recentTemplates.map((tpl) => (
                        <button
                          key={`recent-${tpl.id}`}
                          type="button"
                          className="apv-template-item"
                          onClick={() => openCreate(tpl)}
                        >
                          <span className="apv-template-item__icon" style={{ background: tpl.color }}>
                            <i className={`fas ${tpl.icon}`}></i>
                          </span>
                          <span className="apv-template-item__title">{tpl.title}</span>
                          <i className="fas fa-chevron-right apv-template-item__arrow"></i>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {TEMPLATE_CATEGORIES.map((category) => {
                  const items = filteredTemplates.filter((t) => t.category === category)
                  if (!items.length) return null
                  return (
                    <section key={category} className="apv-template-group">
                      <h4>{category}</h4>
                      <div className="apv-template-list">
                        {items.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            className="apv-template-item"
                            onClick={() => openCreate(tpl)}
                          >
                            <span className="apv-template-item__icon" style={{ background: tpl.color }}>
                              <i className={`fas ${tpl.icon}`}></i>
                            </span>
                            <span className="apv-template-item__title">{tpl.title}</span>
                            <i className="fas fa-chevron-right apv-template-item__arrow"></i>
                          </button>
                        ))}
                      </div>
                    </section>
                  )
                })}

                {filteredTemplates.length === 0 && (
                  <div className="apv-empty">
                    <i className="fas fa-search"></i>
                    Không tìm thấy mẫu yêu cầu
                  </div>
                )}
              </div>
            ) : tab === 'stats' ? (
              <div className="apv-stats">
                <div className="apv-stats__toolbar">
                  <div className="apv-stats__periods">
                    {[
                      ['week', 'Tuần'],
                      ['month', 'Tháng'],
                      ['year', 'Năm']
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`apv-stats__period ${statsPeriod === value ? 'active' : ''}`}
                        onClick={() => navigateApv({ period: value })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="apv-stats__date">
                    <span>Chọn mốc</span>
                    <input
                      type={statsPeriod === 'year' ? 'number' : 'date'}
                      min={statsPeriod === 'year' ? 2000 : undefined}
                      max={statsPeriod === 'year' ? 2100 : undefined}
                      value={
                        statsPeriod === 'year'
                          ? String(new Date(`${statsDateParam}T00:00:00`).getFullYear() || new Date().getFullYear())
                          : statsDateParam
                      }
                      onChange={(e) => {
                        if (statsPeriod === 'year') {
                          const year = Number(e.target.value) || new Date().getFullYear()
                          navigateApv({ date: `${year}-01-01` })
                        } else {
                          navigateApv({ date: e.target.value })
                        }
                      }}
                    />
                  </label>
                  <div className="apv-stats__label">{formatPeriodLabel(statsPeriod, statsDateParam)}</div>
                </div>

                <div className="apv-stats__summary">
                  <div className="apv-stats__card">
                    <strong>{statsSummary.employees}</strong>
                    <span>Nhân viên</span>
                  </div>
                  <div className="apv-stats__card">
                    <strong>{statsSummary.total}</strong>
                    <span>Tổng đề xuất</span>
                  </div>
                  <div className="apv-stats__card apv-stats__card--pending">
                    <strong>{statsSummary.pending}</strong>
                    <span>Chờ duyệt</span>
                  </div>
                  <div className="apv-stats__card apv-stats__card--approved">
                    <strong>{statsSummary.approved}</strong>
                    <span>Đã duyệt</span>
                  </div>
                  <div className="apv-stats__card apv-stats__card--rejected">
                    <strong>{statsSummary.rejected}</strong>
                    <span>Từ chối</span>
                  </div>
                </div>

                <div className="apv-stats__table-wrap">
                  <table className="apv-stats__table">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Mã NV</th>
                        <th>Họ và tên</th>
                        <th>Tổng</th>
                        <th>Chờ duyệt</th>
                        <th>Đã duyệt</th>
                        <th>Từ chối</th>
                        <th>Theo loại mẫu</th>
                        <th>Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStats.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="apv-stats__empty">Không có đề xuất trong kỳ này</td>
                        </tr>
                      ) : (
                        filteredStats.map((row, idx) => (
                          <tr key={row.employeeCode}>
                            <td>{idx + 1}</td>
                            <td><strong>{row.employeeCode}</strong></td>
                            <td>{row.employeeName}</td>
                            <td>{row.total}</td>
                            <td>{row.pending}</td>
                            <td>{row.approved}</td>
                            <td>{row.rejected}</td>
                            <td>
                              <div className="apv-stats__templates">
                                {Object.entries(row.byTemplate).map(([name, count]) => (
                                  <span key={name}>{name}: {count}</span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="apv-stats__detail-btn"
                                onClick={() => openStatsDetail(row.employeeCode)}
                              >
                                <i className="fas fa-list"></i> Xem chi tiết
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {statsDetailCode && (
                  <div className="apv-stats-detail-overlay" onClick={closeStatsDetail}>
                    <div className="apv-stats-detail-panel" onClick={(e) => e.stopPropagation()}>
                      <div className="apv-stats-detail-panel__head">
                        <div>
                          <div className="apv-stats-detail-panel__title">
                            {statsDetailEmployee?.employeeName || '—'}
                          </div>
                          <div className="apv-stats-detail-panel__meta">
                            Mã NV: {statsDetailCode} • {formatPeriodLabel(statsPeriod, statsDateParam)} • {statsDetailRows.length} đề xuất
                          </div>
                        </div>
                        <button className="apv-stats-detail-panel__close" onClick={closeStatsDetail}>
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                      <div className="apv-stats-detail-panel__body">
                        {statsDetailRows.length === 0 ? (
                          <div className="apv-stats__empty">Không có đề xuất trong kỳ này</div>
                        ) : (
                          <table className="apv-stats__table">
                            <thead>
                              <tr>
                                <th>STT</th>
                                <th>Loại đề xuất</th>
                                <th>Về việc</th>
                                <th>Ngày giờ đề xuất</th>
                                <th>Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody>
                              {statsDetailRows.map((r, idx) => {
                                const badge = statusBadge(r.status)
                                return (
                                  <tr
                                    key={r.id}
                                    className="apv-stats-detail-row"
                                    onClick={() => {
                                      closeStatsDetail()
                                      openDetail(r.id)
                                    }}
                                  >
                                    <td>{idx + 1}</td>
                                    <td>{r.templateType || 'ĐỀ XUẤT'}</td>
                                    <td>{r.subject || '—'}</td>
                                    <td>{formatDateTime(r.createdAt)}</td>
                                    <td><span className={`apv-badge ${badge.cls}`}>{badge.label}</span></td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
            <div className="apv-chips">
              <button className={`apv-chip apv-chip--todo ${subFilter === 'todo' ? 'active' : ''}`} onClick={() => setSubFilterNav('todo')}>
                <i className="fas fa-inbox"></i> {tab === 'admin' ? 'Đang xử lý' : 'Cần làm'} ({todoList.length})
              </button>
              <button className={`apv-chip apv-chip--done ${subFilter === 'done' ? 'active' : ''}`} onClick={() => setSubFilterNav('done')}>
                <i className="fas fa-check-circle"></i> {tab === 'admin' ? 'Đã xong' : 'Hoàn thành'} ({doneList.length})
              </button>
            </div>

            <div className="apv-list">
              {!me && tab !== 'admin' ? (
                <div className="apv-empty">
                  <i className="fas fa-user"></i>
                  Hãy cho biết bạn là ai để xem yêu cầu của mình
                  <div style={{ marginTop: 14 }}>
                    <button className="apv-btn apv-btn--primary" style={{ padding: '10px 20px' }} onClick={() => setShowMePicker(true)}>
                      Chọn nhân sự
                    </button>
                  </div>
                </div>
              ) : activeList.length === 0 ? (
                <div className="apv-empty">
                  <i className="fas fa-inbox"></i>
                  Không có yêu cầu nào
                </div>
              ) : (
                activeList.map((r) => {
                  const badge = statusBadge(r.status)
                  return (
                    <div
                      key={r.id}
                      className="apv-card"
                      onClick={() => openDetail(r.id)}
                    >
                      <div className="apv-card__head">
                        <div className="apv-card__title">
                          <i className="fas fa-file-signature"></i>
                          <div>
                            {r.templateType || 'ĐỀ XUẤT'}
                            <div className="apv-card__code">Số: {r.code}</div>
                          </div>
                        </div>
                        <span className={`apv-badge ${badge.cls}`}>{badge.label}</span>
                      </div>
                      <div className="apv-card__row">
                        <b>Về việc:</b>
                        <span>{r.subject}</span>
                      </div>
                      <div className="apv-card__row">
                        <b>Nội dung:</b>
                        <span>{r.content}</span>
                      </div>
                      <div className="apv-card__row">
                        <b>Đính kèm:</b>
                        <span>{(r.attachments || []).length ? `${r.attachments.length} tập tin` : 'Không có'}</span>
                      </div>
                      {tab === 'admin' && r.status === 'pending' && (
                        <div className="apv-card__row">
                          <b>Đang chờ:</b>
                          <span>{(r.approvalSteps || [])[r.currentStepIndex || 0]?.approverName || '—'}</span>
                        </div>
                      )}
                      {(() => {
                        const decidedSteps = (r.approvalSteps || []).filter((s) => s.decidedAt)
                        const lastDecision = decidedSteps[decidedSteps.length - 1]
                        if (!lastDecision) return null
                        return (
                          <div className="apv-card__row apv-card__row--decision">
                            <b>{lastDecision.decision === 'rejected' ? 'Từ chối:' : 'Duyệt:'}</b>
                            <span>
                              {lastDecision.decidedByName || lastDecision.approverName}
                              {' • '}
                              {formatDateTime(lastDecision.decidedAt)}
                            </span>
                          </div>
                        )
                      })()}
                      <div className="apv-card__footer">
                        <Avatar name={r.requesterName} avatar={r.requesterAvatar} />
                        <span className="apv-card__footer-name">{r.requesterName}</span>
                        <span className="apv-card__footer-date">{formatDateShort(r.createdAt)}</span>
                      </div>
                      {tab === 'inbox' && isMyTurn(r) && (
                        <div className="apv-card__actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="apv-btn apv-btn--approve apv-btn--sm"
                            disabled={deciding}
                            onClick={() => handleDecision('approved', '', r)}
                          >
                            <i className="fas fa-check"></i> Duyệt
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {tab === 'sent' && (
              <button className="apv-fab" onClick={() => openCreate()} title="Tạo yêu cầu">
                <i className="fas fa-plus"></i>
              </button>
            )}
              </>
            )}
          </>
        )}

        {toast && <div className="apv-toast">{toast}</div>}

        {showMePicker && (
          <PersonPickerSheet title="Bạn là ai?" employees={employees} onPick={pickMe} onClose={() => setShowMePicker(false)} />
        )}

        {rejectPrompt && selectedRequest && (
          <BottomSheet title="Lý do từ chối" onClose={() => setRejectPrompt(false)}>
            <textarea
              placeholder="Nhập lý do từ chối (không bắt buộc)"
              value={decisionComment}
              onChange={(e) => setDecisionComment(e.target.value)}
            />
            <div className="apv-reject-modal__actions">
              <button className="apv-btn" style={{ background: '#f1f3f5', color: '#344054' }} onClick={() => setRejectPrompt(false)}>
                Hủy
              </button>
              <button
                className="apv-btn apv-btn--reject"
                style={{ border: '1px solid #dc3545' }}
                disabled={deciding}
                onClick={() => handleDecision('rejected', decisionComment)}
              >
                Xác nhận từ chối
              </button>
            </div>
          </BottomSheet>
        )}
      </div>
    </div>
  )
}

export default Approvals
