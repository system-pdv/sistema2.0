// 🔐 variável global segura
let nivelUsuarioAtual = null;

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        // 🔥 busca pelo email (compatível com seu banco atual)
        const snapshot = await db.collection("usuarios")
            .where("email", "==", user.email)
            .get();

        if (!snapshot.empty) {
            const dados = snapshot.docs[0].data();

            nivelUsuarioAtual = dados.nivel;

            // nome vindo do Firebase
            const nome = dados.nome || 'Usuário';
            document.getElementById('info-usuario').innerText = nome;

            // mantém comportamento visual
            if (nivelUsuarioAtual !== 'admin' && nivelUsuarioAtual !== 'gerente') {
                document.getElementById('btn-nav-dash').style.opacity = '0.5';
            }

        } else {
            alert("Usuário não encontrado no banco.");
        }

    } catch (erro) {
        console.error("Erro ao buscar usuário:", erro);
    }
});

window.sair = function() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

window.openTab = function(tabId) {

    const nivel = nivelUsuarioAtual;

    // evita erro antes de carregar
    if (!nivel) {
        alert("Carregando permissões, tente novamente...");
        return;
    }
    
    if (tabId === 'dashboard' && nivel !== 'admin' && nivel !== 'gerente') {
        alert("Acesso Negado: Somente pessoas autorizadas podem acessar o Dashboard.");
        return;
    }

    // Remove active
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    // Ativa aba
    document.getElementById(tabId).classList.add('active');

    // Marca botão clicado
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    if (tabId === 'config' && nivel === 'admin') {
        document.getElementById('painel-admin').style.display = 'block';
        if(window.carregarUsuariosAdmin) window.carregarUsuariosAdmin();
    }
    
    if(tabId === 'vendas') { 
        setTimeout(() => { document.getElementById('pdv-busca').focus(); }, 100); 
    }
    
    if(tabId === 'estoque') {
        if(window.carregarInventario) window.carregarInventario();
    }
    
    if(tabId === 'dashboard') {
        if(window.carregarDash) window.carregarDash();
    }
}

// função sair (mantida)
window.sair = function() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

// mantém sua verificação
if(window.verificarDinheiro) window.verificarDinheiro();