// relatorio-faltas.js - Relatório Mensal de Faltas

// Configuração do Supabase (mesmas credenciais do projeto)
const SUPABASE_URL = 'https://akzpntnefqyocmqswqsp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrenBudG5lZnF5b2NtcXN3cXNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTgxNTMsImV4cCI6MjA5MzIzNDE1M30.TdBmACGxvuvXpTQRmLOHt9cvxWppReIZa9XSq8sDzWk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variáveis globais
let todasFaltas = [];
let professoresMap = new Map();    // matricula -> nome
let cursosMap = new Set();          // para filtro rápido (opcional)
let toast;

// Elementos DOM
const mesInput = document.getElementById('mesSelecionado');
const btnCarregar = document.getElementById('btnCarregarRelatorio');
const relatorioContainer = document.getElementById('relatorioContainer');
const tabelaContainer = document.getElementById('tabelaFaltasContainer');
const footerResumo = document.getElementById('footerResumo');
const loadingOverlay = document.getElementById('loadingOverlay');
const btnExportarPDF = document.getElementById('btnExportarPDF');
const btnExportarCSV = document.getElementById('btnExportarCSV');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    // Definir mês atual como padrão
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    if (mesInput) mesInput.value = mesAtual;
    
    initToast();
    
    // Carregar dados auxiliares (professores e cursos) antecipadamente
    try {
        await carregarProfessores();
        await carregarCursos();
    } catch (error) {
        console.error('Erro ao carregar dados auxiliares:', error);
        mostrarToast('Erro ao carregar dados básicos. Recarregue a página.', 'error');
    }
    
    // Evento do botão
    btnCarregar.addEventListener('click', () => {
        const mesSelecionado = mesInput.value;
        if (!mesSelecionado) {
            mostrarToast('Selecione um mês para gerar o relatório.', 'warning');
            return;
        }
        carregarRelatorio(mesSelecionado);
    });
    
    // Exportações
    btnExportarPDF.addEventListener('click', exportarPDF);
    btnExportarCSV.addEventListener('click', exportarCSV);
});

// Inicializar Toast
function initToast() {
    const toastEl = document.getElementById('notificationToast');
    if (toastEl) toast = new bootstrap.Toast(toastEl, { animation: true, autohide: true, delay: 3000 });
}

function mostrarToast(mensagem, tipo = 'success') {
    if (!toast) return;
    const body = document.querySelector('#notificationToast .toast-body');
    if (body) {
        body.textContent = mensagem;
        body.className = `toast-body text-${tipo === 'error' ? 'danger' : tipo === 'warning' ? 'warning' : 'success'}`;
        toast.show();
    }
}

// Carregar lista de professores (matricula -> nome)
async function carregarProfessores() {
    const { data, error } = await supabaseClient
        .from('professores')
        .select('matricula, nome');
    if (error) throw new Error(`Erro ao carregar professores: ${error.message}`);
    if (data) {
        professoresMap.clear();
        data.forEach(prof => {
            professoresMap.set(prof.matricula, prof.nome);
        });
    }
}

// Carregar lista de cursos (para mapeamento)
async function carregarCursos() {
    const { data, error } = await supabaseClient
        .from('cursos')
        .select('nome');
    if (error) throw new Error(`Erro ao carregar cursos: ${error.message}`);
    if (data) {
        cursosMap.clear();
        data.forEach(curso => cursosMap.add(curso.nome));
    }
}

// Buscar faltas do mês
async function carregarRelatorio(mes) {
    mostrarLoading(true);
    try {
        // Calcular primeiro e último dia do mês
        const [ano, mesNum] = mes.split('-');
        const primeiroDia = `${ano}-${mesNum}-01`;
        const ultimoDia = new Date(parseInt(ano), parseInt(mesNum), 0).toISOString().split('T')[0];
        
        // Consulta no Supabase
        const { data, error } = await supabaseClient
            .from('faltas')
            .select('*')
            .gte('data', primeiroDia)
            .lte('data', ultimoDia)
            .order('data', { ascending: true });
        
        if (error) throw new Error(`Erro na consulta: ${error.message}`);
        
        todasFaltas = data || [];
        
        if (todasFaltas.length === 0) {
            tabelaContainer.innerHTML = `
                <div class="alert alert-info text-center m-4">
                    <i class="bi bi-info-circle fs-2"></i>
                    <p class="mt-2 mb-0">Nenhuma falta registrada no período selecionado.</p>
                </div>
            `;
            footerResumo.innerHTML = '';
            relatorioContainer.style.display = 'block';
            mostrarToast('Nenhuma falta encontrada para este mês.', 'info');
            return;
        }
        
        // Exibir tabela
        exibirTabelaFaltas(todasFaltas);
        exibirResumo(todasFaltas);
        relatorioContainer.style.display = 'block';
        mostrarToast(`Encontradas ${todasFaltas.length} falta(s) no período.`, 'success');
        
    } catch (error) {
        console.error('Erro ao carregar relatório:', error);
        mostrarToast(`Erro: ${error.message}`, 'error');
        tabelaContainer.innerHTML = `
            <div class="alert alert-danger m-4">
                <i class="bi bi-exclamation-triangle-fill"></i>
                Falha ao carregar dados: ${error.message}
            </div>
        `;
        relatorioContainer.style.display = 'block';
    } finally {
        mostrarLoading(false);
    }
}

