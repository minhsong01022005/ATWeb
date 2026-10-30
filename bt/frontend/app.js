/* Smart HR browser client. Set window.SMART_HR_API to change the API address. */
(() => {
  const API = window.SMART_HR_API || 'http://127.0.0.1:8000/api';
  const tokenKey = 'smarthr_access_token';
  const departments = [
    'Phòng Hành chính - Nhân sự',
    'Phòng Tài chính - Kế toán',
    'Phòng Công nghệ / Phát triển Sản phẩm',
    'Phòng Kinh doanh & Tiếp thị'
  ];
  const departmentOptions = selected => departments.map(name => `<option value="${esc(name)}" ${name===selected?'selected':''}>${esc(name)}</option>`).join('');
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateText = value => value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${String(value).slice(0,10)}T00:00:00`)) : '—';
  let activePage = 'Tổng quan';
  let currentUser = null;
  let toastTimer;

  const style = document.createElement('style');
  style.textContent = `.login-screen{position:fixed;inset:0;background:#f5f7f4;z-index:20;display:grid;place-items:center;padding:18px}.login-box{width:min(420px,100%);background:white;padding:34px;border:1px solid #e9ede9;border-radius:18px;box-shadow:0 20px 70px #173c2e12}.login-box h2{font:700 24px Manrope;margin:24px 0 6px}.login-box p{font-size:13px;color:#77827d;margin-bottom:22px}.field{display:grid;gap:6px;margin:12px 0}.field label{font-size:11px;color:#53615a;font-weight:700}.field input,.field select,.field textarea,.toolbar input,.toolbar select{border:1px solid #e9ede9;border-radius:8px;padding:10px 11px;outline:none;color:#17211e;background:white}.field input:focus,.field select:focus,.field textarea:focus,.toolbar input:focus{border-color:#80ab91;box-shadow:0 0 0 3px #e8f3ed}.login-box .primary{width:100%;margin-top:9px}.login-error{color:#b45040;font-size:11px;min-height:16px;margin-top:8px}.managed{display:none}.managed.active{display:block}.toolbar{display:flex;gap:8px;align-items:center;margin:12px 0 16px;flex-wrap:wrap}.toolbar input{min-width:210px}.data-table{width:100%;border-collapse:collapse}.data-table th{font-size:10px;color:#929c96;text-align:left;padding:11px;border-bottom:1px solid #e9ede9}.data-table td{padding:12px 11px;border-bottom:1px solid #f0f2f0;font-size:12px}.empty{padding:28px;text-align:center;color:#77827d;font-size:12px}.small-btn{border:1px solid #e9ede9;border-radius:7px;background:white;padding:6px 9px;color:#216b51;font-size:10px;font-weight:700}.small-btn.danger{color:#b45040}.modal-backdrop{position:fixed;inset:0;background:#10271dcc;z-index:25;display:grid;place-items:center;padding:18px}.modal{width:min(470px,100%);max-height:90vh;overflow:auto;background:white;padding:23px;border-radius:14px;box-shadow:0 16px 60px #0003}.modal h2{font:700 17px Manrope;margin:0 0 12px}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.secondary{border:1px solid #e9ede9;background:white;border-radius:8px;padding:10px 13px;color:#59635e}`;
  document.head.append(style);

  window.toast = message => {
    let el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.append(el); }
    el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  };

  async function request(path, options = {}) {
    const headers = {'Content-Type':'application/json', ...(options.headers || {})};
    const token = localStorage.getItem(tokenKey);
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try { response = await fetch(`${API}${path}`, {...options, headers}); }
    catch { throw new Error('Không kết nối được API. Hãy kiểm tra backend đã chạy tại ' + API); }
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (response.status === 401 && path !== '/auth/login') { localStorage.removeItem(tokenKey); showLogin(); }
    if (!response.ok) throw new Error(payload?.detail || `Lỗi API (${response.status})`);
    return payload;
  }

  function showLogin() {
    let overlay = $('.login-screen');
    if (!overlay) {
      overlay = document.createElement('div'); overlay.className = 'login-screen';
      overlay.innerHTML = `<form class="login-box"><div class="brand" style="padding:0"><span class="brandmark">✳</span><span>smart<span style="color:#216b51">HR</span><small>PEOPLE & CULTURE</small></span></div><h2>Đăng nhập hệ thống</h2><p>Đăng nhập để quản lý nhân sự Smart HR.</p><div class="field"><label>Tên đăng nhập</label><input name="username" autocomplete="username" value="admin" required></div><div class="field"><label>Mật khẩu</label><input name="password" type="password" autocomplete="current-password" required></div><button class="primary" type="submit">Đăng nhập</button><div class="login-error"></div><div style="font-size:10px;color:#929c96;margin-top:12px"></div></form>`;
      document.body.append(overlay);
      $('.login-box', overlay).addEventListener('submit', async event => {
        event.preventDefault(); const form = new FormData(event.currentTarget); const btn = $('button', event.currentTarget); btn.disabled = true; btn.textContent = 'Đang đăng nhập…';
        try { const result = await request('/auth/login', {method:'POST', body:JSON.stringify({username:form.get('username'), password:form.get('password')})}); localStorage.setItem(tokenKey, result.access_token); overlay.remove(); updateUser(result.user); await refreshDashboard(); }
        catch (error) { $('.login-error', overlay).textContent = error.message; }
        finally { btn.disabled = false; btn.textContent = 'Đăng nhập'; }
      });
    }
    overlay.style.display = 'grid';
  }

  function updateUser(user) {
    currentUser = user;
    const side = $('.user'); if (side && user) { const label = $('strong', side); if (label) label.textContent = user.name; const role = $('span', side); if (role) role.textContent = user.role === 'admin' ? 'Quản trị viên' : (user.department || 'Tài khoản phòng ban'); }
    const greeting = $('.welcome h1'); if (greeting && user) greeting.innerHTML = `Chào ${esc(user.name)} <span style="font-size:23px">☀️</span>`;
    document.querySelectorAll('[onclick*="addEmployee"]').forEach(button => { button.style.display = user?.role === 'admin' ? '' : 'none'; });
  }
  const isAdmin = () => currentUser?.role === 'admin';

  const content = $('.content');
  const managed = document.createElement('section'); managed.className = 'managed'; managed.id = 'managed-page';
  $('.welcome').insertAdjacentElement('afterend', managed);
  const dashNodes = [$('.stats'), $('.grid'), $('.lower')].filter(Boolean);
  function showDashboard(show) { dashNodes.forEach(node => node.style.display = show ? '' : 'none'); managed.classList.toggle('active', !show); }
  function pageHead(title, description, action = '') { return `<div class="panel-head"><div><div class="eyebrow">SMART HR</div><h2 class="panel-title" style="font-size:18px">${esc(title)}</h2><span class="subtle">${esc(description)}</span></div>${action}</div>`; }
  const actionButton = (label, onclick) => isAdmin() ? `<button class="primary" onclick="${onclick}"><span class="plus">＋</span>${esc(label)}</button>` : '';
  function table(headers, rows, empty = 'Chưa có dữ liệu') { return `<div class="card panel table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="empty">${esc(empty)}</td></tr>`}</tbody></table></div>`; }

  async function renderEmployees(search = '') {
    managed.innerHTML = pageHead('Danh sách nhân viên','Tìm kiếm và quản lý hồ sơ nhân sự.',actionButton('Thêm nhân viên','openEmployeeForm()')) + `<div class="toolbar"><input id="employee-search" placeholder="Tìm tên hoặc mã nhân viên…" value="${esc(search)}"><span class="subtle" id="employee-count"></span></div><div id="employee-table"></div>`;
    const input = $('#employee-search'); let debounce;
    input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => loadEmployees(input.value), 250); });
    await loadEmployees(search);
  }
  async function loadEmployees(search = '') {
    try {
      const rows = await request('/employees?q=' + encodeURIComponent(search));
      $('#employee-count').textContent = `${rows.length} nhân viên`;
      $('#employee-table').innerHTML = table(['MÃ NV','NHÂN VIÊN','PHÒNG BAN','CHỨC VỤ','NGÀY VÀO','THAO TÁC'], rows.map(e=>`<tr><td>${esc(e.code)}</td><td><b>${esc(e.full_name)}</b><div class="subtle">${esc(e.email || '—')}</div></td><td>${esc(e.department)}</td><td>${esc(e.position)}</td><td>${dateText(e.join_date)}</td><td>${isAdmin()?`<button class="small-btn" onclick="editEmployee(${e.id})">Sửa</button> <button class="small-btn danger" onclick="deleteEmployee(${e.id})">Xóa</button>`:'—'}</td></tr>`).join(''), 'Không tìm thấy nhân viên');
    } catch (e) { $('#employee-table').innerHTML = `<div class="card empty">${esc(e.message)}</div>`; }
  }

  async function renderAttendance() {
    managed.innerHTML = pageHead('Chấm công','Theo dõi giờ vào, giờ ra và tình trạng làm việc.',actionButton('Ghi nhận chấm công','openAttendanceForm()')) + `<div class="toolbar"><input id="attendance-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div id="attendance-table"></div>`;
    $('#attendance-date').addEventListener('change', loadAttendance); await loadAttendance();
  }
  async function loadAttendance() {
    try { const rows = await request('/attendance?work_date=' + $('#attendance-date').value); $('#attendance-table').innerHTML = table(['NHÂN VIÊN','NGÀY','GIỜ VÀO','GIỜ RA','TRẠNG THÁI'], rows.map(a=>`<tr><td><b>${esc(a.employee_name)}</b><div class="subtle">${esc(a.employee_code)}</div></td><td>${dateText(a.work_date)}</td><td>${esc(a.check_in || '—')}</td><td>${esc(a.check_out || '—')}</td><td><span class="status ${a.status==='on_time'?'on':'leave'}">${a.status==='on_time'?'Đúng giờ':'Đi muộn/Về sớm'}</span></td></tr>`).join(''), 'Chưa có bản ghi chấm công ngày này'); }
    catch(e) { $('#attendance-table').innerHTML = `<div class="card empty">${esc(e.message)}</div>`; }
  }

  async function renderLeaves() {
    managed.innerHTML = pageHead('Nghỉ phép','Tiếp nhận và xét duyệt yêu cầu nghỉ phép.',actionButton('Tạo đơn nghỉ phép','openLeaveForm()')) + `<div class="toolbar"><select id="leave-filter"><option value="">Tất cả trạng thái</option><option value="pending">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="rejected">Từ chối</option></select></div><div id="leave-table"></div>`;
    $('#leave-filter').addEventListener('change', loadLeaves); await loadLeaves();
  }

  async function renderPayroll() {
    managed.innerHTML = pageHead('Bảng lương','Lương hiện tại và mã số thẻ của nhân viên.') + `<div id="payroll-table"></div>`;
    try {
      const rows = await request('/payroll');
      const money = new Intl.NumberFormat('vi-VN', {maximumFractionDigits:0});
      $('#payroll-table').innerHTML = table(['MÃ NHÂN VIÊN','NHÂN VIÊN','PHÒNG BAN','MÃ SỐ THẺ','LƯƠNG THÁNG','THAO TÁC'], rows.map(row => {
        const salary = Number(row.salary_amount || 0);
        const cardNumber = String(row.card_number || '').trim();
        const displayedSalary = salary === 0 ? '<span class="status leave">Đã che: 0 ₫</span>' : `${money.format(salary)} ₫`;
        return `<tr><td>${esc(row.employee_code)}</td><td><b>${esc(row.full_name)}</b></td><td>${esc(row.department)}</td><td><code>${cardNumber ? esc(cardNumber) : '••••'}</code></td><td>${displayedSalary}</td><td>${isAdmin()?`<button class="small-btn" onclick="updateSalary(${row.id}, ${salary})">Cập nhật lương</button>`:'—'}</td></tr>`;
      }).join(''), 'Chưa có nhân viên để hiển thị');
    } catch (error) { $('#payroll-table').innerHTML = `<div class="card empty">${esc(error.message)}</div>`; }
  }  async function loadLeaves() {
    try { const filter=$('#leave-filter').value; const rows=await request('/leaves'+(filter?'?status='+filter:'')); $('#leave-table').innerHTML=table(['NHÂN VIÊN','THỜI GIAN','LÝ DO','TRẠNG THÁI','THAO TÁC'],rows.map(r=>`<tr><td><b>${esc(r.employee_name)}</b><div class="subtle">${esc(r.employee_code)}</div></td><td>${dateText(r.start_date)} – ${dateText(r.end_date)}</td><td>${esc(r.reason)}</td><td>${esc(({pending:'Chờ duyệt',approved:'Đã duyệt',rejected:'Từ chối'})[r.status]||r.status)}</td><td>${isAdmin()&&r.status==='pending'?`<button class="small-btn" onclick="decideLeave(${r.id},'approved')">Duyệt</button> <button class="small-btn danger" onclick="decideLeave(${r.id},'rejected')">Từ chối</button>`:'—'}</td></tr>`).join(''),'Chưa có yêu cầu nghỉ phép'); }
    catch(e) { $('#leave-table').innerHTML=`<div class="card empty">${esc(e.message)}</div>`; }
  }

  function modal(title, fields, onSubmit) {
    document.querySelector('.modal-backdrop')?.remove(); const backdrop=document.createElement('div'); backdrop.className='modal-backdrop';
    backdrop.innerHTML=`<form class="modal"><h2>${esc(title)}</h2>${fields}<div class="login-error"></div><div class="modal-actions"><button type="button" class="secondary" data-cancel>Hủy</button><button class="primary" type="submit">Lưu</button></div></form>`; document.body.append(backdrop);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop||e.target.closest('[data-cancel]'))backdrop.remove();});
    $('.modal',backdrop).addEventListener('submit',async e=>{e.preventDefault();const btn=$('button[type=submit]',e.currentTarget);btn.disabled=true;try{await onSubmit(new FormData(e.currentTarget));backdrop.remove();}catch(err){$('.login-error',backdrop).textContent=err.message;}finally{btn.disabled=false;}});
  }
  window.openEmployeeForm = () => modal('Thêm nhân viên', `<div class="field"><label>Họ và tên *</label><input name="full_name" required minlength="2"></div><div class="field"><label>Email</label><input name="email" type="email"></div><div class="field"><label>Mã số thẻ *</label><input name="card_number" required minlength="3" maxlength="40" placeholder="VD: CARD-0009"></div><div class="field"><label>Phòng ban</label><select name="department">${departmentOptions(departments[0])}</select></div><div class="field"><label>Chức vụ</label><input name="position" value="Nhân viên"></div><div class="field"><label>Ngày vào làm</label><input name="join_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></div><p class="subtle">Lương khởi điểm: 10.000.000 ₫ (tự động áp dụng)</p>`, async form=>{await request('/employees',{method:'POST',body:JSON.stringify(Object.fromEntries(form))});toast('Đã thêm nhân viên');await (activePage==='Nhân viên'?renderEmployees():refreshDashboard());});
  window.editEmployee = async id => {try{const e=(await request('/employees')).find(x=>x.id===id);if(!e)throw new Error('Không tìm thấy nhân viên');modal('Cập nhật nhân viên',`<div class="field"><label>Họ và tên *</label><input name="full_name" value="${esc(e.full_name)}" required minlength="2"></div><div class="field"><label>Email</label><input name="email" type="email" value="${esc(e.email||'')}"></div><div class="field"><label>Mã số thẻ *</label><input name="card_number" value="${esc(e.card_number)}" required minlength="3" maxlength="40"></div><div class="field"><label>Phòng ban</label><select name="department">${departmentOptions(e.department)}</select></div><div class="field"><label>Chức vụ</label><input name="position" value="${esc(e.position)}"></div><div class="field"><label>Ngày vào làm</label><input name="join_date" type="date" value="${esc(e.join_date)}" required></div>`,async form=>{await request(`/employees/${id}`,{method:'PATCH',body:JSON.stringify(Object.fromEntries(form))});toast('Đã cập nhật hồ sơ');await renderEmployees($('#employee-search')?.value||'');});}catch(error){toast(error.message);}};
  window.deleteEmployee = async id => {
    if (!window.confirm('Xóa nhân viên này? Dữ liệu chấm công và nghỉ phép của họ cũng sẽ bị xóa.')) return;
    try {
      await request(`/employees/${id}`, {method:'DELETE'});
      toast('Đã xóa nhân viên');
      await renderEmployees($('#employee-search')?.value || '');
    } catch (error) { toast(error.message); }
  };
  window.updateSalary = async (id, currentSalary) => {
    modal('Cập nhật lương', `<div class="field"><label>Lương tháng (VNĐ) *</label><input name="salary_amount" type="number" min="1" step="1" inputmode="numeric" value="${currentSalary}" required></div>`, async form => {
      const salary = Number(form.get('salary_amount'));
      await request(`/employees/${id}/salary`, {method:'PATCH', body:JSON.stringify({salary_amount:salary})});
      toast('Đã cập nhật lương');
      await renderPayroll();
    });
  };
  window.openAttendanceForm = async () => { const employees=await request('/employees'); if(!employees.length)return toast('Hãy thêm nhân viên trước'); modal('Ghi nhận chấm công',`<div class="field"><label>Nhân viên</label><select name="employee_id" required>${employees.map(e=>`<option value="${e.id}">${esc(e.code)} · ${esc(e.full_name)}</option>`).join('')}</select></div><div class="field"><label>Ngày</label><input name="work_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></div><div class="field"><label>Giờ vào (24 giờ)</label><input name="check_in" type="text" inputmode="numeric" placeholder="HH:MM" value="09:00" pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$" maxlength="5" required></div><div class="field"><label>Giờ ra (24 giờ)</label><input name="check_out" type="text" inputmode="numeric" placeholder="HH:MM" value="17:00" pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$" maxlength="5" required></div><p class="subtle">Nhập theo dạng 24 giờ, ví dụ 08:30 hoặc 17:45. Đúng giờ khi vào không muộn hơn 09:00 và ra không sớm hơn 17:00.</p>`,async form=>{const values=Object.fromEntries(form);values.employee_id=Number(values.employee_id);await request('/attendance',{method:'POST',body:JSON.stringify(values)});toast('Đã ghi nhận chấm công');refreshDashboard();await renderAttendance();}); };
  window.openLeaveForm = async () => {const employees=await request('/employees');if(!employees.length)return toast('Hãy thêm nhân viên trước');modal('Tạo đơn nghỉ phép',`<div class="field"><label>Nhân viên</label><select name="employee_id" required>${employees.map(e=>`<option value="${e.id}">${esc(e.code)} · ${esc(e.full_name)}</option>`).join('')}</select></div><div class="field"><label>Từ ngày</label><input name="start_date" type="date" required></div><div class="field"><label>Đến ngày</label><input name="end_date" type="date" required></div><div class="field"><label>Lý do</label><textarea name="reason" rows="3" required minlength="2"></textarea></div>`,async form=>{const values=Object.fromEntries(form);values.employee_id=Number(values.employee_id);await request('/leaves',{method:'POST',body:JSON.stringify(values)});toast('Đã tạo đơn nghỉ phép');await renderLeaves();});};
  window.decideLeave = async (id,status) => {try{await request(`/leaves/${id}`,{method:'PATCH',body:JSON.stringify({status})});toast(status==='approved'?'Đã duyệt đơn nghỉ phép':'Đã từ chối đơn');await renderLeaves();}catch(e){toast(e.message);}};

  async function refreshDashboard() {
    try {
      const [summary, employees, activities] = await Promise.all([request('/dashboard'), request('/employees'), request('/activities?limit=4')]);
      const attendanceDate=$('#attendance-today'); if(attendanceDate)attendanceDate.textContent='Hôm nay, '+new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'long'}).format(new Date(`${summary.today}T00:00:00`));
      const values=$$('.stat-value'); if(values[0])values[0].textContent=summary.total_employees; if(values[1])values[1].textContent=summary.present; if(values[2])values[2].textContent=summary.pending_leaves;
      const tbody=$('#employees'); if(tbody)tbody.innerHTML=employees.slice(0,4).map(e=>`<tr><td><div class="employee"><div class="avatar">${esc(e.full_name.split(/\s+/).slice(-2).map(s=>s[0]).join('').toUpperCase())}</div><div><b>${esc(e.full_name)}</b><small>${esc(e.code)}</small></div></div></td><td>${esc(e.department)}</td><td>${dateText(e.join_date)}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">Chưa có nhân viên</td></tr>';
      const activity=$$('.activity'); if(activity.length)activity[0].innerHTML=activities.map(a=>`<div class="activity-item"><div class="activity-dot">${a.category==='leave'?'▧':a.category==='attendance'?'◷':'＋'}</div><div class="activity-text">${esc(a.message)}<small>${dateText(a.created_at)} · ${esc(a.category)}</small></div></div>`).join('')||'<div class="subtle">Chưa có hoạt động</div>';
      const bars=$$('.attendance-list .att-row'); if(bars[0])bars[0].innerHTML=`<span>Đúng giờ</span><span>${summary.on_time} <span class="subtle">/ ${summary.total_employees}</span></span>`; if(bars[1])bars[1].innerHTML=`<span>Đi muộn/Về sớm</span><span>${summary.late_or_early} <span class="subtle">/ ${summary.total_employees}</span></span>`; if(bars[2])bars[2].innerHTML=`<span>Chưa ghi nhận</span><span>${summary.not_recorded} <span class="subtle">/ ${summary.total_employees}</span></span>`;
      const fills=$$('.attendance-list .fill'), pct=n=>summary.total_employees?Math.min(100,Math.round(n/summary.total_employees*100)):0; [summary.on_time,summary.late_or_early,summary.not_recorded].forEach((n,k)=>{if(fills[k])fills[k].style.width=pct(n)+'%';});
    } catch(error) { if(!localStorage.getItem(tokenKey))return; toast(error.message); }
  }

  async function navigate(page) {
    activePage=page; const crumb=$('#crumb');if(crumb)crumb.textContent=page;
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    const welcome=$('.welcome'); if(welcome)welcome.style.display=page==='Tổng quan'?'flex':'none';
    showDashboard(page==='Tổng quan');
    if(page==='Tổng quan'){await refreshDashboard();return;}
    if(page==='Nhân viên')return renderEmployees();
    if(page==='Chấm công')return renderAttendance();
    if(page==='Nghỉ phép')return renderLeaves();
    if(page==='Bảng lương')return renderPayroll();
    if(page==='Báo cáo') {managed.innerHTML=pageHead('Báo cáo','Tổng hợp dữ liệu nhân sự hiện tại.')+`<div class="stats"><article class="card stat"><div class="stat-label">Tổng nhân viên</div><div class="stat-value" id="r-total">—</div></article><article class="card stat"><div class="stat-label">Có mặt hôm nay</div><div class="stat-value" id="r-present">—</div></article><article class="card stat"><div class="stat-label">Đơn chờ duyệt</div><div class="stat-value" id="r-leaves">—</div></article></div>`;try{const d=await request('/dashboard');$('#r-total').textContent=d.total_employees;$('#r-present').textContent=d.present;$('#r-leaves').textContent=d.pending_leaves;}catch(e){toast(e.message);}return;}
    if(page==='Cài đặt'){managed.innerHTML=pageHead('Cài đặt','Thông tin phiên làm việc và API backend.')+`<article class="card panel"><p><b>API:</b> ${esc(API)}</p><p><b>Phiên đăng nhập:</b> Đang hoạt động</p><button class="secondary" onclick="logout()">Đăng xuất</button></article>`;return;}
  }
  window.logout=()=>{localStorage.removeItem(tokenKey);showLogin();toast('Đã đăng xuất');};
  document.querySelectorAll('.nav button').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.page)));
  document.querySelectorAll('[data-nav]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.nav)));
  window.addEmployee=()=>window.openEmployeeForm();
  const now=new Date(); const today=$('#today');if(today)today.textContent=new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(now); const pill=$('#datepill');if(pill)pill.textContent='⌑  '+new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}).format(now); const eyebrow=$('.welcome .eyebrow');if(eyebrow)eyebrow.textContent=new Intl.DateTimeFormat('vi-VN',{weekday:'long'}).format(now)+' · Tuần mới nhiều năng lượng';
  document.addEventListener('DOMContentLoaded',async()=>{if(!localStorage.getItem(tokenKey)){showLogin();return;}try{const user=await request('/auth/me');updateUser(user);await refreshDashboard();}catch{showLogin();}});
})();
