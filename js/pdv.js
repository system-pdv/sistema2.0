import { db } from './firebase.js';
import { collection, addDoc, getDocs, updateDoc, doc, query, where, increment } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

let carrinho = [];

// 🔥 CACHE
let cacheProdutos = [];
let ultimaAtualizacao = 0;
const TEMPO_CACHE = 5 * 60 * 1000; // 5 minutos

// 🔥 CARREGAR PRODUTOS
async function carregarProdutos(force = false) {
    const agora = Date.now();

    if (!force && cacheProdutos.length && (agora - ultimaAtualizacao < TEMPO_CACHE)) {
        return;
    }

    const snap = await getDocs(collection(db, "produtos"));
    cacheProdutos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    ultimaAtualizacao = agora;
}

// 🔥 CARREGA AO INICIAR
carregarProdutos();

// ❌ REMOVIDO: setInterval que causava consumo de leitura

document.getElementById('pdv-busca').addEventListener('keypress', async (e) => {
    if(e.key === 'Enter') {
        const cod = e.target.value.trim();
        if(!cod) return;

        const index = carrinho.findIndex(item => item.codigo === cod);

        if (index !== -1) {
            carrinho[index].qtd_carrinho += 1;
            atualizarPdv();
        } else {

            // 🔥 GARANTE CACHE
            await carregarProdutos();

            let p = cacheProdutos.find(p => p.codigo === cod);

            // 🔥 FALLBACK (se não achou no cache)
            if (!p) {
                const q = query(collection(db, "produtos"), where("codigo", "==", cod));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    p = { id: snap.docs[0].id, ...snap.docs[0].data() };

                    // adiciona no cache
                    cacheProdutos.push(p);
                }
            }

            if(p) {
                carrinho.push({ ...p, qtd_carrinho: 1, id_carrinho: Date.now() + Math.random() });
                atualizarPdv();
            } else {
                alert("Produto não encontrado");
            }
        }

        e.target.value = '';
    }
});

window.alterarQtdManual = function(idCarrinho, novaQtd) {
    const qtd = parseInt(novaQtd);
    if (qtd <= 0 || isNaN(qtd)) {
        removerItemPdv(idCarrinho);
    } else {
        const index = carrinho.findIndex(i => i.id_carrinho === idCarrinho);
        if (index !== -1) {
            carrinho[index].qtd_carrinho = qtd;
            atualizarPdv();
        }
    }
}

window.atualizarPdv = function() {
    let t = 0;
    document.getElementById('pdv-lista').innerHTML = carrinho.map(i => {
        const preco = parseFloat(i.preco_venda) || 0;
        const subtotal = preco * i.qtd_carrinho;
        t += subtotal;
        return `<tr>
            <td>${i.nome}</td>
            <td><input type="number" value="${i.qtd_carrinho}" style="width:50px; padding:2px;" onchange="alterarQtdManual(${i.id_carrinho}, this.value)"></td>
            <td>R$ ${preco.toFixed(2).replace('.',',')}</td>
            <td>R$ ${subtotal.toFixed(2).replace('.',',')}</td>
            <td><button class="btn btn-danger btn-sm" onclick="removerItemPdv(${i.id_carrinho})">🗑️</button></td>
        </tr>`
    }).join('');
    document.getElementById('pdv-total').innerText = t.toFixed(2).replace('.', ',');
}

window.removerItemPdv = function(idCarrinho) {
    carrinho = carrinho.filter(i => i.id_carrinho !== idCarrinho);
    atualizarPdv();
}

window.limparPdv = function() {
    carrinho = [];
    atualizarPdv();
    document.getElementById('pdv-recebido').value = '';
    document.getElementById('pdv-troco').innerText = '0,00';
}

window.imprimirCupom = function(dadosVenda) {
    const divCupom = document.getElementById('cupom-impressao');
    let itensTxt = '';
    
    dadosVenda.itens.forEach(i => {
        const nome = i.nome.substring(0, 15).padEnd(15);
        const qtd = i.qtd.toString().padStart(3);
        const preco = parseFloat(i.preco).toFixed(2).padStart(8);
        itensTxt += `${nome} ${qtd}x ${preco}\n`;
    });

    let rodapeFinanceiro = '';
    if(dadosVenda.metodo === 'Dinheiro') {
        rodapeFinanceiro = `RECEBIDO: ${dadosVenda.recebido.toFixed(2).padStart(22)}\n` +
                           `TROCO:      ${dadosVenda.troco.toFixed(2).padStart(22)}\n`;
    }

    divCupom.innerHTML =
        `--------------------------------\n` +
        `          MINI MERCADO           \n` +
        `--------------------------------\n` +
        `Data: ${new Date().toLocaleString()}\n` +
        `--------------------------------\n` +
        `ITEM            QTD   PRECO (R$)\n` +
        `--------------------------------\n` +
        `${itensTxt}` +
        `--------------------------------\n` +
        `TOTAL:    ${dadosVenda.total.toFixed(2).padStart(22)}\n` +
        `METODO:   ${dadosVenda.metodo.padStart(22)}\n` +
        `${rodapeFinanceiro}` +
        `--------------------------------\n` +
        `      OBRIGADO E VOLTE SEMPRE    \n` +
        `--------------------------------\n\n\n`;
    
    window.print();
    divCupom.innerHTML = '';
}

window.finalizarVenda = async function() {
    if(!carrinho.length) return;
    const total = parseFloat(document.getElementById('pdv-total').innerText.replace(',', '.'));
    const metodo = document.getElementById('pdv-pagamento').value;
    const recebido = parseFloat(document.getElementById('pdv-recebido').value) || total;
    const troco = recebido - total;

    const dadosVenda = {
        itens: carrinho.map(i => ({id: i.id, nome: i.nome, preco: i.preco_venda, qtd: i.qtd_carrinho})),
        total: total,
        metodo: metodo,
        recebido: recebido,
        troco: troco,
        data: new Date(),
        status: "concluida"
    };

    try {
        await addDoc(collection(db, "vendas"), dadosVenda);

        for(const item of carrinho) {
            await updateDoc(doc(db, "produtos", item.id), { estoque: increment(-item.qtd_carrinho) });
        }

        // 🔥 ATUALIZA CACHE APÓS VENDA
        await carregarProdutos(true);

        imprimirCupom(dadosVenda);
        limparPdv();
    } catch (e) { alert("Erro: " + e.message); }
}

window.verificarDinheiro = function() {
    const secao = document.getElementById('secao-troco');
    secao.style.display = document.getElementById('pdv-pagamento').value === 'Dinheiro' ? 'block' : 'none';
}

window.calcularTroco = function() {
    const total = parseFloat(document.getElementById('pdv-total').innerText.replace(',', '.'));
    const recebido = parseFloat(document.getElementById('pdv-recebido').value) || 0;
    const troco = recebido - total;
    document.getElementById('pdv-troco').innerText = troco > 0 ? troco.toFixed(2).replace('.',',') : "0,00";
}