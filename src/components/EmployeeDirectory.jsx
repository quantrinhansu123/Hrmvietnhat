import { useEffect, useMemo, useRef, useState } from 'react'
import EmployeeModal from './EmployeeModal'
import StatusHistoryView from './StatusHistoryView'

const getName = employee => employee.ho_va_ten || employee.name || employee.Tên || 'Chưa cập nhật'
const getStatus = employee => employee.trang_thai || employee.status || 'Chưa cập nhật'
const isManager = employee => ['admin', 'manager', 'quản trị'].includes(String(employee.role || '').toLowerCase())

const getPositionText = employee =>
  `${employee.vi_tri || ''} ${employee.ma_vi_tri || ''} ${employee.Cong_Viec || ''} ${employee.cong_viec || ''}`.toLocaleLowerCase('vi')

const getPositionRank = employee => {
  const value = getPositionText(employee)
  const code = String(employee.ma_vi_tri || employee.vi_tri || '').trim().toUpperCase()

  // Trưởng phòng lên đầu trong phòng
  if (
    (value.includes('trưởng phòng') || value.includes('truong phong') || value.includes('trưởng bộ phận') || value.includes('giám đốc phòng')) &&
    !value.includes('phó')
  ) return 1
  if (code === 'TP' || code === 'TBP') return 1

  // Phó phòng thứ 2
  if (value.includes('phó phòng') || value.includes('pho phong') || value.includes('phó bộ phận')) return 2
  if (code === 'PP' || code === 'PBP') return 2

  return 3
}

const getPositionTone = rank => {
  if (rank === 1) return 'head'
  if (rank === 2) return 'deputy'
  return ''
}

