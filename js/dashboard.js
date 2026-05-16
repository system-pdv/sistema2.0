import { db } from './firebase.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

let chartP = null;
let chartF = null;

// 🔥 CACHE GLOBAL (performance)
let cacheProdutos = null;
let usuarioLogado = null; // Armazena o usuário validado globalmente

// 🔥 RESOLUÇÃO DA DUPLICAÇÃO DA SEMANA: Função globalizada para reaproveitamento comum
function getSemanaAtual() {
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

// 🔥 RESOLUÇÃO DO AUTH: Escuta o estado de autenticação apenas UMA vez no escopo global
const auth = getAuth();
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.warn("Usuário não logado");
        return;
    }

    try {
        const q = query(collection(db, "usuarios"), where("email", "==", user.email));
        const snapUser = await getDocs(q);

        if (snapUser.empty) {
            console.warn("Usuário não encontrado no banco");
            return;
        }

        const nivel = snapUser.docs[0].data().nivel;

        if (nivel !== 'admin' && nivel !== 'gerente') {
            console.warn("Acesso bloqueado ao dashboard");
            return;
        }

        usuarioLogado = user; // Define o usuário validado
        
        // Inicializa os componentes dependentes do banco
        await carregarFiltroProdutos();
        await window.carregarDash();
    } catch (error) {
        console.error("Erro na validação de acesso:", error);
    }
});

window.carregarDash = async function() {
    // Impede a execução se o processo de autenticação global ainda não validou o usuário
    if (!usuarioLogado) return;

    try {
        const dIni = document.getElementById('data-inicio').value;
        const dFim = document.getElementById('data-fim').value;
        const fProd = document.getElementById('dash-filtro-produto').value;
        const fMet = document.getElementById('dash-filtro-pagamento').value;
        
        const { inicio, fim } = getSemanaAtual();

        // 🔥 RESOLUÇÃO DO BUG DE ALERTAS E CACHE TRAVADO:
        // Buscamos os produtos para atualizar o cache e rodar a validação de estoque sempre que carregar o painel
        const snapProd = await getDocs(collection(db, "produtos"));
        cacheProdutos = {};
        let alertas = '';

        snapProd.forEach(doc => {
            const p = doc.data();
            cacheProdutos[p.nome] = p.preco_custo || 0;

            if (p.estoque <= 5) {
                alertas += `<li style="color:red; font-weight:bold;">⚠️ ${p.nome}: ${p.estoque} un</li>`;
            }
        });

        document.getElementById('dash-alertas').innerHTML = alertas;

        const dataInicioFiltro = dIni ? new Date(dIni + "T00:00:00") : inicio;
        const dataFimFiltro = dFim ? new Date(dFim + "T23:59:59") : fim;

        // 🔥 RESOLUÇÃO DO VAZAMENTO: Filtrando as vendas por data direto no Firestore
        const qVendas = query(
            collection(db, "vendas"),
            where("data", ">=", dataInicioFiltro),
            where("data", "<=", dataFimFiltro)
        );
        const snapV = await getDocs(qVendas);

        let fatTotal = 0, custoTotal = 0, qtdHoje = 0, qtdEstornos = 0;
        const dadosProd = {}, dadosFin = { Dinheiro: 0, Pix: 0, Débito: 0, Crédito: 0 };

        snapV.forEach(d => {
            const v = d.data();

            // 🔥 Separa e contabiliza os estornos
            if (v.status === 'cancelada') {
                qtdEstornos++;
                return; // Ignora o cálculo financeiro desta venda
            }

            // Remoção das validações manuais de data que agora são feitas pelo banco
            if (fMet !== 'todos' && v.metodo !== fMet) return;

            if (!v.itens) return;

            let vendaValida = false;

            Object.values(v.itens).forEach(i => {
                if (fProd === 'todos' || i.nome === fProd) {

                    vendaValida = true;

                    const qtd = i.qtd || 1;

                    dadosProd[i.nome] = (dadosProd[i.nome] || 0) + qtd;

                    const custo = (cacheProdutos[i.nome] || 0) * qtd;
                    const fat = i.preco * qtd;

                    custoTotal += custo;
                    fatTotal += fat;
                }
            });

            if (vendaValida) {
                if (dadosFin[v.metodo] !== undefined) {
                    dadosFin[v.metodo] += v.total;
                }
                qtdHoje++;
            }
        });

        document.getElementById('dash-custo-total').innerText =
            `R$ ${custoTotal.toFixed(2).replace('.', ',')}`;

        document.getElementById('dash-fatur').innerText =
            `R$ ${fatTotal.toFixed(2).replace('.', ',')}`;

        document.getElementById('dash-lucro').innerText =
            `R$ ${(fatTotal - custoTotal).toFixed(2).replace('.', ',')}`;

        document.getElementById('dash-hoje').innerText = qtdHoje;
        
        // Renderiza a quantidade de estornos no novo elemento HTML
        const txtEstornos = document.getElementById('dash-estornos');
        if (txtEstornos) txtEstornos.innerText = qtdEstornos;

        chartP?.destroy();
        chartP = new Chart(document.getElementById('chartProdutos'), {
            type: 'bar',
            data: {
                labels: Object.keys(dadosProd),
                datasets: [{
                    label: 'Qtd Vendida',
                    data: Object.values(dadosProd),
                    backgroundColor: '#3498db'
                }]
            }
        });

        chartF?.destroy();
        chartF = new Chart(document.getElementById('chartFinanceiro'), {
            type: 'pie',
            data: {
                labels: Object.keys(dadosFin),
                datasets: [{
                    data: Object.values(dadosFin),
                    backgroundColor: ['#27ae60', '#f39c12', '#2c3e50', '#e74c3c']
                }]
            }
        });
    } catch (error) {
        console.error("Erro ao carregar os dados do dashboard:", error);
    }
}

