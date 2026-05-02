// faltas.js - Gerenciamento de faltas e substituições

// Variáveis globais
let professoresDisponiveis = [];
let disciplinasLista = [];
let horariosProfessor = [];
let substituicoes = {};
let professorSelecionado = null;
let dataSelecionada = null;
let diaSelecionado = null;

// Dias da semana
const diasDaSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await aguardarDadosCarregados();
    await carregarDadosJSON();
    inicializarSelectProfessores();
    configurarEventListeners();
    
    // Definir data atual como padrão
    const hoje = new Date().toISOString().split('T')[0];
    const dataInput = document.getElementById('dataFalta');
    if (dataInput) {
        dataInput.value = hoje;
        atualizarDiaSemanaInfo();
    }
});

// Aguardar os dados do script principal serem carregados
function aguardarDadosCarregados() {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (typeof professores !== 'undefined' && professores.length > 0) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
        
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 5000);
    });
}

// Carregar dados dos JSONs diretamente
async function carregarDadosJSON() {
    try {
        const responseProf = await fetch('../professores.json');
        if (responseProf.ok) {
            const data = await responseProf.json();
            professoresDisponiveis = data.professores || [];
        } else {
            throw new Error('Erro ao carregar professores');
        }
        
        const responseDisc = await fetch('../disciplinas.json');
        if (responseDisc.ok) {
            const data = await responseDisc.json();
            if (data.disciplinas_ensino_medio) {
                disciplinasLista = data.disciplinas_ensino_medio.map(d => 
                    typeof d === 'string' ? d : d.nome
                );
            }
        } else {
            throw new Error('Erro ao carregar disciplinas');
        }
        
        console.log('Dados carregados:', { professores: professoresDisponiveis.length, disciplinas: disciplinasLista.length });
    } catch (error) {
        console.error('Erro ao carregar JSONs:', error);
        professoresDisponiveis = [
            "Prof. João da Silva", "Profª. Maria Oliveira", "Prof. Pedro Henrique",
            "Profª. Ana Beatriz", "Prof. Lucas Santos", "Profª. Juliana Costa",
            "Prof. Rafael Almeida", "Profª. Camila Rodrigues", "Prof. Bruno Lima"
        ];
        disciplinasLista = [
            "Língua Portuguesa", "Matemática", "Biologia", "Física", "Química",
            "História", "Geografia", "Filosofia", "Sociologia", "Arte"
        ];
    }
}

// Função corrigida para atualizar o badge do dia da semana
function atualizarDiaSemanaInfo() {
    const dataInput = document.getElementById('dataFalta');
    const diaSemanaInfo = document.getElementById('diaSemanaInfo');
    
    if (dataInput && dataInput.value && diaSemanaInfo) {
        // Dividir a data manualmente para evitar problema de timezone
        const partes = dataInput.value.split('-');
        const ano = parseInt(partes[0]);
        const mes = parseInt(partes[1]) - 1;
        const dia = parseInt(partes[2]);
        
        const data = new Date(ano, mes, dia);
        const diaSemana = diasDaSemana[data.getDay()];
        diaSemanaInfo.innerHTML = `<i class="bi bi-calendar-week"></i> Dia da semana: <strong>${diaSemana}</strong>`;
    }
}

// Função corrigida para obter dia da semana a partir da data
function getDiaSemanaFromData(dataString) {
    if (!dataString) return null;
    
    // Dividir a data manualmente para evitar problema de timezone
    const partes = dataString.split('-');
    const ano = parseInt(partes[0]);
    const mes = parseInt(partes[1]) - 1; // Mês em JS é 0-indexado (Janeiro = 0)
    const dia = parseInt(partes[2]);
    
    const data = new Date(ano, mes, dia);
    return diasDaSemana[data.getDay()];
}

// Inicializar select de professores
function inicializarSelectProfessores() {
    const select = document.getElementById('professorFaltante');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um professor...</option>';
    
    professoresDisponiveis.forEach(professor => {
        const option = document.createElement('option');
        option.value = professor;
        option.textContent = professor;
        select.appendChild(option);
    });
}

