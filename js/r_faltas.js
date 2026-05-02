// ======================== GLOBAL STATE ========================
let professoresList = [];
let cursosList = [];
let gradeData = {};
let currentProfessor = null;

// Calendar state
let currentDate = new Date();
let selectedDates = new Set();      // armazena strings 'YYYY-MM-DD'
let isSelecting = false;
let startSelectDate = null;

let loadedClasses = [];
let absenceRecords = [];

// DOM elements
const stepMatricula = document.getElementById('stepMatricula');
const stepFaltas = document.getElementById('stepFaltas');
const matriculaInput = document.getElementById('matriculaInput');
const btnVerificar = document.getElementById('btnVerificarMatricula');
const professorNomeDisplay = document.getElementById('professorNomeDisplay');
const professorMatriculaDisplay = document.getElementById('professorMatriculaDisplay');
const btnResetar = document.getElementById('btnResetarMatricula');
const calendarGrid = document.getElementById('calendarGrid');
const mesAnoDisplay = document.getElementById('mesAnoDisplay');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const qtdeDiasSelecionados = document.getElementById('qtdeDiasSelecionados');
const btnCarregarAulas = document.getElementById('btnCarregarAulas');
const aulasContainer = document.getElementById('aulasContainer');
const listaAulasDinamica = document.getElementById('listaAulasDinamica');
const btnRegistrarFalta = document.getElementById('btnRegistrarFalta');
const resultadoRegistro = document.getElementById('resultadoRegistro');
const resumoHorarioContainer = document.getElementById('resumoHorarioContainer');

// ======================== HELPER: DATA LOCAL ========================
function formatDateLocal(year, month, day) {
    const y = year;
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

function getDiaSemanaFromDateStr(dateStr) {
    const date = parseLocalDate(dateStr);
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return dias[date.getDay()];
}

// ======================== INIT ========================
async function init() {
    await loadProfessores();
    await loadCursos();
    loadGradeData();
    loadAbsenceRecords();
    attachEventListeners();
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
}

async function loadProfessores() {
    try {
        const resp = await fetch('../data/professores.json');
        const data = await resp.json();
        professoresList = data.professores;
    } catch (err) {
        console.error('Erro ao carregar professores:', err);
        professoresList = [];
    }
}

async function loadCursos() {
    try {
        const resp = await fetch('../data/cursos.json');
        const data = await resp.json();
        cursosList = data.cursos || [];
    } catch (err) {
        console.error('Erro ao carregar cursos:', err);
        cursosList = [];
    }
}

function loadGradeData() {
    const saved = localStorage.getItem('gradeHoraria');
    gradeData = saved ? JSON.parse(saved) : {};
}

function loadAbsenceRecords() {
    const saved = localStorage.getItem('faltasRegistradas');
    absenceRecords = saved ? JSON.parse(saved) : [];
}

function saveAbsenceRecords() {
    localStorage.setItem('faltasRegistradas', JSON.stringify(absenceRecords));
}

function attachEventListeners() {
    btnVerificar.addEventListener('click', verificarProfessor);
    btnResetar.addEventListener('click', resetarMatricula);
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));
    btnCarregarAulas.addEventListener('click', carregarAulasParaDatasSelecionadas);
    btnRegistrarFalta.addEventListener('click', registrarFaltas);
}

// ======================== STEP 1: VERIFICAR MATRÍCULA ========================
function verificarProfessor() {
    const matriculaDigitada = matriculaInput.value.trim();
    if (!matriculaDigitada) {
        showFeedback('Digite o número da matrícula.', 'danger');
        return;
    }
    const found = professoresList.find(p => p.matricula === matriculaDigitada);
    if (found) {
        currentProfessor = found;
        showFeedback(`Bem‑vindo, ${found.nome}!`, 'success');
        stepMatricula.style.display = 'none';
        stepFaltas.style.display = 'block';
        professorNomeDisplay.textContent = currentProfessor.nome;
        professorMatriculaDisplay.textContent = currentProfessor.matricula;
        selectedDates.clear();
        updateSelectedCount();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        aulasContainer.style.display = 'none';
        resultadoRegistro.style.display = 'none';
        btnRegistrarFalta.disabled = true; // desabilita até carregar aulas
    } else {
        showFeedback('Matrícula não encontrada. Verifique o número.', 'danger');
    }
}

