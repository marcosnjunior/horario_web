// horario-completo.js - Visualização de horários com data selecionada e destaque de faltas
// Agora com dados do Supabase

// Variáveis globais
let gradeData = {};
let cursos = [];
let professores = [];       // array de { matricula, nome }
let disciplinasMap = new Map();
let horariosManha = [];
let horariosTarde = [];
let horariosNoite = [];
let faltasRegistradas = [];
let toast;
let currentFiltroCurso = 'todos';
let currentFiltroPeriodo = 'todos';
let currentFiltroStatus = 'todos';
let dataReferencia = new Date().toISOString().split('T')[0];

const diasSemana = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const periodos = ['manha', 'tarde', 'noite'];

// Configurações do Supabase (use as mesmas credenciais do seu projeto)
const SUPABASE_URL = 'https://akzpntnefqyocmqswqsp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrenBudG5lZnF5b2NtcXN3cXNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTgxNTMsImV4cCI6MjA5MzIzNDE1M30.TdBmACGxvuvXpTQRmLOHt9cvxWppReIZa9XSq8sDzWk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    try {
        mostrarLoading(true);
        await carregarTodosOsDados();
        initToast();
        initFiltros();
        carregarFiltrosUI();
        atualizarDataNoTitulo();
        renderizarGradeCompleta();
        mostrarLoading(false);
    } catch (error) {
        console.error('Erro fatal na inicialização:', error);
        mostrarErroFatal(error.message || 'Falha ao carregar dados essenciais do Supabase.', error);
        mostrarLoading(false);
    }
});

