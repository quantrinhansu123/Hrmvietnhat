export const escapeHtml = (str) => {
  if (!str) return ''
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export const formatMoney = (n) => {
  try {
    if (n === null || n === undefined || isNaN(n)) return '0 đ'
    return new Intl.NumberFormat('vi-VN').format(Number(n)) + ' đ'
  } catch (e) {
    return String(n || 0) + ' đ'
  }
}



// Display date as DD/MM/YYYY
export const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '-'
  try {
    // If it's already DD/MM/YYYY
    if (String(dateStr).includes('/') && String(dateStr).split('/').length === 3) return dateStr

    // If YYYY-MM-DD
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr

    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()

    return `${day}/${month}/${year}`
  } catch (e) {
    return dateStr
  }
}

export const normalizeString = (str) => {
  if (!str) return ''
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

// Calculate Personal Income Tax (Progressive)
// Formula based on user request (Standard Vietnam PIT)
export const calculateProgressiveTax = (assessableIncome) => {
  if (assessableIncome <= 0) return 0

  // Tax constants
  const MILLION = 1000000

  if (assessableIncome <= 5 * MILLION) {
    return assessableIncome * 0.05
  } else if (assessableIncome <= 10 * MILLION) {
    return assessableIncome * 0.1 - 250000
  } else if (assessableIncome <= 18 * MILLION) {
    return assessableIncome * 0.15 - 750000
  } else if (assessableIncome <= 32 * MILLION) {
    return assessableIncome * 0.2 - 1650000
  } else if (assessableIncome <= 52 * MILLION) {
    return assessableIncome * 0.25 - 3250000
  } else if (assessableIncome <= 80 * MILLION) {
    return assessableIncome * 0.3 - 5850000
  } else {
    // Over 80M
    return assessableIncome * 0.35 - 9850000
  }
}

// Map Supabase DB columns (English) -> App State (Vietnamese)
export const mapUserToApp = (user) => {
  if (!user) return null
  return {
    id: user.id,
    employeeId: user.employee_id || user.username || user.id || '',
    ho_va_ten: user.name || '',
    email: user.email || '',
    sđt: user.phone || '',
    chi_nhanh: user.branch || '',
    bo_phan: user.department || '',
    vi_tri: user.position || '',
    trang_thai: user.employment_status || user.status || 'Thử việc', // Fallback to status if employment_status empty
    ca_lam_viec: user.shift || '',
    ngay_vao_lam: user.join_date || '',
    ngay_lam_chinh_thuc: user.official_date || '',
    cccd: user.cccd || '',
    ngay_cap: user.identity_issue_date || '', // New column
    noi_cap: user.identity_issue_place || '', // New column
    dia_chi_thuong_tru: user.address || '',
    que_quan: user.hometown || '',
    ngay_sinh: user.dob || '',
    gioi_tinh: user.gender || '',
    tinh_trang_hon_nhan: user.marital_status || '',
    avatarDataUrl: user.avatar_url || '',
    files: Array.isArray(user.documents)
      ? user.documents
      : (Array.isArray(user.files) ? user.files : []),
    images: Array.isArray(user.images) ? user.images : [],
    // Preserve other potential fields or map them as needed
    role: user.role || 'user',
    username: user.username || ''
  }
}

// Map bảng public.nhan_su -> state UI Hồ sơ nhân sự
export const mapNhanSuToApp = (row) => {
  if (!row) return null
  const maNhanSu = row.ma_nhan_su || ''
  return {
    id: maNhanSu,
    employeeId: maNhanSu,
    ho_va_ten: row.nhan_su || '',
    email: '',
    sđt: '',
    chi_nhanh: row.chi_nhanh || '',
    bo_phan: row.phong_ban || '',
    vi_tri: row.Cong_Viec || row.cong_viec || row.vi_tri || '',
    ma_vi_tri: row.ma_vi_tri || row.vi_tri || '',
    co_so: row.co_so || '',
    trang_thai: row.trang_thai || 'Đang làm',
    ca_lam_viec: row.ca_lam || '',
    ngay_vao_lam: '',
    ngay_lam_chinh_thuc: '',
    cccd: '',
    ngay_cap: '',
    noi_cap: '',
    dia_chi_thuong_tru: '',
    que_quan: '',
    ngay_sinh: '',
    gioi_tinh: '',
    tinh_trang_hon_nhan: '',
    avatarDataUrl: row.link_chu_ky || '',
    files: [],
    images: [],
    role: 'user',
    username: row.ten_dang_nhap || '',
    password: row.mat_khau || '',
    quyen_xem: Array.isArray(row.quyen_xem) ? row.quyen_xem : []
  }
}

// Map state UI -> bảng public.nhan_su
export const mapAppToNhanSu = (data) => {
  if (!data) return null
  const maNhanSu = data.employeeId || data.employee_id || data.id || data.username || ''
  return {
    ma_nhan_su: maNhanSu,
    nhan_su: data.ho_va_ten || '',
    phong_ban: data.bo_phan || '',
    Cong_Viec: data.vi_tri || data.Cong_Viec || '',
    cong_viec: data.vi_tri || data.cong_viec || '',
    chi_nhanh: data.chi_nhanh || '',
    vi_tri: data.ma_vi_tri || data.vi_tri || '',
    ma_vi_tri: data.ma_vi_tri || '',
    co_so: data.co_so || '',
    ca_lam: data.ca_lam_viec || '',
    trang_thai: data.trang_thai || 'Đang làm',
    ten_dang_nhap: data.username || data.ten_dang_nhap || '',
    mat_khau: data.password || data.mat_khau || null,
    link_chu_ky: data.avatarDataUrl || data.avatarUrl || data.avatar || null
  }
}

// Helper to convert DD/MM/YYYY to YYYY-MM-DD
const formatDateForDB = (dateStr) => {
  if (!dateStr) return null
  const str = String(dateStr).trim()

  // Already in YYYY-MM-DD
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str

  // Handle DD/MM/YYYY
  if (str.includes('/')) {
    const parts = str.split('/')
    if (parts.length === 3) {
      // Assuming DD/MM/YYYY
      const day = parts[0].padStart(2, '0')
      const month = parts[1].padStart(2, '0')
      const year = parts[2]
      return `${year}-${month}-${day}`
    }
  }

  return null
}

// Map App State (Vietnamese) -> Supabase DB columns (English)
export const mapAppToUser = (data) => {
  if (!data) return null
  return {
    // id field is usually handled by Supabase or passed separately for updates
    employee_id: data.employeeId || data.employee_id || data.username || '',
    name: data.ho_va_ten || '',
    email: data.email || '',
    phone: data.sđt || data.sdt || '',
    branch: data.chi_nhanh || '',
    department: data.bo_phan || '',
    position: data.vi_tri || '',
    employment_status: data.trang_thai || '',
    shift: data.ca_lam_viec || '',
    join_date: formatDateForDB(data.ngay_vao_lam),
    official_date: formatDateForDB(data.ngay_lam_chinh_thuc),
    cccd: data.cccd || '',
    identity_issue_date: formatDateForDB(data.ngay_cap),
    identity_issue_place: data.noi_cap || '',
    address: data.dia_chi_thuong_tru || data.address || '',
    hometown: data.que_quan || '',
    dob: formatDateForDB(data.ngay_sinh),
    gender: data.gioi_tinh || '',
    marital_status: data.tinh_trang_hon_nhan || '',
    avatar_url: data.avatarDataUrl || data.avatarUrl || data.avatar || '',
    documents: Array.isArray(data.files) ? data.files.map(f => ({
      name: f.name || '',
      url: f.url || f.link || '',
      attachments: Array.isArray(f.attachments) ? f.attachments.map(item => ({
        name: item.name || '',
        type: item.type || '',
        data: item.data || ''
      })).filter(item => item.data) : [],
      // Backward compatibility for documents saved before multi-file upload.
      ...(!f.attachments && f.data ? { data: f.data, type: f.type || '' } : {})
    })) : [],
    images: Array.isArray(data.images) ? data.images : [],
    // Add default fields if creating new user, though usually handled by DB defaults
    role: data.role || 'user',
    username: data.username || data.email?.split('@')[0] || data.employeeId || ''
  }
}

// Parse Supabase schema-cache error, e.g.:
// "Could not find the 'address' column of 'users' in the schema cache"
export const getMissingUsersColumnFromError = (error) => {
  const message = error?.message || ''
  const match = message.match(/Could not find the '([^']+)' column of '(?:users|nhan_su)' in the schema cache/i)
  return match?.[1] || null
}

