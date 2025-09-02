// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const {
  User, Avaliado, NotasAvaliadores, MediaEntrevista,
  CartaIntencao, MediaHistorico, MediaFinal, sequelize
} = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

// ====== LOG SIMPLES DE REQUISIÇÕES ======
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`➡️  [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  if (["POST","PUT","PATCH","DELETE"].includes(req.method)) {
    console.log("   └─ Body:", JSON.stringify(req.body));
  }
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`✅  [${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.use(cors());
app.use(express.json());

// Static (front-end)
app.use(express.static(path.join(__dirname, "public")));

// === FUNÇÕES AUXILIARES DE CÁLCULO ===
async function calcularMediaFinal(avaliadoId) {
  const mediaEntrevista = await MediaEntrevista.findOne({ where: { AvaliadoId: avaliadoId } });
  const cartaIntencao   = await CartaIntencao.findOne({ where: { AvaliadoId: avaliadoId } });
  const mediaHistorico  = await MediaHistorico.findOne({ where: { AvaliadoId: avaliadoId } });

  const notas = [
    mediaEntrevista?.nota ?? 0,
    cartaIntencao?.nota ?? 0,
    mediaHistorico?.nota ?? 0
  ];

  const media = notas.reduce((acc, n) => acc + (Number(n) || 0), 0) / notas.length;
  const valor = Number(media.toFixed(2));

  console.log(`ℹ️  Recalculando média final do AvaliadoId=${avaliadoId}:`, { notas, media: valor });

  await MediaFinal.update({ nota: valor }, { where: { AvaliadoId: avaliadoId } });
}

async function calcularMediaEntrevista(nomeAvaliado) {
  const avaliado = await Avaliado.findOne({ where: { nome: nomeAvaliado }});
  if (!avaliado) {
    console.warn(`⚠️  calcularMediaEntrevista: Avaliado '${nomeAvaliado}' não encontrado`);
    return;
  }

  const todasNotas = await NotasAvaliadores.findAll({ where: { avaliado: nomeAvaliado } });
  if (todasNotas.length === 0) {
    console.log(`ℹ️  Sem notas para '${nomeAvaliado}' ainda.`);
    return;
  }

  const soma = todasNotas.reduce((acc, item) => acc + Number(item.nota || 0), 0);
  const media = Number((soma / todasNotas.length).toFixed(2));

  console.log(`ℹ️  Média entrevista '${nomeAvaliado}':`, { qtdNotas: todasNotas.length, media });

  await MediaEntrevista.update({ nota: media }, { where: { AvaliadoId: avaliado.id } });
  await calcularMediaFinal(avaliado.id);
}

// === ROTAS ===

// LOGIN (placeholder se for usar mais tarde)
app.post("/admin-login", async (req, res) => {
  console.log("🔐 /admin-login (não implementado — validação está no front com senha fixa)");
  res.status(200).json({ ok: true });
});

// ENVIAR AVALIAÇÃO
app.post("/avaliar", async (req, res) => {
  const { nomeAvaliador, avaliacoes } = req.body;
  if (!nomeAvaliador || !avaliacoes || !avaliacoes.length) {
    console.error("❌ /avaliar dados inválidos:", req.body);
    return res.status(400).json({ message: "Dados inválidos" });
  }
  
  const t = await sequelize.transaction();
  try {
    console.log("📝 Salvando avaliações:", { nomeAvaliador, itens: avaliacoes.length });
    await NotasAvaliadores.bulkCreate(
      avaliacoes.map(a => ({ avaliador: nomeAvaliador, avaliado: a.nomeAvaliado, nota: a.nota })),
      { transaction: t }
    );
    await t.commit();

    const nomesAfetados = [...new Set(avaliacoes.map(a => a.nomeAvaliado))];
    console.log("🔄 Recalculando médias de entrevista para:", nomesAfetados);
    for (const nome of nomesAfetados) {
      await calcularMediaEntrevista(nome);
    }

    res.status(200).json({ message: "Avaliação enviada com sucesso!" });
  } catch (err) {
    await t.rollback();
    console.error("❌ Erro ao salvar avaliação:", err);
    res.status(500).json({ message: "Erro ao salvar avaliação", detail: String(err) });
  }
});

// DADOS GERAIS
app.get("/dados-gerais", async (_req, res) => {
  try {
    const avaliados   = await Avaliado.findAll({ order: [['nome', 'ASC']] });
    const avaliacoes  = await NotasAvaliadores.findAll({ order: [['avaliado', 'ASC']] });
    
    const [mediaEntrevista, cartaIntencao, mediaHistorico, mediaFinal] = await Promise.all([
      MediaEntrevista.findAll({ include: Avaliado, order: [[Avaliado, 'nome', 'ASC']] }),
      CartaIntencao.findAll({ include: Avaliado, order: [[Avaliado, 'nome', 'ASC']] }),
      MediaHistorico.findAll({ include: Avaliado, order: [[Avaliado, 'nome', 'ASC']] }),
      MediaFinal.findAll({ include: Avaliado, order: [[Avaliado, 'nome', 'ASC']] })
    ]);

    const formatData = (data) => data.map(item => ({
      nome: item.Avaliado?.nome || "(sem nome)",
      nota: Number(item.nota || 0),
      id: item.Avaliado?.id
    }));

    console.log("📦 /dados-gerais →",
      { qtdAvaliados: avaliados.length, qtdAvaliacoes: avaliacoes.length });

    res.status(200).json({
      avaliados,
      avaliacoes,
      mediaEntrevista: formatData(mediaEntrevista),
      cartaIntencao:   formatData(cartaIntencao),
      mediaHistorico:  formatData(mediaHistorico),
      mediaFinal:      formatData(mediaFinal)
    });
  } catch (err) {
    console.error("❌ Erro em /dados-gerais:", err);
    res.status(500).json({ message: "Erro ao buscar dados", detail: String(err) });
  }
});

// CRUD AVALIADOS
app.post("/admin/avaliados", async (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ message: "O nome é obrigatório." });

  const t = await sequelize.transaction();
  try {
    console.log("➕ Criando Avaliado:", nome);
    const novoAvaliado = await Avaliado.create({ nome }, { transaction: t });

    await MediaEntrevista.create({ AvaliadoId: novoAvaliado.id }, { transaction: t });
    await CartaIntencao.create({ AvaliadoId: novoAvaliado.id }, { transaction: t });
    await MediaHistorico.create({ AvaliadoId: novoAvaliado.id }, { transaction: t });
    await MediaFinal.create({ AvaliadoId: novoAvaliado.id }, { transaction: t });

    await t.commit();
    console.log("✅ Avaliado criado com estruturas:", novoAvaliado.id);
    res.status(201).json(novoAvaliado);
  } catch (err) {
    await t.rollback();
    console.error("❌ Erro ao criar Avaliado:", err);
    res.status(500).json({ message: "Erro ao criar avaliado. O nome pode já existir.", detail: String(err) });
  }
});

