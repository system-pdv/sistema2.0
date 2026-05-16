import { db } from './firebase.js';
import { collection, getDocs, doc, query, where, runTransaction, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Função auxiliar idêntica à global para pegar o período padrão (semana atual)
function getSemanaAtualVendas() {
    const hoje = new Date();
    const diaSemana = hoje.getDay();
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - diaSemana);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    fim.setHours(23, 59, 59, 999);
    return { inicio, fim };
}

// 🔥 Carrega e renderiza o histórico na tabela
window.carregarHistoricoVendas = async function() {
    try {
        const dIni = document.getElementById('vendas-data-inicio').value;
        const dFim = document.getElementById('vendas-data-fim').value;
        
        const { inicio, fim } = getSemanaAtualVendas();
        const dataInicioFiltro = dIni ? new Date(dIni + "T00:00:00") : inicio;
        const dataFimFiltro = dFim ? new Date(dFim + "T23:59:59") : fim;

        // Busca direto no Firestore limitando por data para não quebrar performance
        const qVendas = query(
            collection(db, "vendas"),
            where("data", ">=", Timestamp.fromDate(dataInicioFiltro)),
            where("data", "<=", Timestamp.fromDate(dataFimFiltro))
        );
        
        const snapV = await getDocs(qVendas);
        const tabelaCorpo = document.getElementById('lista-historico-vendas');
        tabelaCorpo.innerHTML = ''; // Limpa a tabela antes de preencher

        if (snapV.empty) {
            tabelaCorpo.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:15px;">Nenhuma venda encontrada para este período.</td></tr>`;
            return;
        }

        // Mapeia os documentos encontrados
        let listaVendas = [];
        snapV.forEach(doc => {
            listaVendas.push({ id: doc.id, ...doc.data() });
        });

        // Ordena da mais recente para a mais antiga na memória
        listaVendas.sort((a, b) => b.data.toDate() - a.data.toDate());

        listaVendas.forEach(venda => {
            const dataV = venda.data?.toDate ? venda.data.toDate() : new Date(venda.data);
            const dataFormatada = dataV.toLocaleString('pt-BR');

            // Monta o texto descritivo dos itens da venda
            let itensTexto = '';
            Object.values(venda.itens).forEach(i => {
                itensTexto += `${i.qtd}x ${i.nome}<br>`;
            });

            const totalFormatado = `R$ ${(venda.total || 0).toFixed(2).replace('.', ',')}`;
            
            // Estilização visual do Status
            const statusCancelado = venda.status === 'cancelada';
            const statusBadge = statusCancelado 
                ? `<span style="color: #e74c3c; font-weight: bold; background: #fdedec; padding: 2px 6px; border-radius: 4px;">Cancelada</span>`
                : `<span style="color: #27ae60; font-weight: bold; background: #e8f8f5; padding: 2px 6px; border-radius: 4px;">Concluída</span>`;

            // Botão de ação (Fica desativado se a venda já estiver cancelada)
            const botaoAcao = statusCancelado
                ? `<button disabled style="opacity:0.5; cursor:not-allowed;">Estornado</button>`
                : `<button class="btn-estorno" data-id="${venda.id}" style="background-color:#e74c3c; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px;">🔄 Estornar</button>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px;">${dataFormatada}</td>
                <td style="padding: 10px;">${itensTexto}</td>
                <td style="padding: 10px;">${venda.metodo || 'Não informado'}</td>
                <td style="padding: 10px; font-weight: bold;">${totalFormatado}</td>
                <td style="padding: 10px; text-align: center;">${statusBadge}</td>
                <td style="padding: 10px; text-align: center;">${botaoAcao}</td>
            `;

            // Adiciona o evento de clique dinamicamente no botão de estorno da linha
            if (!statusCancelado) {
                tr.querySelector('.btn-estorno').addEventListener('click', () => {
                    window.estornarVendaFinalizada(venda.id, venda.itens);
                });
            }

            tabelaCorpo.appendChild(tr);
        });

    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
    }
};

// 🔥 Executa o estorno atômico: cancela a venda e devolve os produtos para a coleção "produtos"
window.estornarVendaFinalizada = function(idVenda, itensVenda) {
    const modal = document.getElementById('modal-estorno');
    const btnConfirmar = document.getElementById('btn-modal-confirmar');
    const btnCancelar = document.getElementById('btn-modal-cancelar');

    // Exibe o modal centralizado na tela
    modal.style.display = 'flex';

    // Remove listeners antigos para não acumular cliques de idVenda diferentes
    const novoBtnConfirmar = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(novoBtnConfirmar, btnConfirmar);

    // Se o usuário clicar em "Voltar", apenas esconde a janelinha
    btnCancelar.onclick = function() {
        modal.style.display = 'none';
    };

    // Se o usuário confirmar, executa o estorno de fato dentro do banco
    novoBtnConfirmar.onclick = async function() {
        modal.style.display = 'none'; // Esconde o modal para seguir o processo

        try {
            const vendaRef = doc(db, "vendas", idVenda);

            // Executa via Transação para garantir consistência total dos dados
            await runTransaction(db, async (transaction) => {
                
                // 1. Criamos um array na memória para guardar as leituras e novos estoques antes de escrever
                let atualizacoesEstoque = [];

                // 2. Fazemos TODAS as leituras primeiro (requisito obrigatório do Firebase)
                for (const item of Object.values(itensVenda)) {
                    
                    // 🛠️ CORREÇÃO: Usa o item.id (ou item.id_carrinho/id se gravado) para achar o documento correto
                    const idProdutoCorreto = item.id || item.nome; 
                    const produtoRef = doc(db, "produtos", idProdutoCorreto);
                    const snapProduto = await transaction.get(produtoRef);

                    if (!snapProduto.exists()) {
                        throw `Produto "${item.nome}" não encontrado no cadastro para fazer a devolução.`;
                    }

                    const estoqueAtual = snapProduto.data().estoque || 0;
                    const qtdOriginal = item.qtd || 1;

                    // Salva o caminho do produto e o cálculo do novo estoque na memória
                    atualizacoesEstoque.push({
                        ref: produtoRef,
                        novoEstoque: estoqueAtual + qtdOriginal
                    });
                }

                // 3. Agora que NENHUMA leitura mais será feita, executamos TODAS as escritas juntas
                for (const atualizacao of atualizacoesEstoque) {
                    transaction.update(atualizacao.ref, { estoque: atualizacao.novoEstoque });
                }

                // 4. Por fim, atualiza o status da venda na coleção "vendas"
                transaction.update(vendaRef, { status: "cancelada" });
            });

            // 🔥 TROCA DO ALERT POR MODAL PERSONALIZADO DE SUCESSO:
            const modalSucesso = document.getElementById('modal-sucesso-estorno');
            const btnSucessoOk = document.getElementById('btn-modal-sucesso-ok');
            
            modalSucesso.style.display = 'flex'; // Abre a tela de sucesso
            
            btnSucessoOk.onclick = function() {
                modalSucesso.style.display = 'none'; // Fecha ao clicar em Ok
            };
            
            // Recarrega a própria tabela de histórico
            await window.carregarHistoricoVendas();

            // Se o painel do dashboard estiver aberto em segundo plano, avisa ele para se recalcular
            if (typeof window.carregarDash === 'function') {
                await window.carregarDash();
            }

        } catch (error) {
            console.error("Falha no estorno:", error);
            alert("Erro ao processar estorno: " + error);
        }
    };
};

// Listeners dos botões de filtro da tela de histórico
document.getElementById('btn-filtrar-vendas').addEventListener('click', window.carregarHistoricoVendas);