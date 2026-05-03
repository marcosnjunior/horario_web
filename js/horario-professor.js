// horario-professor.js - Grade semanal por professor (corrigido)

const SUPABASE_URL = 'https://akzpntnefqyocmqswqsp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrenBudG5lZnF5b2NtcXN3cXNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTgxNTMsImV4cCI6MjA5MzIzNDE1M30.TdBmACGxvuvXpTQRmLOHt9cvxWppReIZa9XSq8sDzWk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let professores = [];
let disciplinasMap = new Map();
let horariosEstruturados = new Map(); // periodo -> { slots: [], ordemAula: [] }
let gradeDoProfessor = [];
let currentProfessor = null;
let toast;

const diasSemana = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const periodos = ['manha', 'tarde', 'noite'];

document.addEventListener('DOMContentLoaded', async () => {
    initToast();
    await carregarDadosBase();
    await carregarProfessores();
    configurarEventos();
});

function initToast() {
    const toastEl = document.getElementById('notificationToast');
    if (toastEl) toast = new bootstrap.Toast(toastEl, { animation: true, autohide: true, delay: 2500 });
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

async function carregarDadosBase() {
    try {
        const { data: profData, error: profError } = await supabaseClient
            .from('professores')
            .select('matricula, nome')
            .order('nome');
        if (profError) throw profError;
        professores = profData || [];

        const { data: discData, error: discError } = await supabaseClient
            .from('disciplinas')
            .select('nome, cor, cor_clara');
        if (discError) throw discError;
        disciplinasMap.clear();
        (discData || []).forEach(d => {
            disciplinasMap.set(d.nome, { cor: d.cor, corClara: d.cor_clara || '#f5f5f5' });
        });

        const { data: horarioData, error: horError } = await supabaseClient
            .from('horarios')
            .select('*')
            .order('ordem');
        if (horError) throw horError;

        // Estrutura: para cada período, armazenamos todos os slots (incluindo intervalos)
        // e um array separado apenas com as aulas (sem intervalos) para referência de posição
        horariosEstruturados.clear();
        periodos.forEach(p => {
            horariosEstruturados.set(p, {
                todos: [],        // objetos { inicio, fim, intervalo, aulaNum (ou null) }
                apenasAulas: []   // só os que não são intervalo, na mesma ordem
            });
        });

        for (const item of horarioData || []) {
            const obj = {
                inicio: item.inicio,
                fim: item.fim,
                intervalo: item.is_intervalo || false,
                aulaNum: item.is_intervalo ? null : item.aula_num
            };
            const periodo = item.periodo;
            if (horariosEstruturados.has(periodo)) {
                const estrutura = horariosEstruturados.get(periodo);
                estrutura.todos.push(obj);
                if (!obj.intervalo) {
                    estrutura.apenasAulas.push(obj);
                }
            }
        }

        console.log('Horários estruturados:', horariosEstruturados);
    } catch (error) {
        console.error('Erro ao carregar dados base:', error);
        mostrarToast('Falha ao carregar informações essenciais', 'error');
    }
}

async function carregarProfessores() {
    const select = document.getElementById('professorSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- Selecione um professor --</option>';
    if (professores.length === 0) {
        select.innerHTML = '<option value="">Nenhum professor encontrado</option>';
        return;
    }
    professores.forEach(prof => {
        const option = document.createElement('option');
        option.value = prof.nome;
        option.textContent = `${prof.nome} (${prof.matricula})`;
        select.appendChild(option);
    });
    mostrarToast('Professores carregados com sucesso', 'success');
}

function configurarEventos() {
    const select = document.getElementById('professorSelect');
    if (select) {
        select.addEventListener('change', async (e) => {
            const professorNome = e.target.value;
            if (!professorNome) {
                limparGrade();
                document.getElementById('professorNomeHeader').innerHTML = '<i class="bi bi-person-square"></i> Professor não selecionado';
                document.getElementById('btnExportarPDF').disabled = true;
                document.getElementById('legendaContainer').style.display = 'none';
                return;
            }
            currentProfessor = professorNome;
            document.getElementById('professorNomeHeader').innerHTML = `<i class="bi bi-person-badge"></i> ${escapeHtml(professorNome)}`;
            document.getElementById('btnExportarPDF').disabled = false;
            await carregarGradeDoProfessor(professorNome);
            renderizarGrade();
        });
    }

    const btnPdf = document.getElementById('btnExportarPDF');
    if (btnPdf) {
        btnPdf.addEventListener('click', exportarPDF);
    }
}

async function carregarGradeDoProfessor(professorNome) {
    try {
        // Busca todas as aulas onde o professor é o titular
        const { data, error } = await supabaseClient
            .from('grade_horaria')
            .select('curso, dia_semana, periodo, aula_num, disciplina, professor, horario')
            .eq('professor', professorNome);

        if (error) throw error;
        gradeDoProfessor = data || [];
        console.log(`Aulas encontradas para ${professorNome}:`, gradeDoProfessor);
        if (gradeDoProfessor.length === 0) {
            mostrarToast(`Professor ${professorNome} não possui aulas alocadas.`, 'warning');
        } else {
            mostrarToast(`Carregadas ${gradeDoProfessor.length} aula(s) para ${professorNome}`, 'success');
        }
    } catch (error) {
        console.error('Erro ao carregar grade do professor:', error);
        gradeDoProfessor = [];
        mostrarToast('Erro ao carregar a grade do professor', 'error');
    }
}

function limparGrade() {
    const container = document.getElementById('gradeContainer');
    if (container) {
        container.innerHTML = `<div class="text-center p-5"><i class="bi bi-person-x" style="font-size: 3rem;"></i><p class="mt-3 text-muted">Selecione um professor para visualizar a grade.</p></div>`;
    }
}

function renderizarGrade() {
    const container = document.getElementById('gradeContainer');
    if (!container) return;

    if (!currentProfessor || gradeDoProfessor.length === 0) {
        container.innerHTML = `<div class="text-center p-5"><i class="bi bi-calendar-x" style="font-size: 3rem;"></i><p class="mt-3 text-muted">Nenhuma aula encontrada para este professor.</p><small>Verifique se ele possui vínculo na grade horária.</small></div>`;
        atualizarLegendaCores([]);
        return;
    }

    // Criar um mapa para acesso rápido: chave = dia|periodo|posicaoAula (1-based entre as aulas não-intervalo)
    const aulaMap = new Map();
    for (const aula of gradeDoProfessor) {
        const periodo = aula.periodo;
        const estrutura = horariosEstruturados.get(periodo);
        if (!estrutura) continue;

        // O número da aula (aula_num) deve corresponder à posição no array 'apenasAulas'
        const posicao = aula.aula_num; // 1,2,3...
        const idx = posicao - 1;
        if (idx >= 0 && idx < estrutura.apenasAulas.length) {
            const key = `${aula.dia_semana}|${periodo}|${posicao}`;
            aulaMap.set(key, aula);
        } else {
            console.warn(`Aula com número ${posicao} inválido para período ${periodo} (max ${estrutura.apenasAulas.length})`);
        }
    }

    let html = `<table class="grade-table">`;
    html += `<thead><tr><th>Horário</th>`;
    diasSemana.forEach(dia => html += `<th>${dia}</th>`);
    html += `</thead><tbody>`;

    for (const periodo of periodos) {
        const estrutura = horariosEstruturados.get(periodo);
        if (!estrutura || estrutura.todos.length === 0) continue;

        const nomePeriodo = periodo === 'manha' ? '🌅 MANHÃ' : (periodo === 'tarde' ? '🌙 TARDE' : '⭐ NOITE');
        html += `<tr class="table-secondary"><td colspan="${diasSemana.length+1}" class="fw-bold">${nomePeriodo}</td></tr>`;

        // Percorre todos os slots (incluindo intervalos) na ordem correta
        for (const slot of estrutura.todos) {
            if (slot.intervalo) {
                html += `<tr class="intervalo-row"><td colspan="${diasSemana.length+1}"><i class="bi bi-cup-hot"></i> INTERVALO — ${slot.inicio} às ${slot.fim}</td></tr>`;
                continue;
            }

            // Descobrir qual posição de aula este slot representa (1..N)
            const posicaoAula = estrutura.apenasAulas.findIndex(a => a === slot) + 1;
            const labelHorario = `${slot.inicio}<br><small>${slot.fim}</small>`;
            html += `<tr>`;
            html += `<td class="fw-bold text-center">${labelHorario}</td>`;

            for (const dia of diasSemana) {
                const key = `${dia}|${periodo}|${posicaoAula}`;
                const aula = aulaMap.get(key);
                if (aula && aula.disciplina) {
                    const disciplinaNome = aula.disciplina;
                    const corObj = disciplinasMap.get(disciplinaNome) || { cor: '#e9ecef', corClara: '#f8f9fa' };
                    const turma = aula.curso;
                    html += `<td style="background-color: ${corObj.corClara}; border-left: 4px solid ${corObj.cor};">
                                <div class="aula-info">
                                    <div class="aula-disciplina">📘 ${escapeHtml(disciplinaNome)}</div>
                                    <div class="aula-turma"><i class="bi bi-building"></i> ${escapeHtml(turma)}</div>
                                </div>
                              </td>`;
                } else {
                    html += `<td class="empty-cell text-muted small text-center">—</td>`;
                }
            }
            html += `</tr>`;
        }
    }

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Legenda
    const disciplinasUsadas = new Set();
    gradeDoProfessor.forEach(aula => {
        if (aula.disciplina) disciplinasUsadas.add(aula.disciplina);
    });
    const disciplinasArray = Array.from(disciplinasUsadas).map(nome => ({
        nome,
        cor: disciplinasMap.get(nome)?.cor || '#6c757d'
    }));
    atualizarLegendaCores(disciplinasArray);
}

function atualizarLegendaCores(disciplinasArray) {
    const containerLegenda = document.getElementById('legendaContainer');
    const legendaDiv = document.getElementById('legendaCores');
    if (!containerLegenda || !legendaDiv) return;

    if (disciplinasArray.length === 0) {
        containerLegenda.style.display = 'none';
        return;
    }
    containerLegenda.style.display = 'block';
    legendaDiv.innerHTML = '';
    disciplinasArray.forEach(disc => {
        const item = document.createElement('div');
        item.className = 'legenda-cor-item';
        item.innerHTML = `<span class="legenda-cor" style="background-color: ${disc.cor};"></span> <span>${escapeHtml(disc.nome)}</span>`;
        legendaDiv.appendChild(item);
    });
}

function exportarPDF() {
    const element = document.getElementById('gradeContainer');
    if (!element) return;
    const professorNome = currentProfessor || 'professor';
    const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `horario-${professorNome.replace(/\s/g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a3', orientation: 'landscape' }
    };
    mostrarToast('Gerando PDF, aguarde...', 'info');
    html2pdf().set(opt).from(element).save()
        .then(() => mostrarToast('PDF gerado com sucesso!', 'success'))
        .catch(err => { console.error(err); mostrarToast('Erro ao gerar PDF', 'error'); });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}