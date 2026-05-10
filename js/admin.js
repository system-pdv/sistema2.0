import { db } from './firebase.js';
import { collection, setDoc, getDocs, updateDoc, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

window.carregarUsuariosAdmin = async function() {
    const snap = await getDocs(collection(db, "usuarios"));
    const select = document.getElementById('admin-selecionar-usuario');
    select.innerHTML = '<option value="">Selecione um usuário...</option>';
    snap.forEach(d => {
        select.innerHTML += `<option value="${d.id}">${d.data().usuario}</option>`;
    });
}

window.preencherDadosAdmin = async function(id) {
    if(!id) return;
    const docSnap = await getDoc(doc(db, "usuarios", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('admin-novo-nome').value = data.usuario || "";
        document.getElementById('admin-nova-senha').value = data.senha || "";
        document.getElementById('admin-vencimento').value = data.vencimento || "";
        document.getElementById('admin-novo-nivel').value = data.nivel || "operador";
        document.getElementById('admin-novo-status').value = data.status || "ativo";
    }
}

window.salvarAlteracoesAdmin = async function() {
    const idAlvo = document.getElementById('admin-selecionar-usuario').value;
    if(!idAlvo) return alert("Selecione um usuário!");
    const novoNome = document.getElementById('admin-novo-nome').value.trim();
    const novaSenha = document.getElementById('admin-nova-senha').value;
    const novoVencimento = document.getElementById('admin-vencimento').value;
    const novoNivel = document.getElementById('admin-novo-nivel').value;
    const novoStatus = document.getElementById('admin-novo-status').value;

    if(!novoNome) return alert("O nome não pode estar vazio!");

    try {
        const novosDados = {
            usuario: novoNome,
            senha: novaSenha,
            vencimento: novoVencimento,
            nivel: novoNivel,
            status: novoStatus
        };
        if (novoNome !== idAlvo) {
            await setDoc(doc(db, "usuarios", novoNome), novosDados);
            await deleteDoc(doc(db, "usuarios", idAlvo));
        } else {
            await updateDoc(doc(db, "usuarios", idAlvo), novosDados);
        }
        alert("Dados da licença atualizados com sucesso!");
        carregarUsuariosAdmin();
    } catch (e) { alert("Erro ao atualizar: " + e.message); }
}
