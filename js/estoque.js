import { db } from './firebase.js';
import { collection, setDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

let editandoId = null;

window.carregarInventario = async function() {
    const snap = await getDocs(collection(db, "produtos"));
    let html = '';
    let selectProd = '<option value="todos">Todos os Produtos</option>';
    snap.forEach(d => {
        const p = d.data();
        html += `<tr><td>${p.codigo}</td><td>${p.nome}</td><td>${p.categoria || '-'}</td><td>R$ ${parseFloat(p.preco_venda).toFixed(2).replace('.',',')}</td><td>${p.estoque}</td>
        <td>
            <button class='btn btn-warning btn-sm' onclick='editar("${d.id}", ${JSON.stringify(p)})'>✏️</button>
            <button class='btn btn-danger btn-sm' onclick='excluirProduto("${d.id}")'>🗑️</button>
        </td></tr>`;
        selectProd += `<option value="${p.nome}">${p.nome}</option>`;
    });
    document.querySelector('#tabela-inventario').innerHTML = html;
    document.getElementById('dash-filtro-produto').innerHTML = selectProd;
}

window.excluirProduto = async function(id) {
    if(confirm("Deseja excluir este produto?")) {
        await deleteDoc(doc(db, "produtos", id));
        carregarInventario();
    }
}

window.editar = function(id, p) {
    editandoId = id;
    document.getElementById('est-codigo').value = p.codigo;
    document.getElementById('est-nome').value = p.nome;
    document.getElementById('est-categoria').value = p.categoria || "";
    document.getElementById('est-custo').value = p.preco_custo || 0;
    document.getElementById('est-venda').value = p.preco_venda;
    document.getElementById('est-qtd').value = p.estoque;
    document.getElementById('titulo-form').innerText = "Editar Produto";
    document.getElementById('btn-cancelar').style.display = "inline";
}

window.cancelarEdicao = function() {
    editandoId = null;
    document.getElementById('titulo-form').innerText = "Novo Produto";
    document.querySelectorAll('#estoque input').forEach(i => i.value = "");
    document.getElementById('btn-cancelar').style.display = "none";
}

window.salvarEstoque = async function() {
    const cod = document.getElementById('est-codigo').value.trim();
    if(!cod) return alert("Código é obrigatório!");
    const p = {
        codigo: cod,
        nome: document.getElementById('est-nome').value,
        categoria: document.getElementById('est-categoria').value,
        preco_custo: parseFloat(document.getElementById('est-custo').value) || 0,
        preco_venda: parseFloat(document.getElementById('est-venda').value) || 0,
        estoque: parseInt(document.getElementById('est-qtd').value) || 0
    };
    try {
        await setDoc(doc(db, "produtos", cod), p);
        cancelarEdicao();
        carregarInventario();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
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

window.baixarCSVEstoque = async function() {
    const snap = await getDocs(collection(db, "produtos"));
    let csv = 'Codigo;Produto;Categoria;Preco Custo;Preco Venda;Estoque\n';
    snap.forEach(d => {
        const p = d.data();
        csv += `${p.codigo};${p.nome};${p.categoria || '-'};${p.preco_custo};${p.preco_venda};${p.estoque}\n`;
    });
    baixarArquivo(csv, 'inventario_estoque.csv');
}