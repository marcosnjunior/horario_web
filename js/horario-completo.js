// horario-completo.js - Visualização de horários com data selecionada e destaque de faltas
// SEM VALORES PADRÃO - Exibe erro fatal se os dados não puderem ser carregados

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

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    try {
        mostrarLoading(true);
        await carregarTodosOsDados();
        initToast();
        initFiltros();
        carregarFiltrosUI();
        await carregarFaltasRegistradas();
        atualizarDataNoTitulo();
        renderizarGradeCompleta();
        mostrarLoading(false);
    } catch (error) {
        console.error('Erro fatal na inicialização:', error);
        mostrarErroFatal(error.message || 'Falha ao carregar dados essenciais. Verifique os arquivos JSON e localStorage.', error);
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
    // Desabilitar botões que dependem dos dados
    const btns = document.querySelectorAll('#btnAtualizar, #btnExportarPDF, #btnRegistrarFalta');
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

// Carregar todos os dados - SEM FALLBACK
async function carregarTodosOsDados() {
    await carregarGradeLocalStorage();
    await carregarCursos();
    await carregarProfessoresDisciplinas();
    await carregarHorarios();
}

function carregarGradeLocalStorage() {
    const saved = localStorage.getItem('gradeHoraria');
    if (!saved) {
        throw new Error('Nenhum dado de grade encontrado no localStorage. Cadastre horários primeiro.');
    }
    try {
        gradeData = JSON.parse(saved);
        if (Object.keys(gradeData).length === 0) {
            throw new Error('Grade vazia no localStorage.');
        }
    } catch (e) {
        throw new Error(`Erro ao fazer parse da grade: ${e.message}`);
    }
}

async function carregarCursos() {
    const resp = await fetch('../data/cursos.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ao carregar cursos.json`);
    const data = await resp.json();
    if (!data.cursos || !Array.isArray(data.cursos) || data.cursos.length === 0) {
        throw new Error('cursos.json não contém a lista "cursos" ou está vazia');
    }
    cursos = data.cursos;
}

async function carregarProfessoresDisciplinas() {
    // Professores
    const respProf = await fetch('../data/professores.json');
    if (!respProf.ok) throw new Error(`HTTP ${respProf.status} ao carregar professores.json`);
    const dataProf = await respProf.json();
    if (!dataProf.professores || !Array.isArray(dataProf.professores) || dataProf.professores.length === 0) {
        throw new Error('professores.json não contém a lista "professores" ou está vazia');
    }
    professores = dataProf.professores;

    // Disciplinas
    const respDisc = await fetch('../data/disciplinas.json');
    if (!respDisc.ok) throw new Error(`HTTP ${respDisc.status} ao carregar disciplinas.json`);
    const dataDisc = await respDisc.json();
    if (!dataDisc.disciplinas_ensino_medio || !Array.isArray(dataDisc.disciplinas_ensino_medio) || dataDisc.disciplinas_ensino_medio.length === 0) {
        throw new Error('disciplinas.json não contém "disciplinas_ensino_medio" ou está vazia');
    }
    dataDisc.disciplinas_ensino_medio.forEach(d => {
        if (!d.nome) throw new Error('Disciplina sem nome em disciplinas.json');
        disciplinasMap.set(d.nome, d);
    });
}

async function carregarHorarios() {
    const resp = await fetch('../data/horarios.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ao carregar horarios.json`);
    const data = await resp.json();
    if (!data.manha || !data.tarde || !data.noite) {
        throw new Error('horarios.json deve conter "manha", "tarde" e "noite"');
    }
    horariosManha = data.manha;
    horariosTarde = data.tarde;
    horariosNoite = data.noite;
}

async function carregarFaltasRegistradas() {
    const saved = localStorage.getItem('faltasRegistradas');
    if (saved) {
        try {
            faltasRegistradas = JSON.parse(saved);
        } catch (e) {
            faltasRegistradas = [];
            console.warn('Erro ao parse faltasRegistradas, continuando sem faltas');
        }
    } else {
        faltasRegistradas = [];
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
        dataBadge.textContent = '';
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
        cursos.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            filtroCurso.appendChild(option);
        });
    }
}

/**
 * Retorna um Map com as datas completas e formatadas para cada dia da semana
 * baseado na data de referência (a semana que contém essa data).
 * @param {string} dataRef - Data no formato 'YYYY-MM-DD'
 * @returns {Map<string, {fullDate: string, displayDate: string}>}
 */
function obterDatasDaSemanaCompletas(dataRef) {
    const data = new Date(dataRef + 'T12:00:00');
    const diaSemana = data.getDay();
    let diffParaSegunda;
    if (diaSemana === 0) diffParaSegunda = -6; // domingo -> segunda anterior
    else diffParaSegunda = -(diaSemana - 1);

    const segunda = new Date(data);
    segunda.setDate(data.getDate() + diffParaSegunda);

    const datas = new Map();
    for (let i = 0; i < diasSemana.length; i++) {
        const diaAtual = new Date(segunda);
        diaAtual.setDate(segunda.getDate() + i);
        const fullDate = diaAtual.toISOString().split('T')[0];
        const displayDate = formatarData(fullDate).substring(0, 5); // dd/mm
        datas.set(diasSemana[i], { fullDate, displayDate });
    }
    return datas;
}

function getStatusAula(curso, dia, periodo, aulaNum, aula, dataAula) {
    if (!aula || !aula.disciplina || !aula.professor) {
        return { status: 'vazia', mensagem: 'Aula não preenchida' };
    }

    // Buscar faltas registradas para a data específica
    const faltasNaData = faltasRegistradas.filter(r => r.data === dataAula);
    const chave = `${curso}|${periodo}|${aulaNum}`;
    const registro = faltasNaData.find(r => 
        `${r.curso}|${r.periodo}|${r.aulaNum}` === chave
    );

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

    // Conflito de horário (independente de data)
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

    // Obter as datas de cada coluna (semana da dataReferencia)
    const datasPorDia = obterDatasDaSemanaCompletas(dataReferencia);

    let html = `<div class="table-responsive"><table class="table grade-table">`;
    // Cabeçalho com datas
    const ths = diasSemana.map(dia => `<th>${dia}<br><small class="text-white">${datasPorDia.get(dia).displayDate}</small></th>`).join('');
    html += `<thead><tr><th style="width: 100px">Horário</th>${ths} </thead><tbody>`;

    for (const curso of cursosFiltrados) {
        html += `<tr class="curso-separator"><td colspan="${diasSemana.length + 1}"><i class="bi bi-mortarboard"></i> ${curso} </tr>`;
        if (currentFiltroPeriodo === 'todos' || currentFiltroPeriodo === 'manha') html += renderizarPeriodo(curso, 'manha', datasPorDia);
        if (currentFiltroPeriodo === 'todos' || currentFiltroPeriodo === 'tarde') html += renderizarPeriodo(curso, 'tarde', datasPorDia);
        if (currentFiltroPeriodo === 'todos' || currentFiltroPeriodo === 'noite') html += renderizarPeriodo(curso, 'noite', datasPorDia);
    }
    html += `</tbody> </table></div>`;
    container.innerHTML = html;

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

    let temAulaPreenchida = false;
    let aulaNum = 1;
    for (const hor of horas) {
        if (!hor.intervalo) {
            for (const dia of diasSemana) {
                const aula = gradeData[curso]?.[dia]?.[periodo]?.[aulaNum];
                if (aula && aula.disciplina) { temAulaPreenchida = true; break; }
            }
            if (temAulaPreenchida) break;
            aulaNum++;
        }
    }
    if (!temAulaPreenchida) return '';

    aulaNum = 1;
    let html = `<tr class="periodo-separator"><td colspan="${diasSemana.length + 1}">${icon} PERÍODO DA ${nome} </tr>`;
    for (const hor of horas) {
        if (hor.intervalo) {
            html += `<tr class="intervalo-cell"><td>⏸️ INTERVALO<br><small>${hor.inicio} - ${hor.fim}</small></td>${diasSemana.map(() => '<td class="text-center">☕</td>').join('')}</tr>`;
        } else {
            const linhaCells = diasSemana.map(dia => {
                const dataAula = datasPorDia.get(dia).fullDate;
                return renderizarCelula(curso, dia, periodo, aulaNum, dataAula);
            });
            html += `<tr><td class="fw-bold">${hor.inicio}<br><small>${hor.fim}</small></td>${linhaCells.join('')}</tr>`;
            aulaNum++;
        }
    }
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

    return `<td class="schedule-cell ${statusClass}"
               data-curso="${curso}" data-dia="${dia}" data-periodo="${periodo}" data-aula-num="${aulaNum}"
               data-data-aula="${dataAula}"
               data-status="${statusInfo.status}"
               style="${backgroundStyle} cursor: pointer;"
               title="${escapeHtml(statusInfo.mensagem)}">
            <div class="aula-disciplina"><i class="bi bi-book"></i> ${escapeHtml(aula.disciplina)}</div>
            <div class="aula-professor"><i class="bi bi-person-badge"></i> ${escapeHtml(professorExibido)}</div>
            ${statusLabel}
         </td>`;
}

function abrirModalDetalhes(curso, dia, periodo, aulaNum) {
    // Encontrar a célula clicada para obter a data da aula
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