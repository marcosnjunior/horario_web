// pdfGenerator.js - Funções para geração de PDF

// Função principal para gerar PDF da grade completa
async function gerarPDFGrade() {
    try {
        mostrarToastPDF('Gerando PDF... Aguarde', 'info');
        
        // Criar elemento temporário para renderização do PDF
        const pdfContent = document.createElement('div');
        pdfContent.className = 'pdf-content';
        pdfContent.style.padding = '20px';
        pdfContent.style.fontFamily = 'Arial, sans-serif';
        
        // Adicionar cabeçalho
        pdfContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #0d6efd; margin-bottom: 10px;">📅 Horário Pedras de Fogo</h1>
                <p style="font-size: 16px; color: #666;">2026.1 - Grade Horária Completa</p>
                <p style="font-size: 14px; color: #666;">Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
                <hr style="border: 1px solid #0d6efd;">
            </div>
        `;
        
        // Para cada curso, gerar a tabela (apenas turnos com aulas)
        for (const curso of cursos) {
            let temAulaNoCurso = false;
            let htmlCurso = '';
            
            // Verificar se o curso tem alguma aula cadastrada
            const turnosComAula = [];
            
            // Verificar manhã
            if (temAulasNoPeriodo(curso, 'manha')) {
                turnosComAula.push('manha');
                temAulaNoCurso = true;
            }
            
            // Verificar tarde
            if (temAulasNoPeriodo(curso, 'tarde')) {
                turnosComAula.push('tarde');
                temAulaNoCurso = true;
            }
            
            // Verificar noite
            if (temAulasNoPeriodo(curso, 'noite')) {
                turnosComAula.push('noite');
                temAulaNoCurso = true;
            }
            
            // Se o curso tiver alguma aula, adicionar ao PDF
            if (temAulaNoCurso) {
                pdfContent.innerHTML += `
                    <div style="margin-top: 30px; margin-bottom: 15px; page-break-inside: avoid;">
                        <h2 style="background-color: #0d6efd; color: white; padding: 10px; border-radius: 5px;">
                            🏫 ${curso}
                        </h2>
                    </div>
                `;
                
                for (const turno of turnosComAula) {
                    pdfContent.innerHTML += gerarTabelaPeriodoPDF(curso, turno);
                }
            }
        }
        
        // Adicionar relatório de professores
        pdfContent.innerHTML += gerarRelatorioProfessoresPDF();
        
        // Adicionar legenda
        pdfContent.innerHTML += gerarLegendaPDF();
        
        // Opções para o PDF
        const opt = {
            margin: [10, 10, 10, 10],
            filename: `grade_horaria_completa_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        
        // Verificar se html2pdf está disponível
        if (typeof html2pdf === 'undefined') {
            throw new Error('Biblioteca html2pdf não encontrada. Verifique se o script foi carregado.');
        }
        
        // Gerar PDF
        await html2pdf().set(opt).from(pdfContent).save();
        
        mostrarToastPDF('PDF gerado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        mostrarToastPDF('Erro ao gerar PDF: ' + error.message, 'error');
    }
}

// Função para verificar se um período tem alguma aula cadastrada
function temAulasNoPeriodo(curso, periodo) {
    for (const dia of diasSemana) {
        const aulas = gradeData[curso]?.[dia]?.[periodo];
        if (aulas) {
            for (const aula of Object.values(aulas)) {
                if (aula && aula.disciplina && aula.disciplina !== '') {
                    return true;
                }
            }
        }
    }
    return false;
}

// Função para verificar se uma aula específica está ocupada
function aulaEstaOcupada(aula) {
    return aula && aula.disciplina && aula.disciplina !== '' && aula.professor && aula.professor !== '';
}

// Função para gerar relatório de professores
function gerarRelatorioProfessoresPDF() {
    // Mapa para armazenar horários dos professores
    const professoresHorarios = new Map();
    
    // Coletar todos os horários dos professores
    for (const curso of cursos) {
        for (const dia of diasSemana) {
            for (const periodo of periodos) {
                const aulas = gradeData[curso]?.[dia]?.[periodo];
                if (aulas) {
                    for (const [num, aula] of Object.entries(aulas)) {
                        if (aulaEstaOcupada(aula)) {
                            if (!professoresHorarios.has(aula.professor)) {
                                professoresHorarios.set(aula.professor, []);
                            }
                            
                            professoresHorarios.get(aula.professor).push({
                                curso: curso,
                                dia: dia,
                                periodo: periodo,
                                aulaNum: parseInt(num),
                                disciplina: aula.disciplina,
                                horario: aula.horario
                            });
                        }
                    }
                }
            }
        }
    }
    
    if (professoresHorarios.size === 0) {
        return '<div style="margin-top: 30px;"><h3 style="color: #0d6efd;">👨‍🏫 Relatório de Professores</h3><p>Nenhum professor cadastrado.</p></div>';
    }
    
    // Ordenar professores
    const professoresOrdenados = Array.from(professoresHorarios.keys()).sort();
    
    let html = `
        <div style="margin-top: 40px; page-break-before: avoid;">
            <h2 style="background-color: #28a745; color: white; padding: 10px; border-radius: 5px; margin-bottom: 20px;">
                👨‍🏫 RELATÓRIO DE PROFESSORES - DIAS E TURNOS NO CAMPUS
            </h2>
    `;
    
    for (const professor of professoresOrdenados) {
        const horarios = professoresHorarios.get(professor);
        
        // Agrupar por dia da semana
        const horariosPorDia = {};
        for (const horario of horarios) {
            if (!horariosPorDia[horario.dia]) {
                horariosPorDia[horario.dia] = [];
            }
            horariosPorDia[horario.dia].push(horario);
        }
        
        html += `
            <div style="margin-bottom: 25px; page-break-inside: avoid; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #e3f2fd; padding: 10px 15px; border-bottom: 2px solid #0d6efd;">
                    <h3 style="margin: 0; color: #0d6efd; font-size: 16px;">
                        <i class="bi bi-person-badge"></i> ${escapeHtml(professor)}
                    </h3>
                </div>
                <div style="padding: 15px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="padding: 8px; border: 1px solid #dee2e6; text-align: left;">Dia da Semana</th>
                                <th style="padding: 8px; border: 1px solid #dee2e6; text-align: left;">Turno</th>
                                <th style="padding: 8px; border: 1px solid #dee2e6; text-align: left;">Curso</th>
                                <th style="padding: 8px; border: 1px solid #dee2e6; text-align: left;">Disciplina</th>
                                <th style="padding: 8px; border: 1px solid #dee2e6; text-align: left;">Horário</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        // Ordenar dias da semana
        const diasOrdenados = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        for (const dia of diasOrdenados) {
            if (horariosPorDia[dia]) {
                // Ordenar horários por período e aula
                horariosPorDia[dia].sort((a, b) => {
                    const ordemPeriodo = { manha: 1, tarde: 2, noite: 3 };
                    if (a.periodo !== b.periodo) return ordemPeriodo[a.periodo] - ordemPeriodo[b.periodo];
                    return a.aulaNum - b.aulaNum;
                });
                
                for (const horario of horariosPorDia[dia]) {
                    const turnoNome = horario.periodo === 'manha' ? 'Manhã' : (horario.periodo === 'tarde' ? 'Tarde' : 'Noite');
                    html += `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #dee2e6;">${horario.dia}</td>
                            <td style="padding: 8px; border: 1px solid #dee2e6;">
                                <strong>${turnoNome}</strong><br>
                                <small>Aula ${horario.aulaNum}</small>
                            </td>
                            <td style="padding: 8px; border: 1px solid #dee2e6;">${escapeHtml(horario.curso)}</td>
                            <td style="padding: 8px; border: 1px solid #dee2e6;">${escapeHtml(horario.disciplina)}</td>
                            <td style="padding: 8px; border: 1px solid #dee2e6;">${horario.horario}</td>
                        </tr>
                    `;
                }
            }
        }
        
        html += `
                        </tbody>
                    </table>
                    <div style="margin-top: 10px; font-size: 12px; color: #666;">
                        <strong>Total de aulas:</strong> ${horarios.length} aulas
                    </div>
                </div>
            </div>
        `;
    }
    
    // Resumo estatístico
    html += `
        <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
            <h4 style="color: #0d6efd; margin-bottom: 10px;">📊 Resumo Geral</h4>
            <ul style="margin: 0;">
                <li><strong>Total de professores:</strong> ${professoresOrdenados.length}</li>
                <li><strong>Total de aulas ministradas:</strong> ${Array.from(professoresHorarios.values()).reduce((sum, h) => sum + h.length, 0)}</li>
            </ul>
        </div>
    `;
    
    html += `</div>`;
    return html;
}

// Função para gerar tabela de um período específico
function gerarTabelaPeriodoPDF(curso, periodo) {
    let horarios;
    let periodoNome;
    let periodoIcon;
    
    if (periodo === 'manha') {
        horarios = horariosManha;
        periodoNome = 'MANHÃ';
        periodoIcon = '🌅';
    } else if (periodo === 'tarde') {
        horarios = horariosTarde;
        periodoNome = 'TARDE';
        periodoIcon = '🌙';
    } else {
        horarios = horariosNoite;
        periodoNome = 'NOITE';
        periodoIcon = '⭐';
    }
    
    // Verificar se o período tem alguma aula neste curso
    let temAula = false;
    for (const dia of diasSemana) {
        const aulas = gradeData[curso]?.[dia]?.[periodo];
        if (aulas) {
            for (const aula of Object.values(aulas)) {
                if (aula && aula.disciplina && aula.disciplina !== '') {
                    temAula = true;
                    break;
                }
            }
        }
        if (temAula) break;
    }
    
    if (!temAula) return '';
    
    let html = `
        <div style="margin-top: 20px; page-break-inside: avoid;">
            <h3 style="color: #0d6efd; margin-bottom: 10px;">${periodoIcon} PERÍODO DA ${periodoNome}</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background-color: #f8f9fa; border: 1px solid #dee2e6;">
                        <th style="padding: 10px; border: 1px solid #dee2e6; text-align: left;">Horário</th>
                        ${diasSemana.map(dia => `<th style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${dia}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    let aulaCount = 1;
    
    for (const horario of horarios) {
        if (horario.intervalo) {
            // Verificar se tem alguma aula perto deste intervalo
            let temAulaProxima = false;
            for (const dia of diasSemana) {
                const aulaAntes = gradeData[curso]?.[dia]?.[periodo]?.[aulaCount - 1];
                const aulaDepois = gradeData[curso]?.[dia]?.[periodo]?.[aulaCount];
                if ((aulaAntes && aulaAntes.disciplina) || (aulaDepois && aulaDepois.disciplina)) {
                    temAulaProxima = true;
                    break;
                }
            }
            
            if (temAulaProxima) {
                html += `
                    <tr style="background-color: #fff3cd;">
                        <td style="padding: 8px; border: 1px solid #dee2e6;">
                            <strong>☕ INTERVALO</strong><br>
                            <small>${horario.inicio} - ${horario.fim}</small>
                        </td>
                        ${diasSemana.map(() => `<td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">☕</td>`).join('')}
                    </tr>
                `;
            }
        } else {
            // Verificar se esta aula tem conteúdo
            let temConteudo = false;
            for (const dia of diasSemana) {
                const aula = gradeData[curso]?.[dia]?.[periodo]?.[aulaCount];
                if (aula && aula.disciplina && aula.disciplina !== '') {
                    temConteudo = true;
                    break;
                }
            }
            
            if (temConteudo) {
                html += `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                            ${horario.inicio} - ${horario.fim}<br>
                            <small style="color: #666;">${periodoNome}</small>
                        </td>
                        ${diasSemana.map(dia => renderizarCelulaPDF(curso, dia, periodo, aulaCount)).join('')}
                    </tr>
                `;
            }
            aulaCount++;
        }
    }
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

// Função para renderizar célula no PDF
function renderizarCelulaPDF(curso, dia, periodo, aulaNum) {
    const aula = gradeData[curso]?.[dia]?.[periodo]?.[aulaNum];
    const isEmpty = !aula || !aula.disciplina || aula.disciplina === '';
    
    if (isEmpty) {
        return `<td style="padding: 8px; border: 1px solid #dee2e6; text-align: center; background-color: #f8f9fa;">
                    <span style="color: #999;">---</span>
                </td>`;
    }
    
    // Verificar conflito para highlighting
    let temConflito = false;
    if (aula.professor) {
        const conflitos = verificarConflitosProfessor(curso, dia, periodo, aulaNum, aula.professor);
        temConflito = conflitos.length > 0;
    }
    
    const corFundo = getDisciplinaCor(aula.disciplina);
    const estiloConflito = temConflito ? 'border-left: 3px solid #ffc107;' : '';
    
    return `
        <td style="padding: 8px; border: 1px solid #dee2e6; background-color: ${corFundo}; ${estiloConflito}">
            <div style="font-weight: bold; color: #333; font-size: 11px;">${escapeHtml(aula.disciplina)}</div>
            <div style="font-size: 10px; color: #666; margin-top: 5px;">
                ${escapeHtml(aula.professor)}
                ${temConflito ? '<span style="color: #ffc107;"> ⚠️</span>' : ''}
            </div>
            <div style="font-size: 9px; color: #999; margin-top: 3px;">${aula.horario}</div>
        </td>
    `;
}

// Função para gerar legenda no PDF
function gerarLegendaPDF() {
    let html = `
        <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; page-break-inside: avoid;">
            <h4 style="color: #0d6efd; margin-bottom: 10px;">📌 Legenda de Cores por Disciplina</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
    `;
    
    disciplinas.slice(0, 15).forEach(disciplina => {
        html += `
            <div style="display: inline-flex; align-items: center; gap: 5px; margin-right: 15px; margin-bottom: 8px;">
                <div style="width: 20px; height: 20px; background-color: ${disciplina.cor}; border: 1px solid #ddd; border-radius: 3px;"></div>
                <span style="font-size: 11px;">${disciplina.nome}</span>
            </div>
        `;
    });
    
    html += `
            </div>
            <div style="margin-top: 15px; font-size: 12px; color: #666;">
                <p>⚠️ <strong>Atenção:</strong> Células com borda amarela indicam conflito de horário do professor.</p>
                <p>📅 Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>
    `;
    
    return html;
}

// Função para mostrar toast específico para PDF
function mostrarToastPDF(mensagem, tipo = 'success') {
    let toastContainer = document.querySelector('.pdf-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'pdf-toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `pdf-toast ${tipo}`;
    toast.style.backgroundColor = tipo === 'success' ? '#28a745' : (tipo === 'error' ? '#dc3545' : '#17a2b8');
    toast.style.color = 'white';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.marginBottom = '10px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.animation = 'slideInRight 0.3s ease';
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="bi ${tipo === 'success' ? 'bi-check-circle-fill' : (tipo === 'error' ? 'bi-x-circle-fill' : 'bi-info-circle-fill')}"></i>
            <span>${mensagem}</span>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Adicionar animações CSS para o toast
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .pdf-toast {
        animation: slideInRight 0.3s ease;
    }
`;
document.head.appendChild(style);