function mostrarErroFatal(mensagem, erro) {
    const container = document.getElementById('gradeContainer');
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger m-4" role="alert">
                <h4 class="alert-heading"><i class="bi bi-exclamation-triangle-fill"></i> Erro Crítico</h4>
                <p>${mensagem}</p>
                <hr>
                <p class="mb-0">Detalhes técnicos: ${erro?.message || erro || 'Erro desconhecido'}</p>
                <button class="btn btn-primary mt-3" onclick="location.reload()">Tentar recarregar</button>
            </div>
        `;
    }
    const btns = document.querySelectorAll('#btnAtualizar, #btnExportarPDF');
    btns.forEach(btn => btn.disabled = true);
}

function mostrarLoading(show) {
    const container = document.getElementById('gradeContainer');
    if (container && show) {
        container.innerHTML = `
            <div class="text-center p-5" style="min-height: 400px">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
                <p class="mt-3 text-muted">Carregando horários das turmas...</p>
            </div>
        `;
    }
}

// Carregar todos os dados do Supabase
async function carregarTodosOsDados() {
    await Promise.all([
        carregarGradeHoraria(),
        carregarCursos(),
        carregarProfessores(),
        carregarDisciplinas(),
        carregarHorarios(),
        carregarFaltasRegistradas()
    ]);
}

async function carregarGradeHoraria() {
    const { data, error } = await supabaseClient
        .from('grade_horaria')
        .select('*');
    if (error) throw new Error(`Erro ao carregar grade: ${error.message}`);
    if (!data || data.length === 0) throw new Error('Nenhum registro de grade encontrado no Supabase.');

    gradeData = {};
    for (const item of data) {
        const { curso, dia_semana, periodo, aula_num, disciplina, professor, horario } = item;
        if (!gradeData[curso]) gradeData[curso] = {};
        if (!gradeData[curso][dia_semana]) gradeData[curso][dia_semana] = { manha: {}, tarde: {}, noite: {} };
        if (!gradeData[curso][dia_semana][periodo]) gradeData[curso][dia_semana][periodo] = {};
        gradeData[curso][dia_semana][periodo][aula_num] = { disciplina, professor, horario };
    }
}

async function carregarCursos() {
    const { data, error } = await supabaseClient
        .from('cursos')
        .select('nome')
        .order('nome');
    if (error) throw new Error(`Erro ao carregar cursos: ${error.message}`);
    if (!data || data.length === 0) throw new Error('Nenhum curso encontrado.');
    cursos = data.map(c => c.nome);
}

async function carregarProfessores() {
    const { data, error } = await supabaseClient
        .from('professores')
        .select('matricula, nome')
        .order('nome');
    if (error) throw new Error(`Erro ao carregar professores: ${error.message}`);
    if (!data || data.length === 0) throw new Error('Nenhum professor encontrado.');
    professores = data;
}

async function carregarDisciplinas() {
    const { data, error } = await supabaseClient
        .from('disciplinas')
        .select('nome, cor, cor_clara')
        .order('nome');
    if (error) throw new Error(`Erro ao carregar disciplinas: ${error.message}`);
    if (!data || data.length === 0) throw new Error('Nenhuma disciplina encontrada.');
    disciplinasMap.clear();
    data.forEach(d => {
        disciplinasMap.set(d.nome, { nome: d.nome, cor: d.cor, corClara: d.cor_clara || '#f5f5f5' });
    });
}

async function carregarHorarios() {
    const { data, error } = await supabaseClient
        .from('horarios')
        .select('*')
        .order('ordem');
    if (error) throw new Error(`Erro ao carregar horários: ${error.message}`);
    if (!data || data.length === 0) throw new Error('Nenhum horário encontrado.');

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
        if (item.periodo === 'manha') horariosManha.push(horarioObj);
        else if (item.periodo === 'tarde') horariosTarde.push(horarioObj);
        else if (item.periodo === 'noite') horariosNoite.push(horarioObj);
    }
}

async function carregarFaltasRegistradas() {
    const { data, error } = await supabaseClient
        .from('faltas')
        .select('*');
    if (error) {
        console.warn('Erro ao carregar faltas, continuando sem:', error);
        faltasRegistradas = [];
    } else {
        faltasRegistradas = data.map(f => ({
            matriculaProfessor: f.matricula_professor,
            data: f.data,
            curso: f.curso,
            periodo: f.periodo,
            aulaNum: f.aula_num,
            substituto: f.substituto || ''
        }));
    }
}

function atualizarDataNoTitulo() {
    const dataTexto = document.getElementById('dataSelecionadaTexto');
    const dataBadge = document.getElementById('dataAtualBadge');
    if (dataTexto) dataTexto.textContent = formatarData(dataReferencia);
    if (dataBadge && dataReferencia === new Date().toISOString().split('T')[0]) {
        dataBadge.textContent = 'Hoje';
        dataBadge.classList.add('bg-success');
    } else if (dataBadge) {
        dataBadge.innerHTML = '';
    }
}

function formatarData(dataString) {
    if (!dataString) return '';
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}/${mes}/${ano}`;
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
        body.className = `toast-body text-${tipo === 'error' ? 'danger' : tipo === 'warning' ? 'warning' : 'success'}`;
        toast.show();
    }
}

function initFiltros() {
    const filtroCurso = document.getElementById('filtroCurso');
    const filtroPeriodo = document.getElementById('filtroPeriodo');
    const filtroStatus = document.getElementById('filtroStatus');
    const dataInput = document.getElementById('dataReferencia');
    const btnAtualizar = document.getElementById('btnAtualizar');
    const btnExportarPDF = document.getElementById('btnExportarPDF');

    if (filtroCurso) filtroCurso.addEventListener('change', (e) => { currentFiltroCurso = e.target.value; renderizarGradeCompleta(); });
    if (filtroPeriodo) filtroPeriodo.addEventListener('change', (e) => { currentFiltroPeriodo = e.target.value; renderizarGradeCompleta(); });
    if (filtroStatus) filtroStatus.addEventListener('change', (e) => { currentFiltroStatus = e.target.value; renderizarGradeCompleta(); });
    if (dataInput) {
        dataInput.value = dataReferencia;
        dataInput.addEventListener('change', (e) => {
            dataReferencia = e.target.value;
            atualizarDataNoTitulo();
            renderizarGradeCompleta();
            mostrarToast(`Data alterada para ${formatarData(dataReferencia)}`, 'info');
        });
    }
    if (btnAtualizar) {
        btnAtualizar.addEventListener('click', async () => {
            mostrarLoading(true);
            try {
                await carregarFaltasRegistradas();
                atualizarDataNoTitulo();
                renderizarGradeCompleta();
            } catch (err) {
                mostrarToast('Erro ao atualizar faltas', 'error');
            } finally {
                mostrarLoading(false);
            }
        });
    }
    if (btnExportarPDF) btnExportarPDF.addEventListener('click', exportarPDF);
}