// Remove unsupported column from payload to keep compatibility across different DB schemas
export const removeMissingUsersColumnFromPayload = (payload, error) => {
  const missingColumn = getMissingUsersColumnFromError(error)
  if (!missingColumn || !payload || !(missingColumn in payload)) {
    return { payload, removedColumn: null }
  }

  const sanitizedPayload = { ...payload }
  delete sanitizedPayload[missingColumn]

  return { payload: sanitizedPayload, removedColumn: missingColumn }
}

// Keep retrying users table mutation by stripping unsupported columns one by one.
export const runUsersMutationWithSchemaFallback = async (mutateFn, initialPayload, maxRetries = 20) => {
  let payload = { ...(initialPayload || {}) }
  let attempts = 0
  const removedColumns = []

  while (attempts <= maxRetries) {
    const result = await mutateFn(payload)
    const error = result?.error
    if (!error) {
      return { error: null, payload, removedColumns }
    }

    const fallback = removeMissingUsersColumnFromPayload(payload, error)
    if (!fallback.removedColumn) {
      return { error, payload, removedColumns }
    }

    removedColumns.push(fallback.removedColumn)
    payload = fallback.payload
    attempts += 1
  }

  return { error: new Error('Unable to adapt payload to users schema.'), payload, removedColumns }
}