function showFeedback(msg, type) {
    const feedbackDiv = document.getElementById('matriculaFeedback');
    if (feedbackDiv) {
        feedbackDiv.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
                                    ${msg}
                                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                                 </div>`;
    }
}

function resetarMatricula() {
    currentProfessor = null;
    stepMatricula.style.display = 'block';
    stepFaltas.style.display = 'none';
    matriculaInput.value = '';
    selectedDates.clear();
    aulasContainer.style.display = 'none';
    resultadoRegistro.style.display = 'none';
}

// ======================== CALENDÁRIO COM DRAG ========================
function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
}

function renderCalendar(year, month) {
    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let startOffset = startWeekday === 0 ? 6 : startWeekday - 1;

    let gridHTML = '<table class="calendar-table"><thead><tr>';
    const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    weekdays.forEach(day => gridHTML += `<th>${day}</th>`);
    gridHTML += '</tr></thead><tbody>';

    let day = 1;
    let rowCells = 0;

    for (let i = 0; i < startOffset; i++) {
        gridHTML += '<td class="calendar-cell empty"></td>';
        rowCells++;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = formatDateLocal(year, month, d);
        const isSelected = selectedDates.has(dateStr);
        const cellClass = `calendar-cell ${isSelected ? 'selected' : ''}`;
        gridHTML += `<td class="${cellClass}" data-date="${dateStr}">${d}</td>`;
        rowCells++;

        if (rowCells === 7 && d !== daysInMonth) {
            gridHTML += '</tr><tr>';
            rowCells = 0;
        }
    }

    if (rowCells > 0 && rowCells < 7) {
        for (let i = rowCells; i < 7; i++) {
            gridHTML += '<td class="calendar-cell empty"></td>';
        }
    }

    gridHTML += '</tr></tbody></table>';
    calendarGrid.innerHTML = gridHTML;

    mesAnoDisplay.textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(firstDayOfMonth);

    attachDragSelection();
}

function attachDragSelection() {
    const cells = document.querySelectorAll('.calendar-cell:not(.empty)');
    if (!cells.length) return;

    function clearSelection() {
        isSelecting = false;
        startSelectDate = null;
        document.body.style.userSelect = '';
    }

    function handleMouseDown(e) {
        const cell = e.currentTarget;
        const date = cell.dataset.date;
        if (!date) return;
        e.preventDefault();
        isSelecting = true;
        startSelectDate = date;
        selectedDates.clear();
        selectedDates.add(date);
        updateCalendarHighlight();
        updateSelectedCount();
        document.body.style.userSelect = 'none';
    }

    function handleMouseEnter(e) {
        if (!isSelecting) return;
        const cell = e.currentTarget;
        const currentDateVal = cell.dataset.date;
        if (!currentDateVal) return;

        if (startSelectDate && currentDateVal !== startSelectDate) {
            const start = parseLocalDate(startSelectDate);
            const end = parseLocalDate(currentDateVal);
            let rangeStart = new Date(start);
            let rangeEnd = new Date(end);
            if (rangeStart > rangeEnd) {
                [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
            }

            const newSelected = new Set();
            for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
                const dStr = formatDateLocal(d.getFullYear(), d.getMonth(), d.getDate());
                newSelected.add(dStr);
            }
            selectedDates.clear();
            newSelected.forEach(date => selectedDates.add(date));
            updateCalendarHighlight();
            updateSelectedCount();
        }
    }

    function handleMouseUp() {
        clearSelection();
    }

    cells.forEach(cell => {
        cell.removeEventListener('mousedown', handleMouseDown);
        cell.removeEventListener('mouseenter', handleMouseEnter);
        cell.addEventListener('mousedown', handleMouseDown);
        cell.addEventListener('mouseenter', handleMouseEnter);
    });

    document.removeEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseup', handleMouseUp);
}

function updateCalendarHighlight() {
    const cells = document.querySelectorAll('.calendar-cell:not(.empty)');
    cells.forEach(cell => {
        const date = cell.dataset.date;
        if (selectedDates.has(date)) {
            cell.classList.add('selected');
        } else {
            cell.classList.remove('selected');
        }
    });
}

function updateSelectedCount() {
    qtdeDiasSelecionados.textContent = `${selectedDates.size} dia(s) selecionado(s)`;
    btnCarregarAulas.disabled = (selectedDates.size === 0);
}

// ======================== CARREGAR AULAS ========================
function carregarAulasParaDatasSelecionadas() {
    if (!currentProfessor) return;
    if (selectedDates.size === 0) {
        alert('Selecione pelo menos uma data no calendário.');
        return;
    }

    const selectedDatesArray = Array.from(selectedDates).sort();
    const aulasPromises = selectedDatesArray.map(date => buscarAulasDoProfessorNaData(currentProfessor.nome, date));
    Promise.all(aulasPromises).then(results => {
        loadedClasses = results.flat();
        
        // Remover registros antigos do professor atual
        absenceRecords = absenceRecords.filter(r => r.matriculaProfessor !== currentProfessor.matricula);
        
        // Criar um registro para cada aula (substituto vazio = ausente)
        for (const aula of loadedClasses) {
            const novoRegistro = {
                matriculaProfessor: currentProfessor.matricula,
                data: aula.data,
                curso: aula.curso,
                periodo: aula.periodo,
                aulaNum: aula.aulaNum,
                substituto: ""   // vazio = ausente
            };
            absenceRecords.push(novoRegistro);
        }
        saveAbsenceRecords();
        
        exibirListaAulas(loadedClasses);
        aulasContainer.style.display = 'block';
        resultadoRegistro.style.display = 'none';
        
        // Habilitar botão de registrar apenas se houver aulas
        btnRegistrarFalta.disabled = (loadedClasses.length === 0);
        if (loadedClasses.length === 0) {
            alert('Nenhuma aula encontrada para este professor nos dias selecionados.');
        }
    }).catch(err => {
        console.error(err);
        alert('Erro ao carregar as aulas. Tente novamente.');
    });
}

function buscarAulasDoProfessorNaData(nomeProfessor, dataStr) {
    return new Promise((resolve) => {
        const aulasEncontradas = [];
        const nomeDiaSemana = getDiaSemanaFromDateStr(dataStr);

        for (const curso in gradeData) {
            for (const dia in gradeData[curso]) {
                if (dia !== nomeDiaSemana) continue;

                for (const periodo of ['manha', 'tarde', 'noite']) {
                    const aulas = gradeData[curso]?.[dia]?.[periodo];
                    if (!aulas) continue;
                    for (const [num, aula] of Object.entries(aulas)) {
                        if (aula && aula.professor === nomeProfessor && aula.disciplina) {
                            aulasEncontradas.push({
                                curso,
                                diaSemana: dia,
                                periodo,
                                aulaNum: parseInt(num),
                                disciplina: aula.disciplina,
                                horario: aula.horario,
                                data: dataStr,
                                substituto: obterSubstitutoRegistrado(currentProfessor.matricula, dataStr, curso, periodo, parseInt(num))
                            });
                        }
                    }
                }
            }
        }
        resolve(aulasEncontradas);
    });
}

function obterSubstitutoRegistrado(matriculaProfessor, data, curso, periodo, aulaNum) {
    const registro = absenceRecords.find(r =>
        r.matriculaProfessor === matriculaProfessor &&
        r.data === data &&
        r.curso === curso &&
        r.periodo === periodo &&
        r.aulaNum === aulaNum
    );
    return registro ? registro.substituto : '';
}

function exibirListaAulas(aulas) {
    if (!aulas.length) {
        listaAulasDinamica.innerHTML = '<div class="alert alert-warning">Nenhuma aula encontrada para este professor nos dias selecionados.</div>';
        return;
    }

    let html = '';
    for (const aula of aulas) {
        html += `
            <div class="card mb-3 border-0 shadow-sm">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-3">
                            <strong>${aula.data}</strong><br>
                            <small class="text-muted">${aula.diaSemana}</small>
                        </div>
                        <div class="col-md-3">
                            <strong>${aula.curso}</strong><br>
                            <small>${aula.periodo} - Aula ${aula.aulaNum}</small>
                        </div>
                        <div class="col-md-3">
                            <strong>${aula.disciplina}</strong><br>
                            <small>${aula.horario || ''}</small>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label">Professor substituto</label>
                            <select class="form-select substituto-select" data-matricula="${currentProfessor.matricula}" data-data="${aula.data}" data-curso="${aula.curso}" data-periodo="${aula.periodo}" data-aulanum="${aula.aulaNum}">
                                <option value="">Ausente (sem substituto)</option>
                                ${professoresList.filter(p => p.matricula !== currentProfessor.matricula).map(p => `<option value="${p.nome}" ${aula.substituto === p.nome ? 'selected' : ''}>${p.nome}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    listaAulasDinamica.innerHTML = html;

    document.querySelectorAll('.substituto-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const matricula = select.dataset.matricula;
            const data = select.dataset.data;
            const curso = select.dataset.curso;
            const periodo = select.dataset.periodo;
            const aulaNum = parseInt(select.dataset.aulanum);
            const substituto = select.value;
            const index = absenceRecords.findIndex(r =>
                r.matriculaProfessor === matricula &&
                r.data === data &&
                r.curso === curso &&
                r.periodo === periodo &&
                r.aulaNum === aulaNum
            );
            if (index !== -1) {
                absenceRecords[index].substituto = substituto;
            } else if (substituto) {
                absenceRecords.push({
                    matriculaProfessor: matricula,
                    data,
                    curso,
                    periodo,
                    aulaNum,
                    substituto
                });
            }
            saveAbsenceRecords();
        });
    });
}

function registrarFaltas() {
    // Não há mais verificação obrigatória de substituto
    exibirResumoHorario();
    resultadoRegistro.style.display = 'block';
    aulasContainer.style.display = 'none';
    // Opcional: role para o resumo
    resultadoRegistro.scrollIntoView({ behavior: 'smooth' });
}

function exibirResumoHorario() {
    const registrosDoProfessor = absenceRecords.filter(r => r.matriculaProfessor === currentProfessor.matricula);
    if (registrosDoProfessor.length === 0) {
        resumoHorarioContainer.innerHTML = '<div class="p-3">Nenhum registro de falta encontrado.</div>';
        return;
    }

    let html = '<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>Data</th><th>Curso</th><th>Período</th><th>Aula</th><th>Disciplina</th><th>Professor Titular</th><th>Substituto</th></tr></thead><tbody>';
    for (const reg of registrosDoProfessor) {
        let disciplina = '';
        try {
            const diaSemana = getDiaSemanaFromDateStr(reg.data);
            const aulaObj = gradeData[reg.curso]?.[diaSemana]?.[reg.periodo]?.[reg.aulaNum];
            disciplina = aulaObj ? aulaObj.disciplina : 'N/A';
        } catch(e) { disciplina = 'N/A'; }
        const substitutoExibido = reg.substituto ? reg.substituto : 'Ausente';
        html += `<tr>
                    <td>${reg.data}</td>
                    <td>${reg.curso}</td>
                    <td>${reg.periodo}</td>
                    <td>${reg.aulaNum}</td>
                    <td>${disciplina}</td>
                    <td>${currentProfessor.nome}</td>
                    <td>${substitutoExibido}</td>
                 </tr>`;
    }
    html += '</tbody></table></div>';
    resumoHorarioContainer.innerHTML = html;
}

// ======================== INICIAR ========================
init();