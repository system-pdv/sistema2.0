import { db } from './firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

let chartP = null;
let chartF = null;

window.carregarDash = async function() {
    const dIni = document.getElementById('data-inicio').value;
    const dFim = document.getElementById('data-fim').value;
    const fProd = document.getElementById('dash-filtro-produto').value;
    const fMet = document.getElementById('dash-filtro-pagamento').value;

    const snapProd = await getDocs(collection(db, "produtos"));
    let alertas = '';
    const mapaCustos = {};
    snapProd.forEach(doc => {
        const p = doc.data();
        mapaCustos[p.nome] = p.preco_custo || 0;
        if(p.estoque <= 5) alertas += `<li style="color:red; font-weight:bold;">⚠️ ${p.nome}: ${p.estoque} un</li>`;
    });
    document.getElementById('dash-alertas').innerHTML = alertas;

    const snapV = await getDocs(collection(db, "vendas"));
    let fatTotal = 0, custoTotal = 0, qtdHoje = 0;
    const hj = new Date().toLocaleDateString();
    const dadosProd = {}, dadosFin = { Dinheiro: 0, Pix: 0, Débito: 0, Crédito: 0 };

    const dataInicioFiltro = dIni ? new Date(dIni + "T00:00:00") : null;
    const dataFimFiltro = dFim ? new Date(dFim + "T23:59:59") : null;

    snapV.forEach(d => {
        const v = d.data();
        const dataV = new Date(v.data);
        
        if(dataInicioFiltro && dataV < dataInicioFiltro) return;
        if(dataFimFiltro && dataV > dataFimFiltro) return;
        if(fMet !== 'todos' && v.metodo !== fMet) return;

        let vendaValida = false;
        v.itens.forEach(i => {
            if(fProd === 'todos' || i.nome === fProd) {
                vendaValida = true;
                const qtd = i.qtd || 1;
                dadosProd[i.nome] = (dadosProd[i.nome] || 0) + qtd;
                custoTotal += (mapaCustos[i.nome] || 0) * qtd;
                fatTotal += (i.preco * qtd);
            }
        });

        if(vendaValida) {
            dadosFin[v.metodo] += v.total;
            if(dataV.toLocaleDateString() === hj) qtdHoje++;
        }
    });

    document.getElementById('dash-custo-total').innerText = `R$ ${custoTotal.toFixed(2).replace('.',',')}`;
    document.getElementById('dash-fatur').innerText = `R$ ${fatTotal.toFixed(2).replace('.',',')}`;
    document.getElementById('dash-lucro').innerText = `R$ ${(fatTotal - custoTotal).toFixed(2).replace('.',',')}`;
    document.getElementById('dash-hoje').innerText = qtdHoje;

    if(chartP) chartP.destroy();
    chartP = new Chart(document.getElementById('chartProdutos'), {
        type: 'bar',
        data: { labels: Object.keys(dadosProd), datasets: [{ label: 'Qtd Vendida', data: Object.values(dadosProd), backgroundColor: '#3498db' }] }
    });

    if(chartF) chartF.destroy();
    chartF = new Chart(document.getElementById('chartFinanceiro'), {
        type: 'pie',
        data: { labels: Object.keys(dadosFin), datasets: [{ data: Object.values(dadosFin), backgroundColor: ['#27ae60', '#f39c12', '#2c3e50', '#e74c3c'] }] }
    });
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
    const dIni = document.getElementById('data-inicio').value;
    const dFim = document.getElementById('data-fim').value;
    const fProd = document.getElementById('dash-filtro-produto').value;
    const fMet = document.getElementById('dash-filtro-pagamento').value;

    const snapProdutos = await getDocs(collection(db, "produtos"));
    const mapaCustos = {};
    snapProdutos.forEach(doc => {
        const p = doc.data();
        mapaCustos[p.nome] = p.preco_custo || 0;
    });

    const snapV = await getDocs(collection(db, "vendas"));
    let csv = 'Data;Produto;Qtd;Preco Custo;Preco Venda (Unit);Metodo Pagamento;Subtotal\n';

    const dataInicioFiltro = dIni ? new Date(dIni + "T00:00:00") : null;
    const dataFimFiltro = dFim ? new Date(dFim + "T23:59:59") : null;

    snapV.forEach(d => {
        const v = d.data();
        const dataV = new Date(v.data);
        if(dataInicioFiltro && dataV < dataInicioFiltro) return;
        if(dataFimFiltro && dataV > dataFimFiltro) return;
        if(fMet !== 'todos' && v.metodo !== fMet) return;

        v.itens.forEach(item => {
            if(fProd === 'todos' || item.nome === fProd) {
                const dataFormatada = dataV.toLocaleString();
                const nomeProduto = item.nome;
                const qtd = item.qtd || 1;
                const custoUnitario = parseFloat(mapaCustos[nomeProduto] || 0).toFixed(2).replace('.', ',');
                const precoVenda = parseFloat(item.preco).toFixed(2).replace('.', ',');
                const metodo = v.metodo;
                const subtotalItem = (parseFloat(item.preco) * qtd).toFixed(2).replace('.', ',');
                csv += `${dataFormatada};${nomeProduto};${qtd};${custoUnitario};${precoVenda};${metodo};${subtotalItem}\n`;
            }
        });
    });
    baixarArquivo(csv, 'relatorio_vendas.csv');
}