// Configurar event listeners
function configurarEventListeners() {
    const btnCarregar = document.getElementById('btnCarregarHorario');
    const btnRegistrar = document.getElementById('btnRegistrarFalta');
    const btnCopiar = document.getElementById('btnCopiarWhatsApp');
    const selectProfessor = document.getElementById('professorFaltante');
    const inputData = document.getElementById('dataFalta');
    
    if (btnCarregar) {
        btnCarregar.addEventListener('click', carregarHorariosProfessor);
    }
    
    if (btnRegistrar) {
        btnRegistrar.addEventListener('click', registrarFalta);
    }
    
    if (btnCopiar) {
        btnCopiar.addEventListener('click', copiarMensagemWhatsApp);
    }
    
    if (selectProfessor) {
        selectProfessor.addEventListener('change', () => {
            professorSelecionado = selectProfessor.value;
            atualizarResumo();
        });
    }
    
    if (inputData) {
        inputData.addEventListener('change', () => {
            atualizarDiaSemanaInfo();
            atualizarResumo();
        });
    }
}

// Carregar horários do professor selecionado
function carregarHorariosProfessor() {
    const professor = document.getElementById('professorFaltante').value;
    const data = document.getElementById('dataFalta').value;
    
    if (!professor) {
        mostrarAlerta('Selecione um professor', 'warning');
        return;
    }
    
    if (!data) {
        mostrarAlerta('Selecione a data da falta', 'warning');
        return;
    }
    
    const dia = getDiaSemanaFromData(data);
    if (!dia) {
        mostrarAlerta('Data inválida', 'error');
        return;
    }
    
    professorSelecionado = professor;
    dataSelecionada = data;
    diaSelecionado = dia;
    
    // Buscar horários do professor neste dia
    horariosProfessor = buscarHorariosProfessor(professor, dia);
    
    if (horariosProfessor.length === 0) {
        mostrarAlerta(`Nenhum horário encontrado para ${professor} na ${dia}`, 'info');
        document.getElementById('horariosContainer').innerHTML = `
            <div class="text-center p-5 text-muted">
                <i class="bi bi-calendar-x" style="font-size: 3rem;"></i>
                <p class="mt-3">Nenhum horário encontrado para ${professor} na ${dia}</p>
                <small>Verifique se o professor possui aulas cadastradas neste dia</small>
            </div>
        `;
        document.getElementById('btnRegistrarFalta').disabled = true;
        return;
    }
    
    renderizarTabelaSubstituicoes();
    atualizarResumo();
    document.getElementById('btnRegistrarFalta').disabled = false;
}

// Buscar horários do professor em um dia específico
function buscarHorariosProfessor(professor, dia) {
    const horarios = [];
    
    if (typeof gradeData === 'undefined') {
        console.warn('gradeData não disponível');
        return horarios;
    }
    
    if (typeof cursos === 'undefined') {
        console.warn('cursos não disponível');
        return horarios;
    }
    
    const periodos = ['manha', 'tarde', 'noite'];
    
    for (const curso of cursos) {
        for (const periodo of periodos) {
            const aulas = gradeData[curso]?.[dia]?.[periodo];
            if (aulas) {
                for (const [num, aula] of Object.entries(aulas)) {
                    if (aula && aula.professor === professor && aula.disciplina && aula.disciplina !== '') {
                        horarios.push({
                            curso: curso,
                            periodo: periodo,
                            aulaNum: parseInt(num),
                            disciplina: aula.disciplina,
                            horario: aula.horario,
                            professorOriginal: professor,
                            professorSubstituto: ''
                        });
                    }
                }
            }
        }
    }
    
    const ordemPeriodo = { manha: 1, tarde: 2, noite: 3 };
    horarios.sort((a, b) => {
        if (a.periodo !== b.periodo) return ordemPeriodo[a.periodo] - ordemPeriodo[b.periodo];
        return a.aulaNum - b.aulaNum;
    });
    
    substituicoes = {};
    horarios.forEach((h, index) => {
        substituicoes[index] = {
            ...h,
            professorSubstituto: ''
        };
    });
    
    return horarios;
}