function carregarFiltrosUI() {
    const filtroCurso = document.getElementById('filtroCurso');
    if (filtroCurso && cursos.length) {
        filtroCurso.innerHTML = '<option value="todos">Todas as Turmas</option>';
        cursos.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            filtroCurso.appendChild(option);
        });
    }
}

// Funções auxiliares para datas da semana
function obterDatasDaSemanaCompletas(dataRef) {
    const data = new Date(dataRef + 'T12:00:00');
    const diaSemana = data.getDay();
    let diffParaSegunda;
    if (diaSemana === 0) diffParaSegunda = -6;
    else diffParaSegunda = -(diaSemana - 1);

    const segunda = new Date(data);
    segunda.setDate(data.getDate() + diffParaSegunda);

    const datas = new Map();
    for (let i = 0; i < diasSemana.length; i++) {
        const diaAtual = new Date(segunda);
        diaAtual.setDate(segunda.getDate() + i);
        const fullDate = diaAtual.toISOString().split('T')[0];
        const displayDate = formatarData(fullDate).substring(0, 5);
        datas.set(diasSemana[i], { fullDate, displayDate });
    }
    return datas;
}

function getStatusAula(curso, dia, periodo, aulaNum, aula, dataAula) {
    if (!aula || !aula.disciplina || !aula.professor) {
        return { status: 'vazia', mensagem: 'Aula não preenchida' };
    }

    const faltasNaData = faltasRegistradas.filter(r => r.data === dataAula);
    const chave = `${curso}|${periodo}|${aulaNum}`;
    const registro = faltasNaData.find(r => `${r.curso}|${r.periodo}|${r.aulaNum}` === chave);

    if (registro) {
        if (registro.substituto) {
            return {
                status: 'substituicao',
                mensagem: `🔄 Aula com substituição\nProfessor titular: ${registro.matriculaProfessor}\nSubstituto: ${registro.substituto}\nData: ${formatarData(dataAula)}`,
                professorOriginal: registro.matriculaProfessor,
                professorSubstituto: registro.substituto
            };
        } else {
            return {
                status: 'ausencia',
                mensagem: `❌ Professor ausente\nProfessor: ${registro.matriculaProfessor}\nSubstituto: NÃO DEFINIDO\nData: ${formatarData(dataAula)}\n\n⚠️ Necessário agendar substituição!`,
                professorOriginal: registro.matriculaProfessor
            };
        }
    }

    const temConflito = verificarConflitosProfessor(curso, dia, periodo, aulaNum, aula.professor);
    if (temConflito) {
        return {
            status: 'conflito',
            mensagem: `⚠️ Conflito de horário detectado!\nProfessor ${aula.professor} possui outra aula neste mesmo horário.`
        };
    }

    return {
        status: 'normal',
        mensagem: `✅ Aula normal\nProfessor: ${aula.professor}\nData: ${formatarData(dataAula)}`
    };
}

