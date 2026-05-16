window.sair = function() { sessionStorage.clear(); window.location.href = 'login.html'; }

window.openTab = function(tabId) {
    const nivel = sessionStorage.getItem('nivelUsuario');
    
    // 🔥 BLOQUEIO DE SEGURANÇA: Nem dashboard nem histórico abrem se for operador
    if ((tabId === 'dashboard' || tabId === 'historico-vendas') && nivel !== 'admin' && nivel !== 'gerente') {
        alert("Acesso Negado: Somente pessoas autorizadas podem acessar esta tela.");
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

    // 🔥 DE OLHO NA NOVA ABA: Se abrir o histórico, puxa os dados do Firebase
    if(tabId === 'historico-vendas') {
        if(window.carregarHistoricoVendas) window.carregarHistoricoVendas();
    }
}

const nome = sessionStorage.getItem('nomeUsuario') || 'Usuário';
const nivel = sessionStorage.getItem('nivelUsuario');
document.getElementById('info-usuario').innerText = nome;

if (nivel !== 'admin' && nivel !== 'gerente') {
    document.getElementById('btn-nav-dash').style.opacity = '0.5';
    // 🔥 Deixa o botão do histórico opaco também para o operador
    const btnHist = document.getElementById('btn-nav-vendas-hist');
    if (btnHist) btnHist.style.opacity = '0.5';
}

// Garante que a verificação de dinheiro só rode se a função existir no escopo global
if(window.verificarDinheiro) window.verificarDinheiro();

// Esconde o botões do Operador
window.addEventListener('load', () => {
    const nivel = sessionStorage.getItem('nivelUsuario');

    // Esconder dashboard e Histórico se for operador
    if (nivel === 'operador') {
        const btnDash = document.getElementById('btn-nav-dash');
        if (btnDash) btnDash.style.display = 'none';

        // 🔥 Esconde o botão do histórico para o operador
        const btnHist = document.getElementById('btn-nav-vendas-hist');
        if (btnHist) btnHist.style.display = 'none';

        // Esconder configurações
        document.querySelectorAll('button').forEach(btn => {
            if (btn.innerText.includes('⚙️')) {
                btn.style.display = 'none';
            }
        });
    }
});