// Renderizar tabela de substituições
function renderizarTabelaSubstituicoes() {
    const container = document.getElementById('horariosContainer');
    
    if (!horariosProfessor.length) return;
    
    let html = `
        <form id="formSubstituicoes">
            <table class="table table-bordered">
                <thead class="table-dark">
                    <tr>
                        <th>Horário</th>
                        <th>Curso</th>
                        <th>Disciplina</th>
                        <th>Professor Substituto</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    for (let i = 0; i < horariosProfessor.length; i++) {
        const horario = horariosProfessor[i];
        const turnoNome = horario.periodo === 'manha' ? '🌅 Manhã' : (horario.periodo === 'tarde' ? '🌙 Tarde' : '⭐ Noite');
        
        html += `
            <tr>
                <td style="vertical-align: middle;">
                    <strong>${turnoNome}</strong><br>
                    <small class="text-muted">${horario.horario}</small>
                </td>
                <td style="vertical-align: middle;">${escapeHtml(horario.curso)}</td>
                <td style="vertical-align: middle;">${escapeHtml(horario.disciplina)}</td>
                <td style="vertical-align: middle;">
                    <select class="form-select form-select-sm" data-index="${i}" id="substituto_${i}" style="min-width: 180px;">
                        <option value="">-- Não substituído --</option>
                        ${gerarOpcoesProfessores(horario.professorOriginal)}
                    </select>
                </td>
            </tr>
        `;
    }
    
    html += `
                </tbody>
            </table>
        </form>
        <div class="alert alert-info mt-3">
            <i class="bi bi-info-circle"></i>
            <strong>Observação:</strong> Selecione o professor substituto para cada aula. Caso não haja substituto, deixe em branco.
        </div>
    `;
    
    container.innerHTML = html;
    
    for (let i = 0; i < horariosProfessor.length; i++) {
        const select = document.getElementById(`substituto_${i}`);
        if (select) {
            select.addEventListener('change', (e) => {
                substituicoes[i].professorSubstituto = e.target.value;
                atualizarResumo();
                atualizarMensagemWhatsApp();
            });
        }
    }
}

// Gerar opções de professores (excluindo o professor faltante)
function gerarOpcoesProfessores(professorFaltante) {
    let options = '';
    
    professoresDisponiveis.forEach(prof => {
        if (prof !== professorFaltante) {
            options += `<option value="${escapeHtml(prof)}">${escapeHtml(prof)}</option>`;
        }
    });
    
    return options;
}

// Atualizar resumo da falta
function atualizarResumo() {
    const resumoDiv = document.getElementById('resumoFalta');
    if (!resumoDiv) return;
    
    const professor = professorSelecionado || 'Não selecionado';
    const data = dataSelecionada || document.getElementById('dataFalta')?.value || 'Não selecionada';
    const dia = diaSelecionado || (data ? getDiaSemanaFromData(data) : 'Não selecionado');
    const motivo = document.getElementById('motivoFalta')?.value || 'Não informado';
    
    const totalAulas = horariosProfessor.length;
    const aulasSubstituidas = Object.values(substituicoes).filter(s => s.professorSubstituto && s.professorSubstituto !== '').length;
    
    resumoDiv.innerHTML = `
        <p class="mb-1"><strong>Professor:</strong> ${escapeHtml(professor)}</p>
        <p class="mb-1"><strong>Data:</strong> ${formatarData(data)}</p>
        <p class="mb-1"><strong>Dia da semana:</strong> ${dia}</p>
        <p class="mb-1"><strong>Motivo:</strong> ${escapeHtml(motivo)}</p>
        <hr class="my-2">
        <p class="mb-1"><strong>Total de aulas:</strong> ${totalAulas}</p>
        <p class="mb-1"><strong>Aulas substituídas:</strong> ${aulasSubstituidas}</p>
        <p class="mb-0"><strong>Aulas sem substituto:</strong> ${totalAulas - aulasSubstituidas}</p>
    `;
    
    atualizarMensagemWhatsApp();
}

// Atualizar mensagem para WhatsApp
function atualizarMensagemWhatsApp() {
    const textarea = document.getElementById('mensagemWhatsApp');
    if (!textarea) return;
    
    const professor = professorSelecionado || 'Professor';
    const data = dataSelecionada || document.getElementById('dataFalta')?.value || 'data a confirmar';
    const dia = diaSelecionado || (data ? getDiaSemanaFromData(data) : 'dia');
    const motivo = document.getElementById('motivoFalta')?.value || 'motivo não informado';
    
    let mensagem = `📋 *COMUNICADO DE FALTA - PEDRAS DE FOGO*\n\n`;
    mensagem += `*Professor:* ${professor}\n`;
    mensagem += `*Data:* ${formatarData(data)}\n`;
    mensagem += `*Dia da semana:* ${dia}\n`;
    mensagem += `*Motivo:* ${motivo}\n\n`;
    mensagem += `*📅 HORÁRIOS E SUBSTITUIÇÕES:*\n\n`;
    
    if (Object.keys(substituicoes).length === 0) {
        mensagem += `Nenhum horário carregado.\n`;
    } else {
        for (const [index, horario] of Object.entries(substituicoes)) {
            const turnoNome = horario.periodo === 'manha' ? '🌅 Manhã' : (horario.periodo === 'tarde' ? '🌙 Tarde' : '⭐ Noite');
            mensagem += `*${turnoNome} - ${horario.horario}*\n`;
            mensagem += `📚 ${horario.disciplina} - ${horario.curso}\n`;
            
            if (horario.professorSubstituto && horario.professorSubstituto !== '') {
                mensagem += `✅ *Substituto:* ${horario.professorSubstituto}\n`;
            } else {
                mensagem += `⚠️ *Substituto:* NÃO DEFINIDO\n`;
            }
            mensagem += `\n`;
        }
    }
    
    const totalAulas = Object.keys(substituicoes).length;
    const aulasSubstituidas = Object.values(substituicoes).filter(s => s.professorSubstituto && s.professorSubstituto !== '').length;
    
    mensagem += `\n*📊 RESUMO:*\n`;
    mensagem += `Total de aulas: ${totalAulas}\n`;
    mensagem += `Aulas com substituto: ${aulasSubstituidas}\n`;
    mensagem += `Aulas sem substituto: ${totalAulas - aulasSubstituidas}\n\n`;
    mensagem += `---\n`;
    mensagem += `📱 *Mensagem automática - Sistema de Gestão de Faltas*\n`;
    mensagem += `Pedras de Fogo - ${new Date().toLocaleDateString('pt-BR')}`;
    
    textarea.value = mensagem;
}

// Formatar data para exibição
function formatarData(dataString) {
    if (!dataString) return 'data não informada';
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}/${mes}/${ano}`;
}

