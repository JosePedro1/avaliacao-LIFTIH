// === Admin Login (senha fixa no front) ===
function verificarAdmin() {
  const senhaCorreta = "admin510"; // senha pedida
  const senhaDigitada = document.getElementById("senhaAdmin")?.value || "";
  if (senhaDigitada === senhaCorreta) {
    console.log("🔐 Admin autenticado no front. Redirecionando para admin.html");
    window.location.href = "admin.html";
  } else {
    alert("Senha incorreta. Tente novamente.");
  }
}

// Mostrar/ocultar box de senha
function abrirLoginAdmin() {
  const box = document.getElementById("admin-login-box");
  if (!box) return;
  const displayAtual = box.style.display;
  box.style.display = (displayAtual === "none" || displayAtual === "") ? "block" : "none";
  console.log("🔎 admin-login-box:", box.style.display);
}

// === Avaliador ===
function enviarAvaliacao() {
  const nomeAvaliador = document.getElementById("nomeAvaliador").value.trim();
  if (!nomeAvaliador) return alert("Por favor, insira o seu nome.");
  
  const linhas = document.querySelectorAll("#tabela-avaliados tr.avaliado-row");
  const avaliacoes = [];

  linhas.forEach(linha => {
    const nome = linha.querySelector("td:first-child").textContent;
    const notaInput = linha.querySelector("input");
    if (notaInput && notaInput.value) {
      avaliacoes.push({ nomeAvaliado: nome, nota: parseFloat(notaInput.value) });
    }
  });

  if (avaliacoes.length === 0) return alert("Você precisa preencher pelo menos uma nota.");

  console.log("📤 Enviando avaliações:", { nomeAvaliador, qtd: avaliacoes.length });

  fetch("/avaliar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nomeAvaliador, avaliacoes })
  })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      console.log("📥 Resposta /avaliar:", res.status, data);
      if (!res.ok) throw new Error(data.message || "Falha ao enviar");
      alert(data.message || "Avaliação enviada!");
      // limpa inputs
      linhas.forEach(linha => {
        const notaInput = linha.querySelector("input");
        if (notaInput) notaInput.value = "";
      });
    })
    .catch(err => {
      console.error("❌ Erro ao enviar avaliação:", err);
      alert("Erro ao enviar avaliação");
    });
}

// === Carregar dados (Admin e Avaliador) ===
document.addEventListener("DOMContentLoaded", () => {
  const pathname = window.location.pathname;
  if (pathname.includes("admin.html") || pathname.includes("avaliador.html")) {
    console.log("🔄 Carregando /dados-gerais ...");
    fetch("/dados-gerais")
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        console.log("📥 /dados-gerais:", res.status, data);
        if (!res.ok) throw new Error(data.message || "Erro ao buscar dados");
        if (pathname.includes("admin.html")) preencherAdmin(data);
        if (pathname.includes("avaliador.html")) preencherAvaliador(data);
      })
      .catch((e) => {
        console.error("❌ Erro ao carregar dados do servidor:", e);
        alert("Erro ao carregar dados do servidor.");
      });
  }
});

