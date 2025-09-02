// === Admin Login ===
function verificarAdmin() { /* ...código inalterado... */ }

// === Avaliador ===
function enviarAvaliacao() {
  const nomeAvaliador = document.getElementById("nomeAvaliador").value.trim();
  if (!nomeAvaliador) return alert("Por favor, insira o seu nome.");
  
  const linhas = document.querySelectorAll("#tabela-avaliados tr.avaliado-row");
  let avaliacoes = [];

  linhas.forEach(linha => {
    const nome = linha.querySelector("td:first-child").textContent;
    const notaInput = linha.querySelector("input");
    if (notaInput && notaInput.value) {
      avaliacoes.push({ nomeAvaliado: nome, nota: parseFloat(notaInput.value) });
    }
  });

  if (avaliacoes.length === 0) return alert("Você precisa preencher pelo menos uma nota.");

  fetch("/avaliar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nomeAvaliador, avaliacoes })
  })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if (data.message.includes("sucesso")) {
            linhas.forEach(linha => {
                const notaInput = linha.querySelector("input");
                if(notaInput) notaInput.value = "";
            });
        }
    })
    .catch(() => alert("Erro ao enviar avaliação"));
}

// === Carregar dados (Admin e Avaliador) ===
document.addEventListener("DOMContentLoaded", () => {
  const pathname = window.location.pathname;
  if (pathname.includes("admin.html") || pathname.includes("avaliador.html")) {
    fetch("/dados-gerais")
      .then(res => res.json())
      .then(data => {
        if (pathname.includes("admin.html")) preencherAdmin(data);
        if (pathname.includes("avaliador.html")) preencherAvaliador(data);
      })
      .catch(() => alert("Erro ao carregar dados do servidor."));
  }
});

function preencherAdmin(data) {
  // Preenche tabelas editáveis
  preencherTabelaEditavel(data.mediaEntrevista, "tabela-media-entrevista", "entrevista");
  preencherTabelaEditavel(data.cartaIntencao, "tabela-carta-intencao", "carta");
  preencherTabelaEditavel(data.mediaHistorico, "tabela-media-historico", "historico");

  // Preenche tabelas de visualização
  preencherTabelaSimples(data.mediaFinal, "tabela-media-final", ["nome", "nota"]);
  preencherTabelaSimples(data.avaliacoes, "tabela-avaliacoes", ["avaliador", "avaliado", "nota"]);
  
  const lista = document.getElementById("lista-avaliados");
  lista.innerHTML = "";
  data.avaliados.forEach(av => {
    const li = document.createElement("li");
    li.innerHTML = `
        <span>${av.nome}</span>
        <div class="actions">
            <button class="edit-btn" onclick="editarAvaliado('${av.id}', '${av.nome}')">Editar</button>
            <button class="remove-btn" onclick="removerAvaliado('${av.id}')">Remover</button>
        </div>
    `;
    lista.appendChild(li);
  });
}

function preencherAvaliador(data) {
  const tabela = document.getElementById("tabela-avaliados");
  tabela.innerHTML = "<tr><th>Nome do Candidato</th><th>Nota (0-10)</th></tr>";
  data.avaliados.forEach(av => {
    const tr = document.createElement("tr");
    tr.className = 'avaliado-row';
    tr.innerHTML = `<td>${av.nome}</td><td><input type="number" min="0" max="10" step="0.01"></td>`; // <-- NOTA COM 2 CASAS DECIMAIS
    tabela.appendChild(tr);
  });
}

function preencherTabelaSimples(dados, tabelaId, colunas) {
  const tabela = document.getElementById(tabelaId);
  if (!tabela) return;
  tabela.innerHTML = "";
  dados.forEach(item => {
    const row = tabela.insertRow();
    colunas.forEach(col => {
      const cell = row.insertCell();
      cell.textContent = item[col];
    });
  });
}

function preencherTabelaEditavel(dados, tabelaId, tipoNota) {
    const tabela = document.getElementById(tabelaId);
    if (!tabela) return;
    tabela.innerHTML = "";
    dados.forEach(item => {
        const row = tabela.insertRow();
        row.insertCell().textContent = item.nome;
        const cellNota = row.insertCell();
        cellNota.textContent = item.nota;
        cellNota.className = "editable-note";
        cellNota.onclick = () => tornarEditavel(cellNota, item.id, tipoNota);
    });
}

// === LÓGICA DE EDIÇÃO NA TABELA ===
function tornarEditavel(cell, avaliadoId, tipo) {
    const valorAntigo = cell.textContent;
    cell.innerHTML = `<input type="number" step="0.01" value="${valorAntigo}" class="edit-input">`;
    const input = cell.querySelector('input');
    input.focus();
    
    // Salva ao sair do campo
    input.onblur = () => salvarNota(cell, input, avaliadoId, tipo, valorAntigo);
    // Salva ao pressionar Enter
    input.onkeydown = (event) => {
        if (event.key === 'Enter') input.blur();
        if (event.key === 'Escape') cell.textContent = valorAntigo; // Cancela
    };
}

function salvarNota(cell, input, avaliadoId, tipo, valorAntigo) {
    const novoValor = parseFloat(input.value);
    if (isNaN(novoValor) || novoValor < 0 || novoValor > 10) {
        alert("Nota inválida. Insira um valor entre 0 e 10.");
        cell.textContent = valorAntigo;
        return;
    }

    cell.textContent = novoValor.toFixed(2); // Atualiza UI imediatamente

    fetch('/admin/nota', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avaliadoId, tipo, nota: novoValor })
    })
    .then(res => {
        if (!res.ok) throw new Error('Falha ao salvar');
        // A média final será atualizada automaticamente no backend
        // Para atualizar na tela, podemos recarregar os dados da média final
        fetch('/dados-gerais').then(r=>r.json()).then(d=>preencherTabelaSimples(d.mediaFinal, "tabela-media-final", ["nome", "nota"]))
    })
    .catch(err => {
        alert('Erro ao salvar a nota. Revertendo.');
        cell.textContent = valorAntigo; // Reverte se falhar
    });
}


// === CRUD Avaliados (Admin) ===
function adicionarAvaliado() { /* ...código inalterado... */ }
function removerAvaliado(id) { /* ...código inalterado... */ }

function editarAvaliado(id, nomeAtual) {
    const novoNome = prompt("Digite o novo nome para o avaliado:", nomeAtual);
    if (novoNome && novoNome.trim() !== "" && novoNome !== nomeAtual) {
        fetch(`/admin/avaliados/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: novoNome.trim() })
        })
        .then(res => {
            if (!res.ok) throw new Error('Falha ao editar');
            location.reload();
        })
        .catch(() => alert("Erro ao editar o nome."));
    }
}