app.put("/admin/avaliados/:id", async (req, res) => {
  const { id } = req.params;
  const { nome: novoNome } = req.body;

  try {
    const avaliado = await Avaliado.findByPk(id);
    if (!avaliado) return res.status(404).json({ message: "Avaliado não encontrado." });
    
    const nomeAntigo = avaliado.nome;
    avaliado.nome = novoNome;
    await avaliado.save();

    await NotasAvaliadores.update({ avaliado: novoNome }, { where: { avaliado: nomeAntigo } });
    
    console.log(`✏️  Renomeado: '${nomeAntigo}' → '${novoNome}' (id=${id})`);
    res.json({ message: "Nome atualizado com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao atualizar nome:", err);
    res.status(500).json({ message: "Erro ao atualizar nome.", detail: String(err) });
  }
});

app.delete("/admin/avaliados/:id", async (req, res) => {
  const { id } = req.params;
  try {
    console.log("🗑️  Removendo Avaliado:", id);
    await Avaliado.destroy({ where: { id } }); // OnDelete Cascade
    res.json({ message: "Avaliado e todas as suas notas foram removidos." });
  } catch (err) {
    console.error("❌ Erro ao remover avaliado:", err);
    res.status(500).json({ message: "Erro ao remover avaliado.", detail: String(err) });
  }
});

// EDITAR NOTA
app.put("/admin/nota", async (req, res) => {
  const { avaliadoId, tipo, nota } = req.body;
  if (!avaliadoId || !tipo || nota === undefined) {
    console.warn("⚠️  /admin/nota dados incompletos:", req.body);
    return res.status(400).json({ message: "Dados incompletos." });
  }

  try {
    const modelos = {
      entrevista: MediaEntrevista,
      carta:      CartaIntencao,
      historico:  MediaHistorico,
    };

    const Modelo = modelos[tipo];
    if (!Modelo) return res.status(400).json({ message: "Tipo de nota inválido." });

    console.log(`🧮 Atualizando nota (${tipo}) AvaliadoId=${avaliadoId} para`, Number(nota));
    await Modelo.update({ nota: Number(nota) }, { where: { AvaliadoId: avaliadoId } });
    await calcularMediaFinal(avaliadoId);

    res.json({ message: "Nota salva com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao salvar nota:", err);
    res.status(500).json({ message: "Erro ao salvar nota.", detail: String(err) });
  }
});

// Saúde
app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