function verificarConflitosProfessor(cursoAtual, dia, periodo, aulaNum, professor) {
    if (!professor) return false;
    for (const curso of cursos) {
        for (const outroDia of diasSemana) {
            if (outroDia !== dia) continue;
            for (const outroPeriodo of periodos) {
                const aulas = gradeData[curso]?.[outroDia]?.[outroPeriodo];
                if (!aulas) continue;
                for (const [num, aula] of Object.entries(aulas)) {
                    if (aula && aula.professor === professor && aula.disciplina) {
                        if (curso === cursoAtual && outroPeriodo === periodo && parseInt(num) === aulaNum) continue;
                        if (verificarHorarioSobreposto(outroPeriodo, parseInt(num), periodo, aulaNum)) return true;
                    }
                }
            }
        }
    }
    return false;
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

function renderizarGradeCompleta() {
    const container = document.getElementById('gradeContainer');
    if (!container) return;

    let cursosFiltrados = currentFiltroCurso === 'todos' ? cursos : cursos.filter(c => c === currentFiltroCurso);
    if (!cursosFiltrados.length) {
        container.innerHTML = '<div class="p-5 text-center text-muted"><i class="bi bi-inbox" style="font-size: 3rem;"></i><p>Nenhum curso encontrado</p></div>';
        return;
    }

    const datasPorDia = obterDatasDaSemanaCompletas(dataReferencia);

    let html = `<div class="table-responsive"><table class="table grade-table">`;
    const ths = diasSemana.map(dia => `<th>${dia}<br><small class="text-white">${datasPorDia.get(dia).displayDate}</small></th>`).join('');
    html += `<thead><tr><th style="width: 100px">Horário</th>${ths} </thead><tbody>`;

    for (const curso of cursosFiltrados) {
        const cursoId = `curso-${curso.replace(/\s/g, '-')}`;
        // Cabeçalho clicável
        html += `<tr class="curso-separator" data-curso-id="${cursoId}">
                    <td colspan="${diasSemana.length + 1}">
                        <div class="curso-toggle" data-curso-id="${cursoId}">
                            <i class="bi bi-chevron-down toggle-icon"></i> 
                            <i class="bi bi-mortarboard"></i> ${curso}
                        </div>
                     </td>
                  </tr>`;
        // Linhas da grade (inicialmente visíveis)
        html += `<tr class="curso-grade-row" data-curso-id="${cursoId}">`;
        html += `<td colspan="${diasSemana.length + 1}" style="padding: 0;">
                    <div class="curso-grade-content" id="${cursoId}">
                        <table class="table grade-table-inner">
                            ${renderizarPeriodo(curso, 'manha', datasPorDia)}
                            ${renderizarPeriodo(curso, 'tarde', datasPorDia)}
                            ${renderizarPeriodo(curso, 'noite', datasPorDia)}
                        </table>
                    </div>
                 </td>`;
        html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    container.innerHTML = html;

    // Adicionar evento para toggle (clique e toque)
    document.querySelectorAll('.curso-toggle').forEach(toggle => {
        const handler = (e) => {
            e.stopPropagation();
            const cursoId = toggle.dataset.cursoId;
            const content = document.getElementById(cursoId);
            const icon = toggle.querySelector('.toggle-icon');
            if (content) {
                const isHidden = content.style.display === 'none';
                content.style.display = isHidden ? '' : 'none';
                icon.className = isHidden ? 'bi bi-chevron-down toggle-icon' : 'bi bi-chevron-right toggle-icon';
            }
        };
        toggle.addEventListener('click', handler);
        toggle.addEventListener('touchstart', handler); // suporte mobile
    });

    // Vincular clique nas células
    document.querySelectorAll('.schedule-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
            e.stopPropagation();
            const curso = cell.dataset.curso;
            const dia = cell.dataset.dia;
            const periodo = cell.dataset.periodo;
            const aulaNum = parseInt(cell.dataset.aulaNum);
            abrirModalDetalhes(curso, dia, periodo, aulaNum);
        });
    });
}

