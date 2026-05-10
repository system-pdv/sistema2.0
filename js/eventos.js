window.addEventListener('keydown', (e) => {
    if (document.getElementById('vendas').classList.contains('active')) {
        if (e.key === 'F1') { e.preventDefault(); document.getElementById('pdv-pagamento').value = 'Dinheiro'; if(window.verificarDinheiro) verificarDinheiro(); }
        if (e.key === 'F2') { e.preventDefault(); document.getElementById('pdv-pagamento').value = 'Pix'; if(window.verificarDinheiro) verificarDinheiro(); }
        if (e.key === 'F3') { e.preventDefault(); document.getElementById('pdv-pagamento').value = 'Débito'; if(window.verificarDinheiro) verificarDinheiro(); }
        if (e.key === 'F4') { e.preventDefault(); document.getElementById('pdv-pagamento').value = 'Crédito'; if(window.verificarDinheiro) verificarDinheiro(); }
        if (e.key === 'F5') { e.preventDefault(); if(window.finalizarVenda) finalizarVenda(); }
    }
});