// ======================== GLOBAL STATE ========================
let professoresList = [];
let cursosList = [];
let gradeData = {};
let currentProfessor = null;

let currentDate = new Date();
let selectedDates = new Set();
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

// ======================== SUPABASE CLIENT ========================
const SUPABASE_URL = 'https://akzpntnefqyocmqswqsp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrenBudG5lZnF5b2NtcXN3cXNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTgxNTMsImV4cCI6MjA5MzIzNDE1M30.TdBmACGxvuvXpTQRmLOHt9cvxWppReIZa9XSq8sDzWk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    await loadGradeData();
    await loadAbsenceRecords();
    attachEventListeners();
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
}

// Carregar professores do Supabase (com matricula e nome)
async function loadProfessores() {
    const { data, error } = await supabaseClient
        .from('professores')
        .select('matricula, nome')
        .order('nome');
    if (error) throw error;
    professoresList = data;
}

// Carregar cursos do Supabase
async function loadCursos() {
    const { data, error } = await supabaseClient
        .from('cursos')
        .select('nome')
        .order('nome');
    if (error) throw error;
    cursosList = data.map(c => c.nome);
}

// Carregar grade horária (tabela grade_horaria)
async function loadGradeData() {
    const { data, error } = await supabaseClient
        .from('grade_horaria')
        .select('*');
    if (error) throw error;

    gradeData = {};
    for (const item of data) {
        const { curso, dia_semana, periodo, aula_num, disciplina, professor, horario } = item;
        if (!gradeData[curso]) gradeData[curso] = {};
        if (!gradeData[curso][dia_semana]) gradeData[curso][dia_semana] = { manha: {}, tarde: {}, noite: {} };
        if (!gradeData[curso][dia_semana][periodo]) gradeData[curso][dia_semana][periodo] = {};
        gradeData[curso][dia_semana][periodo][aula_num] = { disciplina, professor, horario };
    }
}

// Carregar faltas registradas do Supabase (para o professor atual, se houver)
async function loadAbsenceRecords() {
    if (!currentProfessor) {
        absenceRecords = [];
        return;
    }
    const { data, error } = await supabaseClient
        .from('faltas')
        .select('*')
        .eq('matricula_professor', currentProfessor.matricula);
    if (error) throw error;
    absenceRecords = data.map(r => ({
        matriculaProfessor: r.matricula_professor,
        data: r.data,
        curso: r.curso,
        periodo: r.periodo,
        aulaNum: r.aula_num,
        substituto: r.substituto || ''
    }));
}

// Salvar faltas (upsert) - usado quando o usuário altera o substituto
async function saveAbsenceRecords() {
    if (!currentProfessor) return;
    // Para cada registro, faz upsert na tabela faltas
    for (const record of absenceRecords) {
        const { error } = await supabaseClient
            .from('faltas')
            .upsert({
                matricula_professor: record.matriculaProfessor,
                data: record.data,
                curso: record.curso,
                periodo: record.periodo,
                aula_num: record.aulaNum,
                substituto: record.substituto || null
            }, { onConflict: 'matricula_professor, data, curso, periodo, aula_num' });
        if (error) console.error('Erro ao salvar falta:', error);
    }
}

function attachEventListeners() {
    btnVerificar.addEventListener('click', verificarProfessor);
    btnResetar.addEventListener('click', resetarMatricula);
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));
    btnCarregarAulas.addEventListener('click', carregarAulasParaDatasSelecionadas);
    btnRegistrarFalta.addEventListener('click', registrarFaltas);
}

// ======================== VERIFICAR MATRÍCULA ========================
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
        btnRegistrarFalta.disabled = true;
        // Carregar faltas já existentes desse professor
        loadAbsenceRecords().then(() => {});
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