function renderizarPeriodo(curso, periodo, datasPorDia) {
    const horas = periodo === 'manha' ? horariosManha : (periodo === 'tarde' ? horariosTarde : horariosNoite);
    const nome = periodo === 'manha' ? 'MANHÃ' : (periodo === 'tarde' ? 'TARDE' : 'NOITE');
    const icon = periodo === 'manha' ? '🌅' : (periodo === 'tarde' ? '🌙' : '⭐');

    // Verifica se há pelo menos uma aula preenchida
    let temAulaPreenchida = false;
    let aulaNumTeste = 1;
    for (const hor of horas) {
        if (!hor.intervalo) {
            for (const dia of diasSemana) {
                const aula = gradeData[curso]?.[dia]?.[periodo]?.[aulaNumTeste];
                if (aula && aula.disciplina) { temAulaPreenchida = true; break; }
            }
            if (temAulaPreenchida) break;
            aulaNumTeste++;
        }
    }
    if (!temAulaPreenchida) return '';

    let html = `<tbody class="periodo-body"><tr class="periodo-separator"><td colspan="${diasSemana.length + 1}">${icon} PERÍODO DA ${nome}</td></tr>`;
    let aulaNum = 1;
    for (const hor of horas) {
        if (hor.intervalo) {
            html += `<tr class="intervalo-cell"><td colspan="${diasSemana.length + 1}">⏸️ INTERVALO<br><small>${hor.inicio} - ${hor.fim}</small></td></tr>`;
        } else {
            const linhaCells = diasSemana.map(dia => {
                const dataAula = datasPorDia.get(dia).fullDate;
                return renderizarCelula(curso, dia, periodo, aulaNum, dataAula);
            });
            html += `<tr><td class="fw-bold">${hor.inicio}<br><small>${hor.fim}</small></td>${linhaCells.join('')}</tr>`;
            aulaNum++;
        }
    }
    html += `</tbody>`;
    return html;
}

function renderizarCelula(curso, dia, periodo, aulaNum, dataAula) {
    const aula = gradeData[curso]?.[dia]?.[periodo]?.[aulaNum];
    const vazia = !aula || !aula.disciplina;

    if (vazia) {
        return `<td class="schedule-cell empty-cell" data-curso="${curso}" data-dia="${dia}" data-periodo="${periodo}" data-aula-num="${aulaNum}" data-data-aula="${dataAula}">
                    <div class="empty-cell">➕ Clique para preencher</div>
                </td>`;
    }

    const statusInfo = getStatusAula(curso, dia, periodo, aulaNum, aula, dataAula);
    const disciplinaCor = disciplinasMap.get(aula.disciplina)?.cor || '#e9ecef';

    let statusClass = '';
    let statusLabel = '';
    let backgroundStyle = `background: ${disciplinaCor};`;

    switch (statusInfo.status) {
        case 'substituicao':
            statusClass = 'aula-substituicao';
            statusLabel = `<span class="aula-status status-substituto">🔄 ${statusInfo.professorSubstituto || 'Substituto'}</span>`;
            backgroundStyle = `background: linear-gradient(135deg, #ffe0b3 0%, #ffcc80 100%); border-left: 6px solid #fd7e14;`;
            break;
        case 'ausencia':
            statusClass = 'aula-ausencia';
            statusLabel = `<span class="aula-status status-ausente">⚠️ Professor Ausente</span>`;
            backgroundStyle = `background: linear-gradient(135deg, #ffcccc 0%, #ff9999 100%); border-left: 6px solid #dc3545;`;
            break;
        case 'conflito':
            statusClass = 'aula-conflito';
            statusLabel = `<span class="aula-status status-conflito">⚡ Conflito</span>`;
            backgroundStyle = `background: repeating-linear-gradient(45deg, #f8f9fa, #f8f9fa 10px, #e9ecef 10px, #e9ecef 20px); border-left: 6px solid #6c757d;`;
            break;
        default:
            statusClass = 'aula-normal';
            statusLabel = `<span class="aula-status status-normal">✅ Normal</span>`;
    }

    // Filtro de status
    if (currentFiltroStatus !== 'todos') {
        if (currentFiltroStatus === 'substituicao' && statusInfo.status !== 'substituicao') return '';
        if (currentFiltroStatus === 'ausencia' && statusInfo.status !== 'ausencia') return '';
        if (currentFiltroStatus === 'normal' && statusInfo.status !== 'normal') return '';
    }

    const professorExibido = statusInfo.status === 'substituicao' && statusInfo.professorSubstituto
        ? `↻ ${statusInfo.professorSubstituto}`
        : aula.professor;

    return `<td class="schedule-cell ${statusClass}" data-curso="${curso}" data-dia="${dia}" data-periodo="${periodo}" data-aula-num="${aulaNum}" data-data-aula="${dataAula}" data-status="${statusInfo.status}" style="${backgroundStyle} cursor: pointer;" title="${escapeHtml(statusInfo.mensagem)}">
                <div class="aula-disciplina"><i class="bi bi-book"></i> ${escapeHtml(aula.disciplina)}</div>
                <div class="aula-professor"><i class="bi bi-person-badge"></i> ${escapeHtml(professorExibido)}</div>
                ${statusLabel}
            </td>`;
}

