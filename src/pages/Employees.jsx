import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import EmployeeModal from '../components/EmployeeModal'
import StatusHistoryView from '../components/StatusHistoryView'
import EmployeeDirectory from '../components/EmployeeDirectory'
import { isSupabaseConfigured, supabase } from '../services/supabase'
import { formatDateDisplay, mapAppToNhanSu, mapNhanSuToApp, runUsersMutationWithSchemaFallback } from '../utils/helpers'

function Employees() {
    const [employees, setEmployees] = useState([])
    const [filteredEmployees, setFilteredEmployees] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [filterBranch, setFilterBranch] = useState('')
    const [filterDept, setFilterDept] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterBirthMonth, setFilterBirthMonth] = useState('')
    const [filterContract, setFilterContract] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedEmployee, setSelectedEmployee] = useState(null)
    const [isReadOnly, setIsReadOnly] = useState(false)
    const fileInputRef = useRef(null)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)

    // Tab State
    const [activeTab, setActiveTab] = useState('list') // 'list' or 'history'

    useEffect(() => {
        loadEmployees()
    }, [])

    useEffect(() => {
        filterEmployees()
    }, [employees, searchTerm, filterBranch, filterDept, filterStatus, filterBirthMonth, filterContract, activeTab])

    const loadEmployees = async () => {
        try {
            setLoading(true)
            setLoadError('')

            if (!isSupabaseConfigured) {
                throw new Error('Chưa cấu hình kết nối Supabase (.env). Kiểm tra VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY rồi chạy lại npm run dev.')
            }

            const { data, error } = await supabase
                .from('nhan_su')
                .select('*')

            if (error) throw error

            const mappedData = (data || []).map(u => mapNhanSuToApp(u)).filter(Boolean)
            setEmployees(mappedData)
            setLoading(false)
        } catch (err) {
            console.error("Error loading employees:", err)
            setEmployees([])
            setLoadError(err?.message || 'Chưa kết nối đúng database. Vui lòng thử lại.')
            setLoading(false)
        }
    }

    const filterEmployees = () => {
        let filtered = employees.filter(item => {
            if (!item) return false

            const status = item.trang_thai || item.status || ''
            // Mặc định ẩn NV nghỉ việc; chỉ hiện khi chọn lọc "Nghỉ việc"
            if (!filterStatus && status === 'Nghỉ việc') return false

            const nameField = item.ho_va_ten || item.name || item.Tên || ""
            const matchSearch = !searchTerm ||
                nameField.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.email && item.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.sđt && String(item.sđt || '').includes(searchTerm)) ||
                (item.sdt && String(item.sdt || '').includes(searchTerm)) ||
                (item.employeeId && String(item.employeeId).toLowerCase().includes(searchTerm.toLowerCase()))

            const matchBranch = !filterBranch
                || (filterBranch === '__none__' ? !item.chi_nhanh : item.chi_nhanh === filterBranch)
            const matchDept = !filterDept
                || (filterDept === '__none__' ? !item.bo_phan : item.bo_phan === filterDept)
            const matchStatus = !filterStatus || status === filterStatus
            const contractType = item.loai_hop_dong || item.contractType || ''
            const matchContract = !filterContract || contractType === filterContract

            let matchExpiry = true
            if (activeTab === 'expiring') {
                const expiryValue = item.ngay_het_han || item.contractEndDate || item.ngay_het_han_hop_dong
                const expiryDate = expiryValue ? new Date(expiryValue) : null
                const daysLeft = expiryDate && !Number.isNaN(expiryDate.getTime())
                    ? Math.ceil((expiryDate.getTime() - Date.now()) / 86400000)
                    : null
                matchExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 60
            }

            // Filter Birth Month
            let matchMonth = true
            if (filterBirthMonth) {
                const dob = item.ngay_sinh || item.dob || ''
                if (!dob) {
                    matchMonth = false
                } else {
                    let month = -1
                    // Handle YYYY-MM-DD
                    if (dob.includes('-')) {
                        const parts = dob.split('-')
                        if (parts.length === 3) {
                            // usually YYYY-MM-DD, month is parts[1]
                            month = parseInt(parts[1], 10)
                        }
                    }
                    // Handle DD/MM/YYYY
                    else if (dob.includes('/')) {
                        const parts = dob.split('/')
                        if (parts.length === 3) {
                            // usually DD/MM/YYYY, month is parts[1]
                            month = parseInt(parts[1], 10)
                        }
                    }

                    matchMonth = month === parseInt(filterBirthMonth, 10)
                }
            }

            return matchSearch && matchBranch && matchDept && matchStatus && matchMonth && matchContract && matchExpiry
        })

        setFilteredEmployees(filtered)
    }

    const handleDelete = async (id, name) => {
        if (!confirm(`Bạn có chắc muốn xóa nhân viên "${name}"?\n\nHành động này không thể hoàn tác!`)) {
            return
        }

        try {
            const { error } = await supabase
                .from('nhan_su')
                .delete()
                .eq('ma_nhan_su', id)

            if (error) throw error

            setEmployees(prev => prev.filter(item => item.id !== id))
            alert(`Đã xóa nhân viên "${name}"`)
        } catch (error) {
            alert(`Lỗi: ${error.message}`)
        }
    }

    const downloadTemplate = () => {
        const headers = [
            'Mã nhân viên',
            'Họ và tên',
            'Email',
            'SĐT',
            'Tên đăng nhập',
            'Vai trò',
            'Mật khẩu',
            'Chi nhánh',
            'Bộ phận',
            'Vị trí',
            'Trạng thái',
            'Ngày sinh',
            'Ngày vào làm',
            'Ngày lên chính thức',
            'Ca làm việc',
            'CCCD',
            'Ngày cấp',
            'Nơi cấp',
            'Địa chỉ thường trú',
            'Quê quán',
            'Giới tính',
            'Tình trạng hôn nhân',
            'Link ảnh'
        ]

        // Tạo file mẫu chuẩn xlsx với 1 dòng dữ liệu để trống
        const emptyRow = new Array(headers.length).fill('')
        const ws = XLSX.utils.aoa_to_sheet([headers, emptyRow])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Mau_import_nhan_su')
        XLSX.writeFile(wb, 'Mau_import_nhan_su.xlsx')
    }

    const exportToExcel = () => {
        if (filteredEmployees.length === 0) {
            alert('Không có dữ liệu để xuất!')
            return
        }

        const headers = [
            'STT',
            'Mã nhân viên',
            'Họ và tên',
            'Email',
            'SĐT',
            'Tên đăng nhập',
            'Vai trò',
            'Chi nhánh',
            'Bộ phận',
            'Vị trí',
            'Trạng thái',
            'Ngày vào làm',
            'CCCD',
            'Ngày cấp',
            'Nơi cấp',
            'Quê quán',
            'Giới tính',
            'Tình trạng hôn nhân'
        ]

        const escapeCell = (val) => {
            return String(val || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
        }

        const rowsHtml = filteredEmployees.map((emp, idx) => {
            const cells = [
                idx + 1,
                emp.employeeId || '',
                emp.ho_va_ten || emp.name || emp.Tên || '',
                emp.email || '',
                emp.sđt || emp.sdt || '',
                emp.username || '',
                emp.role || 'user',
                emp.chi_nhanh || '',
                emp.bo_phan || '',
                emp.vi_tri || '',
                emp.trang_thai || emp.status || '',
                emp.ngay_vao_lam || '',
                emp.cccd || '',
                emp.ngay_cap || '',
                emp.noi_cap || '',
                emp.que_quan || '',
                emp.gioi_tinh || '',
                emp.tinh_trang_hon_nhan || ''
            ]
            const tds = cells.map(cell => `<td>${escapeCell(cell)}</td>`).join('')
            return `<tr>${tds}</tr>`
        }).join('')

        const headerHtml = headers.map(h => `<th>${escapeCell(h)}</th>`).join('')
        const tableHtml = `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`

        // Bọc trong HTML để Excel mở định dạng bảng
        const htmlContent = `
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="UTF-8"></head>
        <body>${tableHtml}</body>
      </html>
    `

        const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        const date = new Date()
        const dateStr = date.toISOString().split('T')[0]
        link.href = url
        link.download = `Danh_sach_nhan_su_${dateStr}.xls`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Convert Google Drive link to direct image URL
    const convertDriveLink = (url) => {
        if (!url) return ''
        const urlStr = String(url).trim()

        // Check if it's a Google Drive link
        if (urlStr.includes('drive.google.com')) {
            // Extract file ID from various Drive URL formats
            let fileId = ''

            // Format: https://drive.google.com/file/d/FILE_ID/view
            const match1 = urlStr.match(/\/file\/d\/([^\/]+)/)
            if (match1) {
                fileId = match1[1]
            }

            // Format: https://drive.google.com/open?id=FILE_ID
            const match2 = urlStr.match(/[?\&]id=([^\&]+)/)
            if (match2) {
                fileId = match2[1]
            }

            // Format: https://drive.google.com/uc?id=FILE_ID
            const match3 = urlStr.match(/\/uc\?.*id=([^\&]+)/)
            if (match3) {
                fileId = match3[1]
            }

            if (fileId) {
                // Use thumbnail endpoint - works better with CORS
                const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`
                console.log('🔄 Converted Drive link:', urlStr, '→', directUrl)
                console.log('   ℹ️ Alternative format: https://drive.google.com/uc?export=view&id=' + fileId)
                return directUrl
            } else {
                console.warn('⚠️ Could not extract file ID from Drive link:', urlStr)
            }
        }

        // If it's already a direct image URL (imgur, etc), return as is
        if (urlStr) {
            console.log('✅ Using direct URL:', urlStr)
        }
        return urlStr
    }

    const handleImportExcel = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return

        try {
            setLoading(true)
            const buffer = await file.arrayBuffer()
            const workbook = XLSX.read(buffer, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const sheet = workbook.Sheets[sheetName]
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

            if (!rows || rows.length < 2) {
                alert('File không có dữ liệu.')
                setLoading(false)
                return
            }

            // Normalize header: remove accents, spaces, special chars
            const normalizeHeader = (str) => {
                return String(str || '')
                    .toLowerCase()
                    .trim()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '') // Remove accents
                    .replace(/đ/g, 'd')
                    .replace(/[^a-z0-9]/g, '_') // Replace non-alphanumeric with underscore
                    .replace(/_+/g, '_') // Replace multiple underscores with single
                    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
            }

            const headers = rows[0].map(h => normalizeHeader(h))
            const dataRows = rows.slice(1).filter(r => r.some(cell => String(cell || '').trim() !== ''))

            console.log('📋 Headers detected:', headers)
            console.log('📊 Total data rows:', dataRows.length)

            let imported = 0
            let skipped = 0
            const errors = []

            const isValidDate = (dateStr) => {
                if (!dateStr) return true // Empty is ok
                // Check format DD/MM/YYYY or YYYY-MM-DD
                const datePattern = /^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2})$/
                if (!datePattern.test(dateStr)) return false

                // Try to parse
                const date = new Date(dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : dateStr)
                return !isNaN(date.getTime())
            }

            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i]
                const rowIndex = i + 2 // Header is row 1

                const rowObj = {}
                headers.forEach((h, idx) => {
                    rowObj[h] = row[idx] || ''
                })

                const payload = {
                    employeeId: rowObj['ma_nhan_vien'] || rowObj['ma_nv'] || rowObj['employee_id'] || rowObj['code'] || '',
                    ho_va_ten: rowObj['ho_va_ten'] || rowObj['ho_ten'] || rowObj['ten'] || rowObj['ho_va_ten'] || rowObj['name'] || '',
                    email: rowObj['email'] || '',
                    sđt: rowObj['sdt'] || rowObj['so_dien_thoai'] || rowObj['dien_thoai'] || rowObj['phone'] || '',
                    username: rowObj['ten_dang_nhap'] || rowObj['username'] || rowObj['user_name'] || '',
                    role: rowObj['vai_tro'] || rowObj['role'] || 'user',
                    password: rowObj['mat_khau'] || rowObj['password'] || '',
                    chi_nhanh: rowObj['chi_nhanh'] || rowObj['branch'] || '',
                    bo_phan: rowObj['bo_phan'] || rowObj['phong_ban'] || rowObj['department'] || '',
                    vi_tri: rowObj['vi_tri'] || rowObj['chuc_vu'] || rowObj['position'] || '',
                    trang_thai: rowObj['trang_thai'] || rowObj['status'] || '',
                    ngay_sinh: rowObj['ngay_sinh'] || rowObj['dob'] || rowObj['birth_date'] || '',
                    ngay_vao_lam: rowObj['ngay_vao_lam'] || rowObj['ngay_bat_dau'] || '',
                    ngay_lam_chinh_thuc: rowObj['ngay_len_chinh_thuc'] || rowObj['ngay_chinh_thuc'] || rowObj['ngay_lam_chinh_thuc'] || '',
                    ca_lam_viec: rowObj['ca_lam_viec'] || rowObj['ca'] || rowObj['shift'] || '',
                    cccd: rowObj['cccd'] || rowObj['cmnd'] || '',
                    ngay_cap: rowObj['ngay_cap'] || '',
                    noi_cap: rowObj['noi_cap'] || '',
                    dia_chi_thuong_tru: rowObj['dia_chi_thuong_tru'] || rowObj['thuong_tru'] || rowObj['dia_chi'] || rowObj['address'] || '',
                    que_quan: rowObj['que_quan'] || '',
                    gioi_tinh: rowObj['gioi_tinh'] || rowObj['gender'] || '',
                    tinh_trang_hon_nhan: rowObj['tinh_trang_hon_nhan'] || rowObj['hon_nhan'] || '',
                    avatarUrl: convertDriveLink(rowObj['link_anh'] || rowObj['avatar'] || rowObj['anh'] || rowObj['hinh_anh'] || rowObj['image'] || '')
                }

                // VALIDATION
                const rowErrors = []

                if (!isValidDate(payload.ngay_sinh)) rowErrors.push(`Ngày sinh không hợp lệ: "${payload.ngay_sinh}" (cần dd/mm/yyyy)`)
                if (!isValidDate(payload.ngay_vao_lam)) rowErrors.push(`Ngày vào làm không hợp lệ: "${payload.ngay_vao_lam}" (cần dd/mm/yyyy)`)
                if (!isValidDate(payload.ngay_lam_chinh_thuc)) rowErrors.push(`Ngày chính thức không hợp lệ: "${payload.ngay_lam_chinh_thuc}" (cần dd/mm/yyyy)`)
                if (!isValidDate(payload.ngay_cap)) rowErrors.push(`Ngày cấp CCCD không hợp lệ: "${payload.ngay_cap}" (cần dd/mm/yyyy)`)

                if (rowErrors.length > 0) {
                    console.log(`⚠️ Skipped row ${rowIndex}:`, rowErrors.join(', '))
                    errors.push({
                        row: rowIndex,
                        name: payload.ho_va_ten || 'Không tên',
                        reason: rowErrors.join(', ')
                    })
                    skipped++
                    continue
                }

                console.log('✅ Importing:', payload.ho_va_ten)

                const dbPayload = mapAppToNhanSu(payload)
                if (!dbPayload.ma_nhan_su) {
                    errors.push({
                        row: rowIndex,
                        name: payload.ho_va_ten || 'Không tên',
                        reason: 'Thiếu mã nhân sự (ma_nhan_su)'
                    })
                    skipped++
                    continue
                }
                dbPayload.mat_khau = payload.password || dbPayload.mat_khau || '123456'

                const mutationResult = await runUsersMutationWithSchemaFallback(
                    (payloadToInsert) => supabase.from('nhan_su').upsert([payloadToInsert], { onConflict: 'ma_nhan_su' }),
                    dbPayload
                )
                const { error } = mutationResult

                if (error) {
                    console.error('❌ Insert error for:', payload.ho_va_ten, error)
                    errors.push({
                        row: rowIndex,
                        name: payload.ho_va_ten,
                        reason: `Lỗi Database: ${error.message || error.code}`
                    })
                    skipped++
                } else {
                    imported++
                }
            }

            await loadEmployees()
            console.log(`📊 Import summary: ${imported} imported, ${skipped} skipped`)

            let message = `Đã import thành công: ${imported} nhân viên.\n`
            if (skipped > 0) {
                message += `Có ${skipped} dòng bị lỗi/bỏ qua:\n\n`
                // Limit errors to first 10 to avoid huge alert
                const showErrors = errors.slice(0, 10)
                showErrors.forEach(err => {
                    message += `• Dòng ${err.row} (${err.name}): ${err.reason}\n`
                })
                if (errors.length > 10) {
                    message += `... và ${errors.length - 10} dòng khác.`
                }
            }

            alert(message)
        } catch (error) {
            console.error('❌ Import error:', error)
            alert('Lỗi import: ' + error.message)
        } finally {
            setLoading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }



    const isActiveEmployee = (e) => (e.trang_thai || e.status || '') !== 'Nghỉ việc'
    const activeEmployees = employees.filter(isActiveEmployee)

    // Employees scoped by selected branch (for department tabs)
    const employeesInBranch = activeEmployees.filter(e => {
        if (!filterBranch) return true
        if (filterBranch === '__none__') return !e.chi_nhanh
        return e.chi_nhanh === filterBranch
    })

    const branches = [...new Set(activeEmployees.map(e => e.chi_nhanh).filter(Boolean))].sort()
    const noBranchCount = activeEmployees.filter(e => !e.chi_nhanh).length

    const departments = [...new Set(employeesInBranch.map(e => e.bo_phan).filter(Boolean))].sort()
    const noDeptCount = employeesInBranch.filter(e => !e.bo_phan).length

    const getBranchCount = (branch) => {
        if (branch === '') return activeEmployees.length
        if (branch === '__none__') return noBranchCount
        return activeEmployees.filter(e => e.chi_nhanh === branch).length
    }

    const getDeptCount = (dept) => {
        if (dept === '') return employeesInBranch.length
        if (dept === '__none__') return noDeptCount
        return employeesInBranch.filter(e => e.bo_phan === dept).length
    }

    // Group filtered list by department
    const groupedEmployees = (() => {
        const groups = new Map()
        filteredEmployees.forEach(emp => {
            const key = emp.bo_phan || 'Chưa phân bộ phận'
            if (!groups.has(key)) groups.set(key, [])
            groups.get(key).push(emp)
        })

        const sortedKeys = [...groups.keys()].sort((a, b) => {
            if (a === 'Chưa phân bộ phận') return 1
            if (b === 'Chưa phân bộ phận') return -1
            return a.localeCompare(b, 'vi')
        })

        return sortedKeys.map(key => ({
            dept: key,
            items: groups.get(key)
        }))
    })()

    const openView = (emp) => {
        setSelectedEmployee(emp)
        setIsReadOnly(true)
        setIsModalOpen(true)
    }

    const openEdit = (emp) => {
        setSelectedEmployee(emp)
        setIsReadOnly(false)
        setIsModalOpen(true)
    }

    const renderCard = (emp, idx) => {
        const name = emp.ho_va_ten || emp.name || emp.Tên || 'N/A'
        const avatar = emp.avatarDataUrl || emp.avatarUrl || emp.avatar || ''
        const status = emp.trang_thai || emp.status || ''
        return (
            <article key={emp.id || idx} className="employee-photo-card">
                <div className="employee-photo-card__media">
                    {avatar ? (
                        <img
                            src={avatar}
                            alt={name}
                            onError={(e) => {
                                e.target.style.display = 'none'
                                const placeholder = e.target.nextSibling
                                if (placeholder) placeholder.style.display = 'flex'
                            }}
                        />
                    ) : null}
                    <div
                        className="employee-photo-card__placeholder"
                        style={{ display: avatar ? 'none' : 'flex' }}
                    >
                        <i className="fas fa-user"></i>
                    </div>
                    {status && (
                        <span className="employee-photo-card__status">{status}</span>
                    )}
                </div>
                <div className="employee-photo-card__body">
                    <h3 className="employee-photo-card__name">{name}</h3>
                    <p className="employee-photo-card__meta">
                        {emp.employeeId ? emp.employeeId : `#${idx + 1}`}
                    </p>
                    <div className="employee-photo-card__actions">
                        <div className="actions">
                            <button className="view" title="Xem" onClick={() => openView(emp)}>
                                <i className="fas fa-eye"></i>
                            </button>
                            <button className="edit" title="Sửa" onClick={() => openEdit(emp)}>
                                <i className="fas fa-edit"></i>
                            </button>
                            <button className="delete" title="Xóa" onClick={() => handleDelete(emp.id, name)}>
                                <i className="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        )
    }

    const renderListRow = (emp, idx) => {
        const name = emp.ho_va_ten || emp.name || emp.Tên || 'N/A'
        const avatar = emp.avatarDataUrl || emp.avatarUrl || emp.avatar || ''
        const status = emp.trang_thai || emp.status || ''
        return (
            <div key={emp.id || idx} className="employee-list-row">
                <div className="employee-list-row__photo">
                    {avatar ? (
                        <img
                            src={avatar}
                            alt={name}
                            onError={(e) => {
                                e.target.style.display = 'none'
                                const placeholder = e.target.nextSibling
                                if (placeholder) placeholder.style.display = 'flex'
                            }}
                        />
                    ) : null}
                    <div
                        className="employee-photo-card__placeholder"
                        style={{ display: avatar ? 'none' : 'flex' }}
                    >
                        <i className="fas fa-user"></i>
                    </div>
                </div>
                <div className="employee-list-row__info">
                    <h3 className="employee-list-row__name">{name}</h3>
                    <div className="employee-list-row__meta">
                        <span>{emp.employeeId || `#${idx + 1}`}</span>
                        <span>Sinh: {formatDateDisplay(emp.ngay_sinh || emp.dob) || '—'}</span>
                        <span>Chính thức: {formatDateDisplay(emp.ngay_lam_chinh_thuc) || '—'}</span>
                    </div>
                </div>
                {status && (
                    <span className="employee-list-row__status">{status}</span>
                )}
                <div className="employee-list-row__actions">
                    <div className="actions">
                        <button className="view" title="Xem" onClick={() => openView(emp)}>
                            <i className="fas fa-eye"></i>
                        </button>
                        <button className="edit" title="Sửa" onClick={() => openEdit(emp)}>
                            <i className="fas fa-edit"></i>
                        </button>
                        <button className="delete" title="Xóa" onClick={() => handleDelete(emp.id, name)}>
                            <i className="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const handleSelectBranch = (branch) => {
        setFilterBranch(branch)
        setFilterDept('')
    }

    const tabBtnStyle = (active) => ({
        padding: '8px 14px',
        border: '1px solid',
        borderColor: active ? 'var(--primary)' : '#ddd',
        borderRadius: '6px',
        background: active ? 'var(--primary)' : '#fff',
        color: active ? '#fff' : '#444',
        cursor: 'pointer',
        fontWeight: active ? 600 : 500,
        fontSize: '0.9rem'
    })

    if (loading) {
        return <div className="loadingState">Đang tải dữ liệu...</div>
    }

    if (loadError) {
        return (
            <div className="employees-page" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{
                    maxWidth: 480,
                    margin: '0 auto',
                    padding: '28px 24px',
                    border: '1px solid #fecdd3',
                    borderRadius: 12,
                    background: '#fff8f9'
                }}>
                    <i className="fas fa-database" style={{ fontSize: 28, color: '#e11d48', marginBottom: 12 }}></i>
                    <h3 style={{ margin: '0 0 8px', color: '#101828' }}>Chưa kết nối đúng database</h3>
                    <p style={{ margin: '0 0 18px', color: '#667085', fontSize: '0.9rem', lineHeight: 1.5 }}>
                        {loadError}
                    </p>
                    <button className="btn btn-primary" onClick={loadEmployees}>
                        <i className="fas fa-rotate-right"></i> Thử lại
                    </button>
                </div>
            </div>
        )
    }

    return <EmployeeDirectory
        employees={employees}
        filteredEmployees={filteredEmployees}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterBranch={filterBranch}
        setFilterBranch={setFilterBranch}
        filterDept={filterDept}
        setFilterDept={setFilterDept}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterContract={filterContract}
        setFilterContract={setFilterContract}
        selectedEmployee={selectedEmployee}
        setSelectedEmployee={setSelectedEmployee}
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        isReadOnly={isReadOnly}
        setIsReadOnly={setIsReadOnly}
        onReload={loadEmployees}
        onExport={exportToExcel}
        onImport={handleImportExcel}
        onDelete={handleDelete}
    />

    /*
    return (
        <div>
            <div className="page-header" style={{ marginBottom: '10px' }}>
                <h1 className="page-title">
                    <i className="fas fa-users"></i>
                    Hồ sơ nhân sự
                </h1>
                {activeTab === 'list' && (
                    <div>
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setSelectedEmployee(null)
                                setIsModalOpen(true)
                            }}
                            style={{ marginRight: '10px' }}
                        >
                            <i className="fas fa-plus"></i>
                            Tạo mới NV
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setIsImportModalOpen(true)}
                            style={{ marginRight: '10px' }}
                        >
                            <i className="fas fa-file-upload"></i>
                            Upload Excel
                        </button>


                        <button
                            className="btn btn-info"
                            onClick={downloadTemplate}
                            style={{
                                marginRight: '10px',
                                color: '#fff',
                                background: 'var(--primary)',
                                borderColor: 'var(--primary)'
                            }}
                        >
                            <i className="fas fa-download"></i>
                            Tải file mẫu
                        </button>
                        <button
                            className="btn btn-success"
                            onClick={exportToExcel}
                            style={{
                                marginRight: '10px',
                                background: 'var(--primary)',
                                borderColor: 'var(--primary)',
                                color: '#fff'
                            }}
                        >
                            <i className="fas fa-file-excel"></i>
                            Xuất Excel
                        </button>
                        <button className="btn btn-primary" onClick={loadEmployees}>
                            <i className="fas fa-sync"></i>
                            Làm mới
                        </button>
                    </div>
                )}
            </div>

            <div className="main-tabs" style={{
                borderBottom: '1px solid #ddd',
                marginBottom: '20px',
                display: 'flex',
                gap: '5px'
            }}>
                <button
                    onClick={() => setActiveTab('list')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activeTab === 'list' ? '#fff' : '#f8f9fa',
                        borderBottom: activeTab === 'list' ? '2px solid var(--primary)' : '2px solid transparent',
                        fontWeight: activeTab === 'list' ? '600' : '500',
                        color: activeTab === 'list' ? 'var(--primary)' : '#666',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                >
                    <i className="fas fa-list" style={{ marginRight: '8px' }}></i>
                    Danh sách nhân viên
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activeTab === 'history' ? '#fff' : '#f8f9fa',
                        borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent',
                        fontWeight: activeTab === 'history' ? '600' : '500',
                        color: activeTab === 'history' ? 'var(--primary)' : '#666',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                >
                    <i className="fas fa-history" style={{ marginRight: '8px' }}></i>
                    Biến động trạng thái
                </button>
            </div>

            {activeTab === 'list' ? (
                <>
                    <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>
                            Chi nhánh
                        </div>
                        <div className="branch-tabs" style={{
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                            marginBottom: '12px',
                            paddingBottom: '12px',
                            borderBottom: '1px solid #eee'
                        }}>
                            <button
                                type="button"
                                onClick={() => handleSelectBranch('')}
                                style={tabBtnStyle(filterBranch === '')}
                            >
                                Tất cả
                                <span style={{ marginLeft: '6px', opacity: 0.85, fontSize: '0.8rem' }}>
                                    ({getBranchCount('')})
                                </span>
                            </button>
                            {branches.map(branch => (
                                <button
                                    key={branch}
                                    type="button"
                                    onClick={() => handleSelectBranch(branch)}
                                    style={tabBtnStyle(filterBranch === branch)}
                                >
                                    {branch}
                                    <span style={{ marginLeft: '6px', opacity: 0.85, fontSize: '0.8rem' }}>
                                        ({getBranchCount(branch)})
                                    </span>
                                </button>
                            ))}
                            {noBranchCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleSelectBranch('__none__')}
                                    style={tabBtnStyle(filterBranch === '__none__')}
                                >
                                    Chưa có chi nhánh
                                    <span style={{ marginLeft: '6px', opacity: 0.85, fontSize: '0.8rem' }}>
                                        ({noBranchCount})
                                    </span>
                                </button>
                            )}
                        </div>

                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>
                            Bộ phận{filterBranch && filterBranch !== '__none__' ? ` · ${filterBranch}` : ''}
                        </div>
                        <div className="dept-tabs" style={{
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                            paddingBottom: '4px'
                        }}>
                            <button
                                type="button"
                                onClick={() => setFilterDept('')}
                                style={tabBtnStyle(filterDept === '')}
                            >
                                Tất cả
                                <span style={{ marginLeft: '6px', opacity: 0.85, fontSize: '0.8rem' }}>
                                    ({getDeptCount('')})
                                </span>
                            </button>
                            {departments.map(dept => (
                                <button
                                    key={dept}
                                    type="button"
                                    onClick={() => setFilterDept(dept)}
                                    style={tabBtnStyle(filterDept === dept)}
                                >
                                    {dept}
                                    <span style={{ marginLeft: '6px', opacity: 0.85, fontSize: '0.8rem' }}>
                                        ({getDeptCount(dept)})
                                    </span>
                                </button>
                            ))}
                            {noDeptCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFilterDept('__none__')}
                                    style={tabBtnStyle(filterDept === '__none__')}
                                >
                                    Chưa phân bộ phận
                                    <span style={{ marginLeft: '6px', opacity: 0.85, fontSize: '0.8rem' }}>
                                        ({noDeptCount})
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="search-box" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Tìm theo Mã NV, Họ tên, SĐT, Email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="">Tất cả trạng thái</option>
                            <option value="Thử việc">Thử việc</option>
                            <option value="Chính thức">Chính thức</option>
                            <option value="Tạm nghỉ">Tạm nghỉ</option>
                            <option value="Nghỉ việc">Đã nghỉ</option>
                        </select>
                        <select value={filterBirthMonth} onChange={(e) => setFilterBirthMonth(e.target.value)}>
                            <option value="">Tất cả tháng sinh</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                <option key={month} value={month}>Tháng {month}</option>
                            ))}
                        </select>
                        <div className="employee-view-toggle">
                            <button
                                type="button"
                                className={viewMode === 'cards' ? 'active' : ''}
                                onClick={() => setViewMode('cards')}
                                title="Dạng thẻ"
                            >
                                <i className="fas fa-th-large"></i>
                            </button>
                            <button
                                type="button"
                                className={viewMode === 'list' ? 'active' : ''}
                                onClick={() => setViewMode('list')}
                                title="Dạng list"
                            >
                                <i className="fas fa-list"></i>
                            </button>
                        </div>
                    </div>

                    {filteredEmployees.length === 0 ? (
                        <div className="employee-card-empty">
                            {activeEmployees.length === 0 ? 'Chưa có dữ liệu nhân sự' : 'Không tìm thấy kết quả'}
                        </div>
                    ) : (
                        <div className="employee-dept-groups">
                            {groupedEmployees.map(group => (
                                <section key={group.dept} className="employee-dept-group">
                                    <div className="employee-dept-group__header">
                                        <h3>
                                            <i className="fas fa-building"></i>
                                            {group.dept}
                                        </h3>
                                        <span>{group.items.length} nhân viên</span>
                                    </div>
                                    {viewMode === 'cards' ? (
                                        <div className="employee-card-grid">
                                            {group.items.map((emp, idx) => renderCard(emp, idx))}
                                        </div>
                                    ) : (
                                        <div className="employee-list">
                                            {group.items.map((emp, idx) => renderListRow(emp, idx))}
                                        </div>
                                    )}
                                </section>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <StatusHistoryView employees={employees} onDataChange={() => { }} />
            )}

            <EmployeeModal
                employee={selectedEmployee}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    setSelectedEmployee(null)
                    setIsReadOnly(false)
                }}
                onSave={loadEmployees}
                readOnly={isReadOnly}
                departmentOptions={[...new Set(employees.map(e => e.bo_phan).filter(Boolean))]}
                positionOptions={[...new Set(employees.map(e => e.vi_tri).filter(Boolean))]}
            />

            {isImportModalOpen && (
                <div className="modal show" onClick={() => setIsImportModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                <i className="fas fa-file-upload"></i>
                                Upload Excel nhân sự
                            </h3>
                            <button className="modal-close" onClick={() => setIsImportModalOpen(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Chọn tệp (.xlsx, .xls, .csv)</label>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    ref={fileInputRef}
                                    onChange={(e) => {
                                        handleImportExcel(e)
                                        setIsImportModalOpen(false)
                                    }}
                                />
                            </div>
                            <div className="form-group">
                                <label>Lưu ý định dạng cột (theo thứ tự):</label>
                                <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                                    <li>Họ và tên</li>
                                    <li>Email</li>
                                    <li>SĐT</li>
                                    <li>Tên đăng nhập (tùy chọn)</li>
                                    <li>Vai trò (tùy chọn, mặc định user)</li>
                                    <li>Mật khẩu (tùy chọn, mặc định 123456)</li>
                                    <li>Chi nhánh</li>
                                    <li>Bộ phận</li>
                                    <li>Vị trí</li>
                                    <li>Trạng thái</li>
                                    <li>Ngày vào làm</li>
                                    <li>Ngày chính thức</li>
                                    <li>CCCD</li>
                                    <li>Ngày cấp</li>
                                    <li>Nơi cấp</li>
                                    <li>Quê quán</li>
                                    <li>Giới tính</li>
                                    <li>Tình trạng hôn nhân</li>
                                    <li>Link ảnh (tùy chọn)</li>
                                </ul>
                                <small>Hàng đầu tiên là header. Các cột dữ liệu có thể để trống, hệ thống sẽ bỏ qua dòng trống hoàn toàn.</small>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button className="btn" onClick={() => setIsImportModalOpen(false)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
    */
}

export default Employees