function baixarArquivo(conteudo, nomeArquivo) {
    const blob = new Blob(["\ufeff" + conteudo], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", nomeArquivo);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.baixarCSVVendas = async function() {

    try {
        const dIni = document.getElementById('data-inicio').value;
        const dFim = document.getElementById('data-fim').value;
        const fProd = document.getElementById('dash-filtro-produto').value;
        const fMet = document.getElementById('dash-filtro-pagamento').value;

        // 🔥 RESOLUÇÃO DO CACHE DUPLICADO: Reaproveita o cache global de produtos se já existir
        if (!cacheProdutos) {
            const snapProdutos = await getDocs(collection(db, "produtos"));
            cacheProdutos = {};
            snapProdutos.forEach(doc => {
                const p = doc.data();
                cacheProdutos[p.nome] = p.preco_custo || 0;
            });
        }

        const { inicio, fim } = getSemanaAtual();

        const dataInicioFiltro = dIni ? new Date(dIni + "T00:00:00") : inicio;
        const dataFimFiltro = dFim ? new Date(dFim + "T23:59:59") : fim;

        // 🔥 RESOLUÇÃO DO VAZAMENTO NO CSV: Filtrando as vendas por data direto no Firestore
        const qVendas = query(
            collection(db, "vendas"),
            where("data", ">=", dataInicioFiltro),
            where("data", "<=", dataFimFiltro)
        );
        const snapV = await getDocs(qVendas);

        let csv = 'Data;Produto;Qtd;Preco Custo;Preco Venda (Unit);Metodo Pagamento;Subtotal;Lucro Estimado\n';

        snapV.forEach(d => {

            const v = d.data();

            // 🔥 Filtra para que vendas canceladas/estornadas não entrem no relatório financeiro em CSV
            if (v.status === 'cancelada') return;

            const dataV = v.data?.toDate ? v.data.toDate() : new Date(v.data);

            // Remoção das validações manuais de data que agora são feitas pelo banco
            if (fMet !== 'todos' && v.metodo !== fMet) return;

            if (!v.itens) return;

            Object.values(v.itens).forEach(item => {

                if (fProd === 'todos' || item.nome === fProd) {

                    const dataFormatada = dataV.toLocaleString();

                    const nomeProduto = item.nome;
                    const qtd = item.qtd || 1;

                    const custoNum = parseFloat(cacheProdutos[nomeProduto] || 0); // Utiliza o cache global
                    const precoVendaNum = parseFloat(item.preco || 0);

                    const custoUnitario = custoNum.toFixed(2).replace('.', ',');
                    const precoVenda = precoVendaNum.toFixed(2).replace('.', ',');

                    const subtotalNum = precoVendaNum * qtd;
                    const subtotalItem = subtotalNum.toFixed(2).replace('.', ',');

                    const metodo = v.metodo;

                    const lucroLinha =
                        (subtotalNum - (custoNum * qtd)).toFixed(2).replace('.', ',');

                    csv += `${dataFormatada};${nomeProduto};${qtd};${custoUnitario};${precoVenda};${metodo};${subtotalItem};${lucroLinha}\n`;
                }
            });
        });

        baixarArquivo(csv, 'relatorio_vendas.csv');
    } catch (error) {
        console.error("Erro ao gerar o arquivo CSV:", error);
    }
};

//Limpar Filtro
window.limparFiltrosDashboard = function() {

    document.getElementById('data-inicio').value = '';
    document.getElementById('data-fim').value = '';
    document.getElementById('dash-filtro-produto').value = 'todos';
    document.getElementById('dash-filtro-pagamento').value = 'todos';

    // Limpa o cache local para forçar a atualização imediata dos dados e alertas ao clicar no botão limpar
    cacheProdutos = null;

    window.carregarDash();
};

document.getElementById('btn-limpar-filtros')
    .addEventListener('click', window.limparFiltrosDashboard);

async function carregarFiltroProdutos() {

    try {
        const select = document.getElementById('dash-filtro-produto');
        
        // 🔥 RESOLUÇÃO DO BUG DO SELECT: Reseta as opções internas para evitar duplicidades estruturais
        select.innerHTML = '<option value="todos">Todos os Produtos</option>';

        // 🔥 GARANTE O CACHE: Reaproveita o cache global aqui também se ele já tiver sido carregado
        if (!cacheProdutos) {
            const snap = await getDocs(collection(db, "produtos"));
            cacheProdutos = {};
            snap.forEach(doc => {
                const p = doc.data();
                cacheProdutos[p.nome] = p.preco_custo || 0;
            });
        }

        const produtos = new Set(Object.keys(cacheProdutos));

        produtos.forEach(nome => {
            const option = document.createElement('option');
            option.value = nome;
            option.textContent = nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar filtro de produtos:", error);
    }
}