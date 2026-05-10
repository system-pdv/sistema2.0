window.sair = function() { sessionStorage.clear(); window.location.href = 'login.html'; }

window.openTab = function(tabId) {
    const nivel = sessionStorage.getItem('nivelUsuario');
    
    if (tabId === 'dashboard' && nivel !== 'admin' && nivel !== 'gerente') {
        alert("Acesso Negado: Somente pessoas autorizadas podem acessar o Dashboard.");
        return;
    }

    // Remove a classe active de todas as abas e de todos os botões da nav
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    // Adiciona a classe active na aba correta
    document.getElementById(tabId).classList.add('active');

    // Adiciona a classe active no botão que foi clicado para ele ficar marcado
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

const nome = sessionStorage.getItem('nomeUsuario') || 'Usuário';
const nivel = sessionStorage.getItem('nivelUsuario');
document.getElementById('info-usuario').innerText = nome;

if (nivel !== 'admin' && nivel !== 'gerente') {
    document.getElementById('btn-nav-dash').style.opacity = '0.5';
}

// Garante que a verificação de dinheiro só rode se a função existir no escopo global
if(window.verificarDinheiro) window.verificarDinheiro();