function EmployeeDirectory({
    employees, filteredEmployees, activeTab, setActiveTab, searchTerm, setSearchTerm,
    filterBranch, setFilterBranch, filterDept, setFilterDept, filterStatus, setFilterStatus,
    selectedEmployee, setSelectedEmployee, isModalOpen, setIsModalOpen, isReadOnly, setIsReadOnly,
    onReload, onExport, onImport, onDelete
}) {
    const importInputRef = useRef(null)
    const [positionFilter, setPositionFilter] = useState('')
    const [roleFilter, setRoleFilter] = useState('')
    const [selectedIds, setSelectedIds] = useState([])
    const [viewMode, setViewMode] = useState('table')
    const [selectedPosition, setSelectedPosition] = useState(null)
    const [chartLayout, setChartLayout] = useState({ positions: {}, parents: {} })
    const [connectFrom, setConnectFrom] = useState(null)
    const chartCanvasRef = useRef(null)
    const dragNodeRef = useRef(null)

    const activeEmployees = useMemo(
        () => employees.filter(employee => getStatus(employee) !== 'Nghỉ việc'),
        [employees]
    )
    const branches = [...new Set(activeEmployees.map(employee => employee.chi_nhanh).filter(Boolean))].sort()
    const employeesInBranch = activeEmployees.filter(employee =>
        !filterBranch ||
        (filterBranch === '__none__' ? !employee.chi_nhanh : employee.chi_nhanh === filterBranch)
    )
    const departments = [...new Set(employeesInBranch.map(employee => employee.bo_phan).filter(Boolean))].sort()
    const positions = [...new Set(employeesInBranch.map(employee => employee.vi_tri).filter(Boolean))].sort()
    const displayEmployees = useMemo(() => {
        return filteredEmployees
            .filter(employee =>
                (!positionFilter || employee.vi_tri === positionFilter) &&
                (!roleFilter || (roleFilter === 'manager' ? isManager(employee) : !isManager(employee)))
            )
            .slice()
            .sort((a, b) => {
                const deptA = a.bo_phan || 'zzz'
                const deptB = b.bo_phan || 'zzz'
                const deptCompare = deptA.localeCompare(deptB, 'vi')
                if (deptCompare !== 0) return deptCompare

                const rankCompare = getPositionRank(a) - getPositionRank(b)
                if (rankCompare !== 0) return rankCompare

                return getName(a).localeCompare(getName(b), 'vi')
            })
    }, [filteredEmployees, positionFilter, roleFilter])
    const managerCount = activeEmployees.filter(isManager).length
    const activeCount = employees.filter(employee => getStatus(employee) !== 'Nghỉ việc').length
    const lockedCount = employees.length - activeCount
    const allSelected = displayEmployees.length > 0 && displayEmployees.every(employee => selectedIds.includes(employee.id))
    const positionGroups = useMemo(() => {
        const groups = new Map()
        displayEmployees.forEach(employee => {
            const position = employee.vi_tri || 'Chưa cập nhật vị trí'
            if (!groups.has(position)) groups.set(position, [])
            groups.get(position).push(employee)
        })

        const getLevel = position => {
            const value = position.toLocaleLowerCase('vi')
            if ((value.includes('tổng giám đốc') || value === 'giám đốc') && !value.includes('phó')) return 1
            if (value.includes('phó tổng giám đốc') || value.includes('phó giám đốc')) return 2
            if (value.includes('trưởng phòng') || value.includes('trưởng bộ phận') || value.includes('giám đốc phòng')) return 3
            if (value.includes('phó phòng') || value.includes('trưởng nhóm') || value.includes('team lead')) return 4
            return 5
        }

        return [...groups.entries()]
            .map(([position, people]) => ({
                position,
                people,
                department: people.map(item => item.bo_phan).find(Boolean) || 'Chưa phân phòng',
                level: getLevel(position)
            }))
            .sort((a, b) => a.level - b.level || a.position.localeCompare(b.position, 'vi'))
    }, [displayEmployees])
    const positionGroupKey = positionGroups.map(group => group.position).join('|')
    const selectedPositionPeople = selectedPosition
        ? positionGroups.find(group => group.position === selectedPosition)?.people || []
        : []

    useEffect(() => {
        if (!positionGroups.length) return
        let saved = {}
        try { saved = JSON.parse(localStorage.getItem('employee_org_chart_layout') || '{}') } catch { saved = {} }
        const positions = { ...(saved.positions || {}) }
        const parents = { ...(saved.parents || {}) }
        const levelIndexes = {}
        positionGroups.forEach(group => {
            if (!positions[group.position]) {
                const index = levelIndexes[group.level] || 0
                const count = positionGroups.filter(item => item.level === group.level).length
                positions[group.position] = {
                    x: Math.max(35, 650 + (index - (count - 1) / 2) * 290),
                    y: 35 + (group.level - 1) * 155
                }
                levelIndexes[group.level] = index + 1
            }
        })
        Object.keys(positions).forEach(key => {
            if (!positionGroups.some(group => group.position === key)) delete positions[key]
        })
        Object.keys(parents).forEach(child => {
            if (!positions[child] || !positions[parents[child]]) delete parents[child]
        })
        setChartLayout({ positions, parents })
    }, [positionGroupKey])

    const saveChartLayout = next => {
        setChartLayout(next)
        localStorage.setItem('employee_org_chart_layout', JSON.stringify(next))
    }

    const startNodeDrag = (event, position) => {
        if (event.button !== 0 || event.target.closest('button')) return
        const canvas = chartCanvasRef.current
        const point = chartLayout.positions[position]
        if (!canvas || !point) return
        const rect = canvas.getBoundingClientRect()
        dragNodeRef.current = {
            position,
            offsetX: event.clientX - rect.left + canvas.scrollLeft - point.x,
            offsetY: event.clientY - rect.top + canvas.scrollTop - point.y
        }
        event.currentTarget.setPointerCapture?.(event.pointerId)
    }

    const moveNode = event => {
        const drag = dragNodeRef.current
        const canvas = chartCanvasRef.current
        if (!drag || !canvas) return
        const rect = canvas.getBoundingClientRect()
        const x = Math.max(15, event.clientX - rect.left + canvas.scrollLeft - drag.offsetX)
        const y = Math.max(15, event.clientY - rect.top + canvas.scrollTop - drag.offsetY)
        setChartLayout(current => ({
            ...current,
            positions: { ...current.positions, [drag.position]: { x, y } }
        }))
    }

    const finishNodeDrag = () => {
        if (!dragNodeRef.current) return
        dragNodeRef.current = null
        localStorage.setItem('employee_org_chart_layout', JSON.stringify(chartLayout))
    }

    const handleChartNodeClick = position => {
        if (connectFrom) {
            if (connectFrom !== position) {
                saveChartLayout({
                    ...chartLayout,
                    parents: { ...chartLayout.parents, [position]: connectFrom }
                })
            }
            setConnectFrom(null)
            return
        }
        setSelectedPosition(position)
    }

    const resetChartLayout = () => {
        localStorage.removeItem('employee_org_chart_layout')
        const positions = {}
        const levelIndexes = {}
        positionGroups.forEach(group => {
            const index = levelIndexes[group.level] || 0
            const count = positionGroups.filter(item => item.level === group.level).length
            positions[group.position] = { x: Math.max(35, 650 + (index - (count - 1) / 2) * 290), y: 35 + (group.level - 1) * 155 }
            levelIndexes[group.level] = index + 1
        })
        saveChartLayout({ positions, parents: {} })
        setConnectFrom(null)
    }

    const openEmployee = (employee, readOnly = true) => {
        setSelectedEmployee(employee)
        setIsReadOnly(readOnly)
        setIsModalOpen(true)
    }

    const toggleAll = () => {
        const visibleIds = displayEmployees.map(employee => employee.id).filter(Boolean)
        setSelectedIds(allSelected ? selectedIds.filter(id => !visibleIds.includes(id)) : [...new Set([...selectedIds, ...visibleIds])])
    }

    const toggleOne = id => {
        if (!id) return
        setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
    }

    const resetFilters = () => {
        setSearchTerm('')
        setFilterBranch?.('')
        setFilterDept('')
        setFilterStatus('')
        setPositionFilter('')
        setRoleFilter('')
        onReload()
    }

    return (
        <div className="employees-page employee-accounts">
            <div className="employee-accounts__top">
                <div className="employee-accounts__summary">
                    <button className="active" onClick={() => setActiveTab('list')}>
                        <span className="employee-accounts__summary-icon"><i className="far fa-address-book"></i></span>
                        <strong>{employees.length} nhân viên</strong>
                    </button>
                    <span><strong>{activeCount}</strong> hoạt động · <strong>{lockedCount}</strong> đã nghỉ</span>
                    <span><strong>{managerCount}</strong> quản trị · <strong>{Math.max(0, employees.length - managerCount)}</strong> nhân viên</span>
                </div>
                <button className="employee-history-link" onClick={() => setActiveTab(activeTab === 'history' ? 'list' : 'history')}>
                    {activeTab === 'history' ? 'Danh sách' : 'Lịch sử biến động'} <i className="fas fa-chevron-down"></i>
                </button>
            </div>

            {activeTab === 'history' ? (
                <StatusHistoryView employees={employees} onDataChange={onReload} />
            ) : (
                <>
                    <div className="employee-accounts__toolbar">
                        <label className="employees-search">
                            <i className="fas fa-search"></i>
                            <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Tìm theo tên, mã NV, email..." />
                        </label>
                        <select
                            value={filterBranch || ''}
                            onChange={event => {
                                setFilterBranch?.(event.target.value)
                                setFilterDept('')
                                setPositionFilter('')
                            }}
                        >
                            <option value="">Chi nhánh</option>
                            {branches.map(value => <option key={value} value={value}>{value}</option>)}
                            {activeEmployees.some(employee => !employee.chi_nhanh) && (
                                <option value="__none__">Chưa có chi nhánh</option>
                            )}
                        </select>
                        <select value={filterDept} onChange={event => setFilterDept(event.target.value)}>
                            <option value="">Phòng ban</option>
                            {departments.map(value => <option key={value} value={value}>{value}</option>)}
                        </select>
                        <select value={positionFilter} onChange={event => setPositionFilter(event.target.value)}>
                            <option value="">Chức vụ</option>
                            {positions.map(value => <option key={value} value={value}>{value}</option>)}
                        </select>
                        <select value={roleFilter} onChange={event => setRoleFilter(event.target.value)}>
                            <option value="">Vai trò</option>
                            <option value="manager">Quản trị</option>
                            <option value="employee">Nhân viên</option>
                        </select>
                        <select value={filterStatus} onChange={event => setFilterStatus(event.target.value)}>
                            <option value="">Trạng thái</option>
                            <option value="Đang làm">Đang làm</option>
                            <option value="Thử việc">Thử việc</option>
                            <option value="Chính thức">Chính thức</option>
                            <option value="Tạm nghỉ">Tạm nghỉ</option>
                            <option value="Nghỉ việc">Đã nghỉ</option>
                        </select>
                        <div className="employee-accounts__actions">
                            <div className="employee-view-switch" aria-label="Chế độ hiển thị">
                                <button className={viewMode === 'table' ? 'active' : ''} title="Danh sách" onClick={() => setViewMode('table')}><i className="fas fa-list"></i></button>
                                <button className={viewMode === 'chart' ? 'active' : ''} title="Sơ đồ tổ chức" onClick={() => setViewMode('chart')}><i className="fas fa-sitemap"></i></button>
                            </div>
                            <button className="btn btn-primary" onClick={() => openEmployee(null, false)}><i className="fas fa-plus"></i> Thêm mới</button>
                            <button className="btn btn-icon" title="Làm mới" onClick={resetFilters}><i className="fas fa-rotate"></i></button>
                            <button className="btn btn-icon" title="Nhập Excel" onClick={() => importInputRef.current?.click()}><i className="fas fa-file-arrow-up"></i></button>
                            <button className="btn btn-icon" title="Xuất Excel" onClick={onExport}><i className="fas fa-download"></i></button>
                            <input ref={importInputRef} className="employees-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={onImport} />
                        </div>
                    </div>

                    {viewMode === 'table' ? <div className="employees-table-wrap employee-accounts__table-wrap">
                        <table className="employees-table employee-accounts__table">
                            <thead>
                                <tr>
                                    <th><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Chọn tất cả" /></th>
                                    <th>Mã NV <i className="fas fa-sort"></i></th>
                                    <th>Nhân viên <i className="fas fa-sort"></i></th>
                                    <th>Tên đăng nhập</th>
                                    <th>Chi nhánh</th>
                                    <th>Phòng ban</th>
                                    <th>Chức vụ</th>
                                    <th>Vai trò</th>
                                    <th>Trạng thái</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayEmployees.map((employee, index) => {
                                    const name = getName(employee)
                                    const status = getStatus(employee)
                                    const avatar = employee.avatarDataUrl || employee.avatarUrl || employee.avatar
                                    const manager = isManager(employee)
                                    const code = employee.employeeId || `NV${String(index + 1).padStart(4, '0')}`
                                    const positionRank = getPositionRank(employee)
                                    const positionTone = getPositionTone(positionRank)
                                    return (
                                        <tr key={employee.id || index} className={positionTone ? `is-${positionTone}` : undefined}>
                                            <td><input type="checkbox" checked={selectedIds.includes(employee.id)} onChange={() => toggleOne(employee.id)} aria-label={`Chọn ${name}`} /></td>
                                            <td><strong className="employee-code">{code}</strong></td>
                                            <td>
                                                <div className="employee-identity">
                                                    <span className="employee-avatar">{avatar ? <img src={avatar} alt="" /> : name.split(' ').map(part => part[0]).slice(-2).join('')}</span>
                                                    <span><strong>{name}</strong><small>{employee.email || '—'}</small></span>
                                                </div>
                                            </td>
                                            <td>{employee.username || '—'}</td>
                                            <td>{employee.chi_nhanh || '—'}</td>
                                            <td>{employee.bo_phan || '—'}</td>
                                            <td>
                                                <span className={`employee-position-badge ${positionTone || 'staff'}`}>
                                                    {employee.vi_tri || '—'}
                                                </span>
                                            </td>
                                            <td><span className={`employee-role ${manager ? 'manager' : ''}`}>{manager ? 'Quản trị' : 'Nhân viên'}</span></td>
                                            <td><span className={`employee-account-status ${status === 'Nghỉ việc' ? 'inactive' : ''}`}>{status === 'Nghỉ việc' ? 'Đã nghỉ' : 'Hoạt động'}</span></td>
                                            <td>
                                                <div className="employee-row-actions">
                                                    <button className="view" title="Xem hồ sơ" onClick={() => openEmployee(employee)}><i className="fas fa-eye"></i></button>
                                                    <button className="edit" title="Chỉnh sửa" onClick={() => openEmployee(employee, false)}><i className="fas fa-pen"></i></button>
                                                    <button className="delete" title="Xóa" onClick={() => onDelete?.(employee.id, name)}><i className="fas fa-trash-can"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        {!displayEmployees.length && <div className="employee-card-empty">Không tìm thấy nhân viên phù hợp</div>}
                    </div> : (
                        <section className="org-chart">
                            <div className="org-chart__heading">
                                <div>
                                    <strong>Sơ đồ vị trí</strong>
                                    <span>{positionGroups.length} vị trí · {displayEmployees.length} nhân sự</span>
                                </div>
                                <div className="org-chart__tools">
                                    {connectFrom && <span className="org-chart__connecting"><i className="fas fa-link"></i> Chọn vị trí con của “{connectFrom}”</span>}
                                    <button onClick={resetChartLayout}><i className="fas fa-rotate-left"></i> Đặt lại</button>
                                </div>
                            </div>
                            <div
                                className={`org-chart__canvas ${connectFrom ? 'is-connecting' : ''}`}
                                ref={chartCanvasRef}
                                onPointerMove={moveNode}
                                onPointerUp={finishNodeDrag}
                                onPointerCancel={finishNodeDrag}
                            >
                                {positionGroups.length ? (
                                    <div className="org-chart__workspace" style={{ height: Math.max(650, ...Object.values(chartLayout.positions).map(point => point.y + 160)) }}>
                                        <svg className="org-chart__lines">
                                            {Object.entries(chartLayout.parents).map(([child, parent]) => {
                                                const from = chartLayout.positions[parent]
                                                const to = chartLayout.positions[child]
                                                if (!from || !to) return null
                                                const x1 = from.x + 123
                                                const y1 = from.y + 98
                                                const x2 = to.x + 123
                                                const y2 = to.y
                                                const midY = y1 + (y2 - y1) / 2
                                                return <path key={`${parent}-${child}`} d={`M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`} />
                                            })}
                                        </svg>
                                        {positionGroups.map(group => {
                                            const point = chartLayout.positions[group.position] || { x: 35, y: 35 }
                                            return (
                                                <article
                                                    className={`org-position-card ${connectFrom === group.position ? 'is-source' : ''}`}
                                                    key={group.position}
                                                    style={{ left: point.x, top: point.y }}
                                                    onPointerDown={event => startNodeDrag(event, group.position)}
                                                    onClick={() => handleChartNodeClick(group.position)}
                                                >
                                                    <span className="org-position-card__icon"><i className="fas fa-briefcase"></i></span>
                                                    <span className="org-position-card__body">
                                                        <strong>{group.position}</strong>
                                                        <small>Phòng: {group.department}</small>
                                                        <span><i className="fas fa-user-group"></i> {group.people.length} nhân sự</span>
                                                    </span>
                                                    <span className="org-position-card__controls">
                                                        <button title="Tạo nhánh con" onClick={event => { event.stopPropagation(); setConnectFrom(current => current === group.position ? null : group.position) }}><i className="fas fa-code-branch"></i></button>
                                                        {chartLayout.parents[group.position] && <button title="Gỡ khỏi nhánh" onClick={event => { event.stopPropagation(); const parents = { ...chartLayout.parents }; delete parents[group.position]; saveChartLayout({ ...chartLayout, parents }) }}><i className="fas fa-link-slash"></i></button>}
                                                    </span>
                                                </article>
                                            )
                                        })}
                                    </div>
                                ) : <div className="employee-card-empty">Chưa có dữ liệu vị trí để hiển thị sơ đồ</div>}
                            </div>
                        </section>
                    )}
                </>
            )}

            <EmployeeModal employee={selectedEmployee} isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedEmployee(null); setIsReadOnly(false) }} onSave={onReload} readOnly={isReadOnly} departmentOptions={departments} positionOptions={positions} />
            {selectedPosition && (
                <div className="modal show org-people-modal" onClick={() => setSelectedPosition(null)}>
                    <div className="modal-content" onClick={event => event.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <span className="org-people-modal__eyebrow">DANH SÁCH NHÂN SỰ</span>
                                <h3>{selectedPosition}</h3>
                                <p>{selectedPositionPeople.length} nhân sự đang đảm nhiệm vị trí</p>
                            </div>
                            <button className="modal-close" onClick={() => setSelectedPosition(null)}>&times;</button>
                        </div>
                        <div className="modal-body org-people-modal__body">
                            {selectedPositionPeople.map((employee, index) => {
                                const name = getName(employee)
                                const avatar = employee.avatarDataUrl || employee.avatarUrl || employee.avatar
                                return (
                                    <button className="org-person-row" key={employee.id || index} onClick={() => { setSelectedPosition(null); openEmployee(employee) }}>
                                        <span className="employee-avatar">{avatar ? <img src={avatar} alt="" /> : name.split(' ').map(part => part[0]).slice(-2).join('')}</span>
                                        <span className="org-person-row__info"><strong>{name}</strong><small>{employee.employeeId || 'Chưa có mã NV'} · {employee.bo_phan || 'Chưa phân phòng'}</small></span>
                                        <span className="org-person-row__contact">{employee.email || employee.sdt || employee.sđt || '—'}</span>
                                        <i className="fas fa-chevron-right"></i>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default EmployeeDirectory