// ======================== CALENDÁRIO ========================
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
async function carregarAulasParaDatasSelecionadas() {
    if (!currentProfessor) return;
    if (selectedDates.size === 0) {
        alert('Selecione pelo menos uma data no calendário.');
        return;
    }

    const selectedDatesArray = Array.from(selectedDates).sort();
    let aulasEncontradas = [];

    for (const data of selectedDatesArray) {
        const diaSemana = getDiaSemanaFromDateStr(data);
        for (const curso in gradeData) {
            for (const dia in gradeData[curso]) {
                if (dia !== diaSemana) continue;
                for (const periodo of ['manha', 'tarde', 'noite']) {
                    const aulas = gradeData[curso]?.[dia]?.[periodo];
                    if (!aulas) continue;
                    for (const [num, aula] of Object.entries(aulas)) {
                        if (aula && aula.professor === currentProfessor.nome && aula.disciplina) {
                            const aulaNum = parseInt(num);
                            const substituto = obterSubstitutoRegistrado(currentProfessor.matricula, data, curso, periodo, aulaNum);
                            aulasEncontradas.push({
                                curso,
                                diaSemana: dia,
                                periodo,
                                aulaNum,
                                disciplina: aula.disciplina,
                                horario: aula.horario,
                                data: data,
                                substituto
                            });
                        }
                    }
                }
            }
        }
    }

    loadedClasses = aulasEncontradas;

    // Atualizar absenceRecords: garantir que exista um registro para cada aula
    for (const aula of loadedClasses) {
        const exists = absenceRecords.some(r =>
            r.matriculaProfessor === currentProfessor.matricula &&
            r.data === aula.data &&
            r.curso === aula.curso &&
            r.periodo === aula.periodo &&
            r.aulaNum === aula.aulaNum
        );
        if (!exists) {
            absenceRecords.push({
                matriculaProfessor: currentProfessor.matricula,
                data: aula.data,
                curso: aula.curso,
                periodo: aula.periodo,
                aulaNum: aula.aulaNum,
                substituto: ""
            });
        }
    }
    await saveAbsenceRecords();

    exibirListaAulas(loadedClasses);
    aulasContainer.style.display = 'block';
    resultadoRegistro.style.display = 'none';
    btnRegistrarFalta.disabled = (loadedClasses.length === 0);
    if (loadedClasses.length === 0) {
        alert('Nenhuma aula encontrada para este professor nos dias selecionados.');
    }
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
                            <select class="form-select substituto-select" 
                                data-matricula="${currentProfessor.matricula}"
                                data-data="${aula.data}"
                                data-curso="${aula.curso}"
                                data-periodo="${aula.periodo}"
                                data-aulanum="${aula.aulaNum}">
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
        select.addEventListener('change', async (e) => {
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
            } else {
                absenceRecords.push({
                    matriculaProfessor: matricula,
                    data,
                    curso,
                    periodo,
                    aulaNum,
                    substituto
                });
            }
            await saveAbsenceRecords();
        });
    });
}

async function registrarFaltas() {
    await saveAbsenceRecords();
    await exibirResumoHorario();
  
    resultadoRegistro.style.display = 'block';
    aulasContainer.style.display = 'none';
  
    // --- Envio do e-mail ---
    const destinatario = 'marcosnjunior@gmail.com'; // Substitua pelo e-mail desejado
    const cc = 'marcos.junior@ifpb.edu.br'; //cópias de emails
    const professor = currentProfessor.nome;
    const resumoHTML = resumoHorarioContainer.innerHTML; // já contém a tabela com as faltas
  
    const emailEnviado = await enviarEmailGoogleAppsScript(destinatario, cc, professor, resumoHTML);
    if (emailEnviado) {
      // Exibe uma mensagem opcional para o usuário
      const alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-success mt-3';
      alertDiv.innerHTML = '<i class="bi bi-envelope-check"></i> Relatório enviado por e-mail para a coordenação.';
      resultadoRegistro.insertAdjacentElement('afterend', alertDiv);
      setTimeout(() => alertDiv.remove(), 5000);
    } else {
      const alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-warning mt-3';
      alertDiv.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Falta(s) registrada(s), mas houve problema no envio do e-mail.';
      resultadoRegistro.insertAdjacentElement('afterend', alertDiv);
      setTimeout(() => alertDiv.remove(), 5000);
    }
  
    resultadoRegistro.scrollIntoView({ behavior: 'smooth' });
  }

async function exibirResumoHorario() {
    if (!currentProfessor) return;
    // Recarregar registros atualizados
    await loadAbsenceRecords();
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

// Função que envia os dados para o Google Apps Script
async function enviarEmailGoogleAppsScript(destinatario, cc, professor, resumoHTML) {
    // URL do Google Apps Script do e-mail da coordenação de informática
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwgGc3rqcl7HI9-tW0pQfmer3iLdTfs6fdvrn8bM_Wwhnx7qxhYMJkPfzxcgg2ZhxfHsA/exec';
  
    const dados = {
      para: destinatario,
      cc: cc,
      professor: professor,
      resumoHTML: resumoHTML,
      dataReferencia: new Date().toLocaleDateString('pt-BR')
    };
  
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',        // Importante para evitar problemas de CORS
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
      });
  
      // Com 'no-cors' não conseguimos ler a resposta, mas o envio ainda acontece.
      // Se quiser capturar erros, troque 'no-cors' por 'cors' e trate a resposta.
      console.log('Requisição enviada ao Google Apps Script.');
      return true;
    } catch (error) {
      console.error('Erro ao chamar o Google Apps Script:', error);
      return false;
    }
  }

// ======================== INICIAR ========================
init();