// Copiar mensagem para WhatsApp
function copiarMensagemWhatsApp() {
    const textarea = document.getElementById('mensagemWhatsApp');
    if (!textarea) return;
    
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    
    try {
        navigator.clipboard.writeText(textarea.value);
        mostrarAlerta('Mensagem copiada para a área de transferência!', 'success');
    } catch (err) {
        document.execCommand('copy');
        mostrarAlerta('Mensagem copiada para a área de transferência!', 'success');
    }
}

// Registrar falta e enviar email
function registrarFalta() {
    const professor = professorSelecionado;
    const data = dataSelecionada || document.getElementById('dataFalta')?.value;
    const dia = diaSelecionado || (data ? getDiaSemanaFromData(data) : null);
    const motivo = document.getElementById('motivoFalta')?.value || 'Não informado';
    
    if (!professor || !data || !dia) {
        mostrarAlerta('Preencha todos os dados da falta', 'warning');
        return;
    }
    
    if (Object.keys(substituicoes).length === 0) {
        mostrarAlerta('Carregue os horários do professor primeiro', 'warning');
        return;
    }
    
    const dadosFalta = {
        id: Date.now(),
        professor: professor,
        data: data,
        dataFormatada: formatarData(data),
        diaSemana: dia,
        motivo: motivo,
        substituicoes: Object.values(substituicoes),
        dataRegistro: new Date().toISOString()
    };
    
    console.log('Registrando falta:', dadosFalta);
    
    salvarFaltaNoLocalStorage(dadosFalta);
    enviarEmailChefia(dadosFalta);
    
    mostrarAlerta(`✅ Falta registrada com sucesso! Um email será enviado para a chefia.`, 'success');
    
    setTimeout(() => {
        if (confirm('Deseja limpar o formulário para registrar outra falta?')) {
            limparFormulario();
        }
    }, 1000);
}

// Salvar falta no localStorage
function salvarFaltaNoLocalStorage(dadosFalta) {
    let historicoFaltas = localStorage.getItem('historicoFaltas');
    historicoFaltas = historicoFaltas ? JSON.parse(historicoFaltas) : [];
    historicoFaltas.unshift(dadosFalta);
    if (historicoFaltas.length > 100) {
        historicoFaltas = historicoFaltas.slice(0, 100);
    }
    localStorage.setItem('historicoFaltas', JSON.stringify(historicoFaltas));
}

