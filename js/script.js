// Dados globais
let professores = [];
let disciplinas = [];
let disciplinasMap = new Map();
let horariosManha = [];
let horariosTarde = [];
let horariosNoite = [];
let cursos = [];
let gradeData = {};
let editModal, conflitosModal, currentEditContext = null, pendingSaveData = null, toast;
let currentFiltroCurso = 'todos';
let currentFiltroPeriodo = 'todos';

const diasSemana = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const periodos = ['manha', 'tarde', 'noite'];

// Configurações do Supabase
const SUPABASE_URL = 'https://akzpntnefqyocmqswqsp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrenBudG5lZnF5b2NtcXN3cXNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTgxNTMsImV4cCI6MjA5MzIzNDE1M30.TdBmACGxvuvXpTQRmLOHt9cvxWppReIZa9XSq8sDzWk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Inicialização segura
async function init() {
    try {
        mostrarLoading(true);
        await carregarTodosOsDados();
        initModals();
        initToast();
        initFilters();
        await carregarGradeDoSupabase();
        renderizarGradeCompleta();
        renderizarLegendaCores();
    } catch (error) {
        console.error('Erro na inicialização:', error);
        mostrarToast('Erro ao inicializar o sistema', 'error');
    } finally {
        mostrarLoading(false);
    }
}

function mostrarLoading(show) {
    const container = document.getElementById('gradeContainer');
    if (container && show) {
        container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div><p>Carregando...</p></div>';
    }
}

async function carregarTodosOsDados() {
    try {
        await carregarDisciplinas();
        await carregarProfessores();
        await carregarHorarios();
        await carregarCursos();
        console.log('Dados carregados:', { disciplinas: disciplinas.length, professores: professores.length, cursos: cursos.length });
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        usarDadosPadrao();
    }
}

function usarDadosPadrao() {
    disciplinas = getDefaultDisciplinas();
    professores = getDefaultProfessores();
    horariosManha = getDefaultHorariosManha();
    horariosTarde = getDefaultHorariosTarde();
    horariosNoite = getDefaultHorariosNoite();
    cursos = getDefaultCursos();
    
    disciplinas.forEach(d => disciplinasMap.set(d.nome, d));
}

async function carregarDisciplinas() {
    const { data, error } = await supabaseClient
        .from('disciplinas')
        .select('nome, cor, cor_clara')
        .order('nome');
    
    if (error) throw error;
    
    disciplinas = data.map(d => ({
        nome: d.nome,
        cor: d.cor,
        corClara: d.cor_clara || '#f5f5f5'
    }));
    disciplinas.forEach(d => disciplinasMap.set(d.nome, d));
}

async function carregarProfessores() {
    const { data, error } = await supabaseClient
        .from('professores')
        .select('nome')
        .order('nome');
    
    if (error) throw error;
    professores = data.map(p => p.nome);
}

async function carregarHorarios() {
    const { data, error } = await supabaseClient
        .from('horarios')
        .select('*')
        .order('ordem');
    
    if (error) throw error;
    
    horariosManha = [];
    horariosTarde = [];
    horariosNoite = [];
    
    for (const item of data) {
        const horarioObj = {
            inicio: item.inicio,
            fim: item.fim
        };
        
        if (item.is_intervalo) {
            horarioObj.intervalo = true;
        } else {
            horarioObj.aula = item.aula_num;
        }
        
        if (item.periodo === 'manha') {
            horariosManha.push(horarioObj);
        } else if (item.periodo === 'tarde') {
            horariosTarde.push(horarioObj);
        } else if (item.periodo === 'noite') {
            horariosNoite.push(horarioObj);
        }
    }
}

async function carregarCursos() {
    const { data, error } = await supabaseClient
        .from('cursos')
        .select('nome')
        .order('nome');
    
    if (error) {
        console.error('Erro ao carregar cursos do Supabase:', error);
        // Fallback para cursos padrão
        cursos = getDefaultCursos();
        console.warn('Usando cursos padrão:', cursos);
        return;
    }
    
    if (!data || data.length === 0) {
        console.warn('Nenhum curso encontrado no Supabase. Usando padrão.');
        cursos = getDefaultCursos();
    } else {
        cursos = data.map(c => c.nome);
    }
    console.log('Cursos carregados:', cursos);
}