function preencherAdmin(data) {
  // Tabelas editáveis
  preencherTabelaEditavel(data.mediaEntrevista || [], "tabela-media-entrevista", "entrevista");
  preencherTabelaEditavel(data.cartaIntencao   || [], "tabela-carta-intencao", "carta");
  preencherTabelaEditavel(data.mediaHistorico  || [], "tabela-media-historico", "historico");

  // Tabelas de visualização
  preencherTabelaSimples(data.mediaFinal || [], "tabela-media-final", ["nome", "nota"]);
  preencherTabelaSimples(data.avaliacoes || [], "tabela-avaliacoes", ["avaliador", "avaliado", "nota"]);
  
  const lista = document.getElementById("lista-avaliados");
  if (lista) {
    lista.innerHTML = "";
    (data.avaliados || []).forEach(av => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${av.nome}</span>
        <div class="actions">
          <button class="edit-btn" onclick="editarAvaliado('${av.id}', '${av.nome.replace(/'/g,"&#39;")}')">Editar</button>
          <button class="remove-btn" onclick="removerAvaliado('${av.id}')">Remover</button>
        </div>
      `;
      lista.appendChild(li);
    });
  }
}

function preencherAvaliador(data) {
  const tabela = document.getElementById("tabela-avaliados");
  if (!tabela) return;
  tabela.innerHTML = "<tr><th>Nome do Candidato</th><th>Nota (0-10)</th></tr>";
  (data.avaliados || []).forEach(av => {
    const tr = document.createElement("tr");
    tr.className = 'avaliado-row';
    tr.innerHTML = `<td>${av.nome}</td><td><input type="number" min="0" max="10" step="0.01"></td>`;
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
      let valor = item[col];
      if (col === "nota" && typeof valor === "number") valor = valor.toFixed(2);
      cell.textContent = valor;
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
    cellNota.textContent = Number(item.nota || 0).toFixed(2);
    cellNota.className = "editable-note";
    cellNota.onclick = () => tornarEditavel(cellNota, item.id, tipoNota);
  });
}

// === Edição inline de notas ===
function tornarEditavel(cell, avaliadoId, tipo) {
  const valorAntigo = cell.textContent;
  cell.innerHTML = `<input type="number" step="0.01" value="${valorAntigo}" class="edit-input">`;
  const input = cell.querySelector('input');
  input.focus();
  input.onblur = () => salvarNota(cell, input, avaliadoId, tipo, valorAntigo);
  input.onkeydown = (event) => {
    if (event.key === 'Enter') input.blur();
    if (event.key === 'Escape') cell.textContent = valorAntigo;
  };
}

function salvarNota(cell, input, avaliadoId, tipo, valorAntigo) {
  const novoValor = parseFloat(input.value);
  if (isNaN(novoValor) || novoValor < 0 || novoValor > 10) {
    alert("Nota inválida. Insira um valor entre 0 e 10.");
    cell.textContent = valorAntigo;
    return;
  }

  cell.textContent = novoValor.toFixed(2);

  fetch('/admin/nota', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avaliadoId, tipo, nota: novoValor })
  })
  .then(async res => {
    const data = await res.json().catch(() => ({}));
    console.log("📥 Resposta /admin/nota:", res.status, data);
    if (!res.ok) throw new Error(data.message || "Falha ao salvar");
    // Atualiza média final
    return fetch('/dados-gerais');
  })
  .then(r => r.json())
  .then(d => preencherTabelaSimples(d.mediaFinal, "tabela-media-final", ["nome", "nota"]))
  .catch(err => {
    console.error("❌ Erro ao salvar nota:", err);
    alert('Erro ao salvar a nota. Revertendo.');
    cell.textContent = valorAntigo;
  });
}

// === CRUD Avaliados (Admin) ===
function adicionarAvaliado() {
  const input = document.getElementById("novoAvaliado");
  const nome = (input?.value || "").trim();
  if (!nome) return alert("Digite um nome.");

  console.log("📤 Criando avaliado:", nome);

  fetch("/admin/avaliados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome })
  })
  .then(async res => {
    const data = await res.json().catch(() => ({}));
    console.log("📥 Resposta /admin/avaliados (POST):", res.status, data);
    if (!res.ok) throw new Error(data.message || "Falha ao criar avaliado");
    input.value = "";
    // recarrega dados
    return fetch("/dados-gerais");
  })
  .then(r => r.json())
  .then(d => {
    preencherAdmin(d);
    alert("Avaliado adicionado com sucesso!");
  })
  .catch(err => {
    console.error("❌ Erro ao adicionar avaliado:", err);
    alert("Erro ao adicionar avaliado (nome pode já existir).");
  });
}

function removerAvaliado(id) {
  if (!confirm("Tem certeza que deseja remover este avaliado?")) return;

  console.log("🗑️  Removendo avaliado:", id);

  fetch(`/admin/avaliados/${id}`, { method: "DELETE" })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      console.log("📥 Resposta /admin/avaliados (DELETE):", res.status, data);
      if (!res.ok) throw new Error(data.message || "Falha ao remover");
      return fetch("/dados-gerais");
    })
    .then(r => r.json())
    .then(d => {
      preencherAdmin(d);
      alert("Avaliado removido.");
    })
    .catch(err => {
      console.error("❌ Erro ao remover avaliado:", err);
      alert("Erro ao remover avaliado.");
    });
}

function editarAvaliado(id, nomeAtual) {
  const novoNome = prompt("Digite o novo nome para o avaliado:", nomeAtual);
  if (!novoNome || novoNome.trim() === "" || novoNome === nomeAtual) return;

  console.log("✏️  Editando avaliado:", { id, nomeAtual, novoNome });

  fetch(`/admin/avaliados/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: novoNome.trim() })
  })
  .then(async res => {
    const data = await res.json().catch(() => ({}));
    console.log("📥 Resposta /admin/avaliados (PUT):", res.status, data);
    if (!res.ok) throw new Error(data.message || "Falha ao editar");
    return fetch("/dados-gerais");
  })
  .then(r => r.json())
  .then(d => {
    preencherAdmin(d);
    alert("Nome atualizado com sucesso.");
  })
  .catch(err => {
    console.error("❌ Erro ao editar o nome:", err);
    alert("Erro ao editar o nome.");
  });
}