// Função para enviar email para chefia
function enviarEmailChefia(dadosFalta) {
    console.log('=== ENVIO DE EMAIL (Futura Implementação) ===');
    console.log('Para: chefia@pedrasdefogo.edu.br');
    console.log('Assunto:', `FALTA DE PROFESSOR - ${dadosFalta.professor} - ${dadosFalta.data}`);
    console.log('Dados:', dadosFalta);
    
    const emailSimulado = {
        para: 'chefia@pedrasdefogo.edu.br',
        assunto: `[SISTEMA] FALTA DE PROFESSOR - ${dadosFalta.professor}`,
        corpo: gerarCorpoEmail(dadosFalta)
    };
    
    localStorage.setItem('ultimoEmailSimulado', JSON.stringify(emailSimulado));
}

// Gerar corpo do email
function gerarCorpoEmail(dadosFalta) {
    let corpo = `Prezada Chefia,\n\n`;
    corpo += `Informamos o registro de falta do(a) professor(a) ${dadosFalta.professor}.\n\n`;
    corpo += `📅 Data: ${dadosFalta.dataFormatada}\n`;
    corpo += `📆 Dia da semana: ${dadosFalta.diaSemana}\n`;
    corpo += `💬 Motivo: ${dadosFalta.motivo}\n\n`;
    corpo += `📋 Horários e Substituições:\n`;
    corpo += `─\n`;
    
    for (const sub of dadosFalta.substituicoes) {
        const turnoNome = sub.periodo === 'manha' ? 'Manhã' : (sub.periodo === 'tarde' ? 'Tarde' : 'Noite');
        corpo += `⏰ ${turnoNome} (${sub.horario})\n`;
        corpo += `   📚 ${sub.disciplina} - ${sub.curso}\n`;
        corpo += `   👨‍🏫 Substituto: ${sub.professorSubstituto || 'NÃO DEFINIDO'}\n\n`;
    }
    
    corpo += `─\n`;
    corpo += `Total de aulas: ${dadosFalta.substituicoes.length}\n`;
    corpo += `Aulas com substituto: ${dadosFalta.substituicoes.filter(s => s.professorSubstituto).length}\n`;
    corpo += `Aulas sem substituto: ${dadosFalta.substituicoes.filter(s => !s.professorSubstituto).length}\n\n`;
    corpo += `Atenciosamente,\n`;
    corpo += `Sistema de Gestão de Faltas - Pedras de Fogo\n`;
    corpo += `Este é um email automático, favor não responder.`;
    
    return corpo;
}

// Limpar formulário
function limparFormulario() {
    document.getElementById('professorFaltante').value = '';
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('dataFalta').value = hoje;
    document.getElementById('motivoFalta').value = '';
    document.getElementById('horariosContainer').innerHTML = `
        <div class="text-center p-5 text-muted">
            <i class="bi bi-calendar-plus" style="font-size: 3rem;"></i>
            <p class="mt-3">Selecione um professor e uma data para carregar os horários</p>
            <small>O dia da semana será identificado automaticamente</small>
        </div>
    `;
    document.getElementById('mensagemWhatsApp').value = '';
    document.getElementById('btnRegistrarFalta').disabled = true;
    professorSelecionado = null;
    dataSelecionada = null;
    diaSelecionado = null;
    horariosProfessor = [];
    substituicoes = {};
    atualizarDiaSemanaInfo();
    atualizarResumo();
}

// Mostrar alerta
function mostrarAlerta(mensagem, tipo = 'success') {
    let toastContainer = document.querySelector('.falta-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'falta-toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `falta-toast ${tipo}`;
    toast.style.backgroundColor = tipo === 'success' ? '#28a745' : (tipo === 'error' ? '#dc3545' : (tipo === 'warning' ? '#ffc107' : '#17a2b8'));
    toast.style.color = tipo === 'warning' ? '#000' : '#fff';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.marginBottom = '10px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.animation = 'slideInRight 0.3s ease';
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="bi ${tipo === 'success' ? 'bi-check-circle-fill' : (tipo === 'error' ? 'bi-x-circle-fill' : (tipo === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'))}"></i>
            <span>${mensagem}</span>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Função auxiliar escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Adicionar estilos
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .falta-toast { animation: slideInRight 0.3s ease; cursor: pointer; }
    .falta-toast:hover { opacity: 0.9; }
`;
document.head.appendChild(style);