function initFilters() {
    const filtroCurso = document.getElementById('filtroCurso');
    const filtroPeriodo = document.getElementById('filtroPeriodo');
    if (!filtroCurso) {
        console.error('Elemento filtroCurso não encontrado!');
        return;
    }
    
    // Limpa opções existentes, mantendo a primeira (Todas as Turmas)
    filtroCurso.innerHTML = '<option value="todos">Todas as Turmas</option>';
    
    if (!cursos || cursos.length === 0) {
        console.warn('Nenhum curso disponível para preencher o select.');
        return;
    }
    
    cursos.forEach(curso => {
        const option = document.createElement('option');
        option.value = curso;
        option.textContent = curso;
        filtroCurso.appendChild(option);
    });
    
    console.log(`Select preenchido com ${cursos.length} cursos.`);
    
    // Filtro período (opcional, se existir)
    if (filtroPeriodo) {
        filtroPeriodo.addEventListener('change', (e) => { currentFiltroPeriodo = e.target.value; renderizarGradeCompleta(); });
    }
    
    filtroCurso.addEventListener('change', (e) => { currentFiltroCurso = e.target.value; renderizarGradeCompleta(); });
    
    const info = document.getElementById('totalCursosInfo');
    if (info) info.textContent = `${cursos.length} turmas`;
}