// Exibir tabela com os dados
function exibirTabelaFaltas(faltas) {
    if (!faltas.length) return;
    
    let html = `
        <table class="table table-faltas table-hover">
            <thead>
                <tr>
                    <th>#</th>
                    <th><i class="bi bi-calendar3"></i> Data</th>
                    <th><i class="bi bi-building"></i> Turma</th>
                    <th><i class="bi bi-clock"></i> Período</th>
                    <th><i class="bi bi-sort-numeric-down"></i> Aula</th>
                    <th><i class="bi bi-person-badge"></i> Professor</th>
                    <th><i class="bi bi-person-plus"></i> Substituto</th>
                    <th><i class="bi bi-chat-dots"></i> Situação</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    faltas.forEach((falta, idx) => {
        const dataFormatada = formatarDataBR(falta.data);
        const nomeProfessor = professoresMap.get(falta.matricula_professor) || falta.matricula_professor;
        const nomeSubstituto = falta.substituto || '';
        const temSubstituto = nomeSubstituto && nomeSubstituto.trim() !== '';
        
        // Badge de situação
        let badgeSituacao = '';
        if (temSubstituto) {
            badgeSituacao = `<span class="badge bg-success"><i class="bi bi-check-circle"></i> Substituído</span>`;
        } else {
            badgeSituacao = `<span class="badge bg-danger"><i class="bi bi-exclamation-octagon"></i> Pendente</span>`;
        }
        
        html += `
            <tr>
                <td>${idx + 1}</td>
                <td><strong>${dataFormatada}</strong></td>
                <td>${escapeHtml(falta.curso)}</td>
                <td>${capitalize(falta.periodo)}</td>
                <td>${falta.aula_num}ª aula</td>
                <td>${escapeHtml(nomeProfessor)}</td>
                <td>${temSubstituto ? `<span class="badge-substituto"><i class="bi bi-person-check"></i> ${escapeHtml(nomeSubstituto)}</span>` : '<span class="badge-sem-substituto">Não definido</span>'}</td>
                <td>${badgeSituacao}</td>
            </tr>
        `;
    });
    
    html += `</tbody></table>`;
    tabelaContainer.innerHTML = html;
}

// Exibir resumo estatístico
function exibirResumo(faltas) {
    const total = faltas.length;
    const comSubstituto = faltas.filter(f => f.substituto && f.substituto.trim() !== '').length;
    const semSubstituto = total - comSubstituto;
    
    // Agrupar por professor
    const faltasPorProfessor = new Map();
    faltas.forEach(f => {
        const nome = professoresMap.get(f.matricula_professor) || f.matricula_professor;
        faltasPorProfessor.set(nome, (faltasPorProfessor.get(nome) || 0) + 1);
    });
    
    let topProfessoresHtml = '';
    const sorted = Array.from(faltasPorProfessor.entries()).sort((a,b) => b[1] - a[1]).slice(0, 3);
    if (sorted.length) {
        topProfessoresHtml = `<div class="mt-3">
            <i class="bi bi-bar-chart-steps"></i> <strong>Professores com mais faltas:</strong><br>
            ${sorted.map(([nome, qtd]) => `📌 ${escapeHtml(nome)}: ${qtd} falta(s)`).join('<br>')}
        </div>`;
    }
    
    footerResumo.innerHTML = `
        <div class="resumo-card d-flex justify-content-between align-items-center flex-wrap">
            <div>
                <i class="bi bi-clipboard-data fs-4 me-2"></i>
                <strong>Total de faltas:</strong> ${total} &nbsp;|&nbsp;
                <strong class="text-success">✅ Com substituto:</strong> ${comSubstituto} &nbsp;|&nbsp;
                <strong class="text-danger">⚠️ Pendentes:</strong> ${semSubstituto}
            </div>
            ${topProfessoresHtml}
        </div>
    `;
}

// Exportar para PDF (usando html2pdf)
function exportarPDF() {
    if (!todasFaltas.length) {
        mostrarToast('Nenhum dado para exportar.', 'warning');
        return;
    }
    
    const originalTitle = document.title;
    document.title = `faltas-${mesInput.value}`;
    window.print();
    document.title = originalTitle;
}

// Exportar CSV
function exportarCSV() {
    if (!todasFaltas.length) {
        mostrarToast('Nenhum dado para exportar.', 'warning');
        return;
    }
    
    // Definir cabeçalhos
    const headers = ['Data', 'Turma', 'Período', 'Nº Aula', 'Professor (Matrícula)', 'Professor (Nome)', 'Substituto', 'Situação'];
    const rows = todasFaltas.map(falta => {
        const nomeProfessor = professoresMap.get(falta.matricula_professor) || falta.matricula_professor;
        const situacao = falta.substituto && falta.substituto.trim() !== '' ? 'Com substituto' : 'Sem substituto';
        return [
            formatarDataBR(falta.data),
            falta.curso,
            capitalize(falta.periodo),
            falta.aula_num,
            falta.matricula_professor,
            nomeProfessor,
            falta.substituto || '',
            situacao
        ];
    });
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `relatorio-faltas-${mesInput.value}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    mostrarToast('CSV exportado com sucesso!', 'success');
}

// Funções utilitárias
function formatarDataBR(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

function mostrarLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}