function abrirModalDetalhes(curso, dia, periodo, aulaNum) {
    const cell = document.querySelector(`.schedule-cell[data-curso="${curso}"][data-dia="${dia}"][data-periodo="${periodo}"][data-aula-num="${aulaNum}"]`);
    const dataAula = cell ? cell.dataset.dataAula : dataReferencia;

    const aula = gradeData[curso]?.[dia]?.[periodo]?.[aulaNum];
    const statusInfo = getStatusAula(curso, dia, periodo, aulaNum, aula, dataAula);
    const modal = new bootstrap.Modal(document.getElementById('detalhesAulaModal'));
    const modalBody = document.getElementById('modalBody');
    const modalHeader = document.getElementById('modalHeader');
    if (!modalBody) return;

    let statusColor = '', statusIcon = '', statusText = '';
    switch (statusInfo.status) {
        case 'substituicao': statusColor = '#fd7e14'; statusIcon = '🔄'; statusText = 'Aula com Substituição'; break;
        case 'ausencia': statusColor = '#dc3545'; statusIcon = '⚠️'; statusText = 'Professor Ausente'; break;
        case 'conflito': statusColor = '#6c757d'; statusIcon = '⚡'; statusText = 'Conflito de Horário'; break;
        default: statusColor = '#28a745'; statusIcon = '✅'; statusText = 'Aula Normal';
    }
    modalHeader.style.background = `linear-gradient(135deg, ${statusColor}, ${statusColor}dd)`;

    modalBody.innerHTML = `
        <div class="detalhe-info"><span class="detalhe-label"><i class="bi bi-building"></i> Turma:</span><span>${escapeHtml(curso)}</span></div>
        <div class="detalhe-info"><span class="detalhe-label"><i class="bi bi-calendar"></i> Dia:</span><span>${dia} (${formatarData(dataAula)})</span></div>
        <div class="detalhe-info"><span class="detalhe-label"><i class="bi bi-clock"></i> Horário:</span><span>${aula?.horario || 'Horário não definido'}</span></div>
        <div class="detalhe-info"><span class="detalhe-label"><i class="bi bi-book"></i> Disciplina:</span><span>${escapeHtml(aula?.disciplina || 'Não definida')}</span></div>
        <div class="detalhe-info"><span class="detalhe-label"><i class="bi bi-person-badge"></i> Professor:</span><span>${escapeHtml(aula?.professor || 'Não definido')}</span></div>
        <div class="detalhe-info"><span class="detalhe-label"><i class="bi bi-info-circle"></i> Status:</span><span><span class="badge" style="background-color:${statusColor}">${statusIcon} ${statusText}</span></span></div>
        <div class="detalhe-info"><span class="detalhe-label"><i class="bi bi-chat-text"></i> Detalhes:</span><span>${statusInfo.mensagem || 'Nenhuma informação adicional'}</span></div>
    `;

    const btnRegistrar = document.getElementById('btnRegistrarFalta');
    if (btnRegistrar) {
        btnRegistrar.href = `faltas.html?professor=${encodeURIComponent(aula?.professor || '')}&data=${dataAula}`;
    }
    modal.show();
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

function exportarPDF() {
    const element = document.getElementById('gradeContainer');
    const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `grade-horaria-pedras-fogo-${dataReferencia}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a3', orientation: 'landscape' }
    };
    mostrarToast('Gerando PDF, aguarde...', 'info');
    html2pdf().set(opt).from(element).save()
        .then(() => mostrarToast('PDF gerado com sucesso!', 'success'))
        .catch(err => { console.error(err); mostrarToast('Erro ao gerar PDF', 'error'); });
}