function gerarCorAleatoria(nome) {
    let hash = 0;
    for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash % 360)}, 70%, 85%)`;
}

function getDefaultDisciplinas() {
    const nomes = ["Língua Portuguesa", "Matemática", "Biologia", "Física", "Química", "História", "Geografia", "Filosofia", "Sociologia", "Arte", "Educação Física", "Língua Inglesa", "Projeto de Vida", "Ensino Religioso", "Espanhol"];
    return nomes.map(n => ({ nome: n, cor: gerarCorAleatoria(n), corClara: '#f5f5f5' }));
}

function getDefaultProfessores() {
    return ["Prof. João da Silva", "Profª. Maria Oliveira", "Prof. Pedro Henrique", "Profª. Ana Beatriz", "Prof. Lucas Santos", "Profª. Juliana Costa", "Prof. Rafael Almeida", "Profª. Camila Rodrigues", "Prof. Bruno Lima", "Profª. Fernanda Castro", "Prof. Diego Mendes", "Profª. Patrícia Gomes", "Prof. Vinícius Araújo", "Profª. Natália Rocha", "Prof. Gustavo Pereira"];
}

function getDefaultHorariosManha() {
    return [{"aula":1,"inicio":"07:00","fim":"07:50"},{"aula":2,"inicio":"07:50","fim":"08:40"},{"intervalo":true,"inicio":"08:40","fim":"08:50"},{"aula":3,"inicio":"08:50","fim":"09:40"},{"aula":4,"inicio":"09:40","fim":"10:30"},{"aula":5,"inicio":"10:30","fim":"11:20"}];
}

function getDefaultHorariosTarde() {
    return [{"aula":1,"inicio":"13:00","fim":"13:50"},{"aula":2,"inicio":"13:50","fim":"14:30"},{"intervalo":true,"inicio":"14:30","fim":"14:40"},{"aula":3,"inicio":"14:40","fim":"15:30"},{"aula":4,"inicio":"15:30","fim":"16:20"},{"aula":5,"inicio":"16:20","fim":"17:10"}];
}

function getDefaultHorariosNoite() {
    return [{"aula":1,"inicio":"18:30","fim":"19:20"},{"aula":2,"inicio":"19:20","fim":"20:10"},{"intervalo":true,"inicio":"20:10","fim":"20:20"},{"aula":3,"inicio":"20:20","fim":"21:10"}];
}

function getDefaultCursos() {
    return ["Informática 1A", "Informática 2A", "Informática 2B", "Informática 3A", "Design 1A", "Design 2A", "Modo 1A"];
}

function initModals() {
    const editEl = document.getElementById('editModal');
    const conflitosEl = document.getElementById('conflitosModal');
    if (editEl) editModal = new bootstrap.Modal(editEl);
    if (conflitosEl) conflitosModal = new bootstrap.Modal(conflitosEl);
    
    const salvarBtn = document.getElementById('salvarAulaBtn');
    if (salvarBtn) salvarBtn.addEventListener('click', () => verificarConflitosAntesSalvar());
    
    const confirmarBtn = document.getElementById('confirmarSalvarBtn');
    if (confirmarBtn) confirmarBtn.addEventListener('click', () => { conflitosModal?.hide(); salvarAulaForce(); });
    
    // Botão Limpar Horário
    const limparBtn = document.getElementById('limparAulaBtn');
    if (limparBtn) {
        limparBtn.addEventListener('click', () => {
            if (confirm('Deseja limpar este horário? A aula será removida.')) {
                limparAula();
            }
        });
    }
    
    // Ao fechar o modal, esconder o botão Limpar novamente
    if (editEl) {
        editEl.addEventListener('hidden.bs.modal', () => {
            const limparBtn = document.getElementById('limparAulaBtn');
            if (limparBtn) limparBtn.style.display = 'none';
        });
    }
    
    preencherSelectsModal();
}

function preencherSelectsModal() {
    const discSelect = document.getElementById('disciplinaSelect');
    const profSelect = document.getElementById('professorSelect');
    if (!discSelect || !profSelect) return;
    
    discSelect.innerHTML = '<option value="">Selecione...</option>';
    profSelect.innerHTML = '<option value="">Selecione...</option>';
    
    disciplinas.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.nome;
        opt.textContent = d.nome;
        discSelect.appendChild(opt);
    });
    
    professores.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        profSelect.appendChild(opt);
    });
}

function initToast() {
    const toastEl = document.getElementById('notificationToast');
    if (toastEl) toast = new bootstrap.Toast(toastEl, { animation: true, autohide: true, delay: 3000 });
}

function mostrarToast(msg, tipo = 'success') {
    if (!toast) return;
    const body = document.querySelector('#notificationToast .toast-body');
    if (body) {
        body.textContent = msg;
        toast.show();
    }
}


function carregarGradeDoLocalStorage() {
    try {
        const saved = localStorage.getItem('gradeHoraria');
        if (saved) {
            gradeData = JSON.parse(saved);
            verificarEstruturaGrade();
        } else {
            inicializarGradeVazia();
        }
        salvarGrade();
    } catch (e) {
        console.error('Erro ao carregar grade:', e);
        inicializarGradeVazia();
    }
}

function verificarEstruturaGrade() {
    let precisaSalvar = false;
    for (const curso of cursos) {
        if (!gradeData[curso]) { gradeData[curso] = {}; precisaSalvar = true; }
        for (const dia of diasSemana) {
            if (!gradeData[curso][dia]) { gradeData[curso][dia] = { manha: {}, tarde: {}, noite: {} }; precisaSalvar = true; }
            else {
                for (const periodo of periodos) {
                    if (!gradeData[curso][dia][periodo]) { gradeData[curso][dia][periodo] = {}; precisaSalvar = true; }
                }
            }
        }
    }
    if (precisaSalvar) {
        preencherAulasFaltantes();
        salvarGrade();
    }
}

function preencherAulasFaltantes() {
    for (const curso of cursos) {
        for (const dia of diasSemana) {
            if (!gradeData[curso]) gradeData[curso] = {};
            if (!gradeData[curso][dia]) gradeData[curso][dia] = { manha: {}, tarde: {}, noite: {} };
            
            let aulaCount = 1;
            for (const hor of horariosManha) {
                if (!hor.intervalo && !gradeData[curso][dia].manha[aulaCount]) {
                    gradeData[curso][dia].manha[aulaCount] = { disciplina: '', professor: '', horario: `${hor.inicio} - ${hor.fim}` };
                }
                if (!hor.intervalo) aulaCount++;
            }
            
            aulaCount = 1;
            for (const hor of horariosTarde) {
                if (!hor.intervalo && !gradeData[curso][dia].tarde[aulaCount]) {
                    gradeData[curso][dia].tarde[aulaCount] = { disciplina: '', professor: '', horario: `${hor.inicio} - ${hor.fim}` };
                }
                if (!hor.intervalo) aulaCount++;
            }
            
            aulaCount = 1;
            for (const hor of horariosNoite) {
                if (!hor.intervalo && !gradeData[curso][dia].noite[aulaCount]) {
                    gradeData[curso][dia].noite[aulaCount] = { disciplina: '', professor: '', horario: `${hor.inicio} - ${hor.fim}` };
                }
                if (!hor.intervalo) aulaCount++;
            }
        }
    }
}

function inicializarGradeVazia() {
    gradeData = {};
    for (const curso of cursos) {
        gradeData[curso] = {};
        for (const dia of diasSemana) {
            gradeData[curso][dia] = { manha: {}, tarde: {}, noite: {} };
            
            let aulaCount = 1;
            for (const hor of horariosManha) {
                if (!hor.intervalo) {
                    gradeData[curso][dia].manha[aulaCount] = { disciplina: '', professor: '', horario: `${hor.inicio} - ${hor.fim}` };
                    aulaCount++;
                }
            }
            
            aulaCount = 1;
            for (const hor of horariosTarde) {
                if (!hor.intervalo) {
                    gradeData[curso][dia].tarde[aulaCount] = { disciplina: '', professor: '', horario: `${hor.inicio} - ${hor.fim}` };
                    aulaCount++;
                }
            }
            
            aulaCount = 1;
            for (const hor of horariosNoite) {
                if (!hor.intervalo) {
                    gradeData[curso][dia].noite[aulaCount] = { disciplina: '', professor: '', horario: `${hor.inicio} - ${hor.fim}` };
                    aulaCount++;
                }
            }
        }
    }
}

function salvarGrade() {
    try {
        localStorage.setItem('gradeHoraria', JSON.stringify(gradeData));
    } catch (e) {
        console.error('Erro ao salvar grade:', e);
    }
}

function verificarConflitosProfessor(cursoAtual, dia, periodo, aulaNum, professor) {
    const conflitos = [];
    
    if (!professor) return conflitos;
    
    for (const curso of cursos) {
        for (const outroDia of diasSemana) {
            if (outroDia !== dia) continue;
            
            for (const outroPeriodo of periodos) {
                const aulas = gradeData[curso]?.[outroDia]?.[outroPeriodo];
                if (!aulas) continue;
                
                for (const [num, aula] of Object.entries(aulas)) {
                    if (aula && aula.professor === professor && aula.disciplina && aula.disciplina !== '') {
                        if (curso === cursoAtual && outroPeriodo === periodo && parseInt(num) === aulaNum) {
                            continue;
                        }
                        
                        if (verificarHorarioSobreposto(outroPeriodo, parseInt(num), periodo, aulaNum)) {
                            conflitos.push({
                                curso: curso,
                                dia: outroDia,
                                periodo: outroPeriodo,
                                aula: parseInt(num),
                                disciplina: aula.disciplina
                            });
                        }
                    }
                }
            }
        }
    }
    
    return conflitos;
}

function verificarHorarioSobreposto(periodo1, aula1, periodo2, aula2) {
    const getHorario = (periodo, aula) => {
        const horarios = periodo === 'manha' ? horariosManha : (periodo === 'tarde' ? horariosTarde : horariosNoite);
        let count = 1;
        for (const h of horarios) {
            if (!h.intervalo) {
                if (count === aula) return { inicio: h.inicio, fim: h.fim };
                count++;
            }
        }
        return null;
    };
    
    const h1 = getHorario(periodo1, aula1);
    const h2 = getHorario(periodo2, aula2);
    if (!h1 || !h2) return false;
    
    const toMin = (t) => { const [h,m] = t.split(':'); return parseInt(h)*60 + parseInt(m); };
    return (toMin(h1.inicio) < toMin(h2.fim) && toMin(h2.inicio) < toMin(h1.fim));
}

function verificarConflitosAntesSalvar() {
    if (!currentEditContext) return;
    const disciplina = document.getElementById('disciplinaSelect')?.value;
    const professor = document.getElementById('professorSelect')?.value;
    if (!disciplina || !professor) {
        mostrarToast('Selecione disciplina e professor', 'warning');
        return;
    }
    
    const conflitos = verificarConflitosProfessor(currentEditContext.curso, currentEditContext.dia, currentEditContext.periodo, currentEditContext.aulaNum, professor);
    if (conflitos.length > 0) {
        pendingSaveData = { disciplina, professor };
        mostrarConflitos(conflitos);
        conflitosModal?.show();
    } else {
        salvarAula(disciplina, professor);
    }
}

function mostrarConflitos(conflitos) {
    const container = document.getElementById('conflitosList');
    if (!container) return;
    container.innerHTML = `<div class="alert alert-warning">⚠️ Conflitos detectados!</div><ul>${conflitos.map(c => `<li><strong>${c.curso}</strong> - ${c.dia} (${c.periodo})</li>`).join('')}</ul>`;
}

function salvarAulaForce() {
    if (pendingSaveData) {
        salvarAula(pendingSaveData.disciplina, pendingSaveData.professor);
        pendingSaveData = null;
    }
}

async function salvarAula(disciplina, professor) {
    if (!currentEditContext) return;
    const { curso, dia, periodo, aulaNum } = currentEditContext;
    
    const horario = gradeData[curso]?.[dia]?.[periodo]?.[aulaNum]?.horario || '';
    
    const aulaData = {
        curso: curso,
        dia_semana: dia,
        periodo: periodo,
        aula_num: aulaNum,
        disciplina: disciplina,
        professor: professor,
        horario: horario,
        updated_at: new Date().toISOString()
    };
    
    const { error } = await supabaseClient
        .from('grade_horaria')
        .upsert(aulaData, {
            onConflict: 'curso, dia_semana, periodo, aula_num'
        });
    
    if (error) {
        console.error('Erro ao salvar no Supabase:', error);
        mostrarToast(`Erro: ${error.message}`, 'error');
        return;
    }
    
    if (!gradeData[curso]) gradeData[curso] = {};
    if (!gradeData[curso][dia]) gradeData[curso][dia] = { manha: {}, tarde: {}, noite: {} };
    if (!gradeData[curso][dia][periodo]) gradeData[curso][dia][periodo] = {};
    
    gradeData[curso][dia][periodo][aulaNum] = { disciplina, professor, horario };
    salvarGrade();
    renderizarGradeCompleta();
    editModal?.hide();
    mostrarToast(`Aula de ${disciplina} salva!`);
}

// NOVA FUNÇÃO: Limpa completamente o horário
async function limparAula() {
    if (!currentEditContext) return;
    const { curso, dia, periodo, aulaNum } = currentEditContext;
    const horario = gradeData[curso]?.[dia]?.[periodo]?.[aulaNum]?.horario || '';
    
    // Atualiza local
    if (!gradeData[curso]) gradeData[curso] = {};
    if (!gradeData[curso][dia]) gradeData[curso][dia] = { manha: {}, tarde: {}, noite: {} };
    gradeData[curso][dia][periodo][aulaNum] = { disciplina: '', professor: '', horario };
    
    // Atualiza Supabase
    const aulaData = {
        curso: curso,
        dia_semana: dia,
        periodo: periodo,
        aula_num: aulaNum,
        disciplina: '',
        professor: '',
        horario: horario,
        updated_at: new Date().toISOString()
    };
    
    const { error } = await supabaseClient
        .from('grade_horaria')
        .upsert(aulaData, { onConflict: 'curso, dia_semana, periodo, aula_num' });
    
    if (error) {
        console.error('Erro ao limpar horário:', error);
        mostrarToast('Erro ao limpar horário', 'error');
        return;
    }
    
    salvarGrade();
    renderizarGradeCompleta();
    editModal?.hide();
    mostrarToast('Horário limpo com sucesso!');
}

async function carregarGradeDoSupabase() {
    const { data, error } = await supabaseClient
        .from('grade_horaria')
        .select('*');
    
    if (error) {
        console.error('Erro ao carregar grade do Supabase:', error);
        carregarGradeDoLocalStorage();
        return;
    }
    
    inicializarGradeVazia();
    
    for (const item of data) {
        const { curso, dia_semana, periodo, aula_num, disciplina, professor, horario } = item;
        if (!curso) continue;
        
        if (!gradeData[curso]) gradeData[curso] = {};
        if (!gradeData[curso][dia_semana]) gradeData[curso][dia_semana] = { manha: {}, tarde: {}, noite: {} };
        if (!gradeData[curso][dia_semana][periodo]) gradeData[curso][dia_semana][periodo] = {};
        
        gradeData[curso][dia_semana][periodo][aula_num] = { disciplina, professor, horario };
    }
    
    salvarGrade();
}

function getDisciplinaCor(nome) {
    return disciplinasMap.get(nome)?.cor || '#ffffff';
}

function renderizarLegendaCores() {
    const container = document.getElementById('legendaCores');
    if (!container) return;
    container.innerHTML = '';
    disciplinas.slice(0, 8).forEach(d => {
        container.innerHTML += `<span style="background:${d.cor}; padding:2px 8px; border-radius:15px; margin:2px;">${d.nome}</span>`;
    });
}

function renderizarGradeCompleta() {
    const container = document.getElementById('gradeContainer');
    if (!container) return;
    
    let cursosFiltrados = currentFiltroCurso === 'todos' ? cursos : cursos.filter(c => c === currentFiltroCurso);
    if (!cursosFiltrados.length) { container.innerHTML = '<div class="p-5 text-center">Nenhum curso</div>'; return; }
    
    let html = `<table class="table grade-table"><thead><tr><th>Horário</th>${diasSemana.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>`;
    for (const curso of cursosFiltrados) {
        html += `<tr class="curso-separator"><td colspan="${diasSemana.length+1}"><strong>${curso}</strong></td></tr>`;
        if (currentFiltroPeriodo === 'todos' || currentFiltroPeriodo === 'manha') html += renderizarPeriodo(curso, 'manha');
        if (currentFiltroPeriodo === 'todos' || currentFiltroPeriodo === 'tarde') html += renderizarPeriodo(curso, 'tarde');
        if (currentFiltroPeriodo === 'todos' || currentFiltroPeriodo === 'noite') html += renderizarPeriodo(curso, 'noite');
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
}

function renderizarPeriodo(curso, periodo) {
    const horas = periodo === 'manha' ? horariosManha : (periodo === 'tarde' ? horariosTarde : horariosNoite);
    const nome = periodo === 'manha' ? 'MANHÃ' : (periodo === 'tarde' ? 'TARDE' : 'NOITE');
    const icon = periodo === 'manha' ? '☀️' : (periodo === 'tarde' ? '🌅' : '🌙');
    let html = '';
    let aulaNum = 1;
    
    if (periodo !== 'manha') html += `<tr class="periodo-separator"><td colspan="${diasSemana.length+1}">${icon} PERÍODO DA ${nome}</td></tr>`;
    
    for (const hor of horas) {
        if (hor.intervalo) {
            html += `<tr class="intervalo-cell"><td>⏸️ INTERVALO<br><small>${hor.inicio}-${hor.fim}</small></td>${diasSemana.map(() => '<td class="text-center">☕</td>').join('')}</tr>`;
        } else {
            html += `<tr><td class="fw-bold">${hor.inicio}-${hor.fim}<br><small>${nome}</small></td>${diasSemana.map(dia => renderizarCelula(curso, dia, periodo, aulaNum)).join('')}</tr>`;
            aulaNum++;
        }
    }
    return html;
}

function renderizarCelula(curso, dia, periodo, aulaNum) {
    const aula = gradeData[curso]?.[dia]?.[periodo]?.[aulaNum];
    const vazia = !aula || !aula.disciplina;
    const cor = !vazia ? getDisciplinaCor(aula.disciplina) : '#fff';
    
    let conflito = false;
    if (!vazia && aula.professor) conflito = verificarConflitosProfessor(curso, dia, periodo, aulaNum, aula.professor).length > 0;
    
    return `<td class="schedule-cell ${conflito ? 'conflict' : ''}" style="background:${cor}" onclick="abrirModalEdicao('${curso}','${dia}','${periodo}',${aulaNum})">
        ${!vazia ? `<div><b>${escapeHtml(aula.disciplina)}</b></div><div><small>${escapeHtml(aula.professor)}</small>${conflito ? ' ⚠️' : ''}</div>` : '<div class="empty-cell">➕ Clique</div>'}
     </td>`;
}

function escapeHtml(t) { if (!t) return ''; return t.replace(/[&<>]/g, function(m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]; }); }

function abrirModalEdicao(curso, dia, periodo, aulaNum) {
    const aula = gradeData[curso]?.[dia]?.[periodo]?.[aulaNum] || { disciplina: '', professor: '' };
    currentEditContext = { curso, dia, periodo, aulaNum };
    const discSel = document.getElementById('disciplinaSelect');
    const profSel = document.getElementById('professorSelect');
    if (discSel) discSel.value = aula.disciplina || '';
    if (profSel) profSel.value = aula.professor || '';
    
    // Mostrar botão "Limpar Horário" apenas se houver conteúdo preenchido
    const limparBtn = document.getElementById('limparAulaBtn');
    if (limparBtn) {
        if (aula.disciplina || aula.professor) {
            limparBtn.style.display = 'inline-block';
        } else {
            limparBtn.style.display = 'none';
        }
    }
    
    editModal?.show();
}

window.abrirModalEdicao = abrirModalEdicao;
document.addEventListener('DOMContentLoaded', init);