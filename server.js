const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
require("dotenv").config();

const {
  User, Avaliado, NotasAvaliadores, MediaEntrevista,
  CartaIntencao, MediaHistorico, MediaFinal, sequelize
} = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// === FUNÇÕES AUXILIARES DE CÁLCULO ===
async function calcularMediaFinal(avaliadoId) {
    const mediaEntrevista = await MediaEntrevista.findOne({ where: { AvaliadoId: avaliadoId } });
    const cartaIntencao = await CartaIntencao.findOne({ where: { AvaliadoId: avaliadoId } });
    const mediaHistorico = await MediaHistorico.findOne({ where: { AvaliadoId: avaliadoId } });

    const notas = [
        mediaEntrevista?.nota || 0,
        cartaIntencao?.nota || 0,
        mediaHistorico?.nota || 0
    ];
    
    const media = notas.reduce((acc, nota) => acc + nota, 0) / notas.length;
    
    await MediaFinal.update({ nota: media.toFixed(2) }, { where: { AvaliadoId: avaliadoId } });
}

async function calcularMediaEntrevista(nomeAvaliado) {
    const avaliado = await Avaliado.findOne({ where: { nome: nomeAvaliado }});
    if (!avaliado) return;

    const todasNotas = await NotasAvaliadores.findAll({ where: { avaliado: nomeAvaliado } });
    if (todasNotas.length === 0) return;

    const media = todasNotas.reduce((acc, item) => acc + item.nota, 0) / todasNotas.length;
    
    await MediaEntrevista.update({ nota: media.toFixed(2) }, { where: { AvaliadoId: avaliado.id } });
    await calcularMediaFinal(avaliado.id); // Recalcula a média final
}

// === ROTAS ===

// LOGIN
app.post("/admin-login", async (req, res) => { /* ...código inalterado... */ });

// ENVIAR AVALIAÇÃO
app.post("/avaliar", async (req, res) => {
  const { nomeAvaliador, avaliacoes } = req.body;
  if (!nomeAvaliador || !avaliacoes || !avaliacoes.length)
    return res.status(400).json({ message: "Dados inválidos" });
  
  const t = await sequelize.transaction();
  try {
    await NotasAvaliadores.bulkCreate(
      avaliacoes.map(a => ({ avaliador: nomeAvaliador, avaliado: a.nomeAvaliado, nota: a.nota })),
      { transaction: t }
    );
    await t.commit();
    
    // Calcula a média para cada avaliado afetado
    const nomesAfetados = [...new Set(avaliacoes.map(a => a.nomeAvaliado))];
    for (const nome of nomesAfetados) {
        await calcularMediaEntrevista(nome);
    }

    res.status(200).json({ message: "Avaliação enviada com sucesso!" });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ message: "Erro ao salvar avaliação" });
  }
});

// DADOS GERAIS
app.get("/dados-gerais", async (req, res) => {
    try {
        const avaliados = await Avaliado.findAll({ order: [['nome', 'ASC']] });
        const avaliacoes = await NotasAvaliadores.findAll({ order: [['avaliado', 'ASC']] });
        
        const [mediaEntrevista, cartaIntencao, mediaHistorico, mediaFinal] = await Promise.all([
            MediaEntrevista.findAll({ include: Avaliado, order: [[Avaliado, 'nome', 'ASC']] }),
            CartaIntencao.findAll({ include: Avaliado, order: [[Avaliado, 'nome', 'ASC']] }),
            MediaHistorico.findAll({ include: Avaliado, order: [[Avaliado, 'nome', 'ASC']] }),
            MediaFinal.findAll({ include: Avaliado, order: [[Avaliado, 'nome', 'ASC']] })
        ]);

        const formatData = (data) => data.map(item => ({ nome: item.Avaliado.nome, nota: item.nota, id: item.Avaliado.id }));

        res.status(200).json({
            avaliados,
            avaliacoes,
            mediaEntrevista: formatData(mediaEntrevista),
            cartaIntencao: formatData(cartaIntencao),
            mediaHistorico: formatData(mediaHistorico),
            mediaFinal: formatData(mediaFinal)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao buscar dados" });
    }
});

// CRUD AVALIADOS
app.post("/admin/avaliados", async (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ message: "O nome é obrigatório." });
  const t = await sequelize.transaction();
  try {
    const novoAvaliado = await Avaliado.create({ nome }, { transaction: t });
    await MediaEntrevista.create({ AvaliadoId: novoAvaliado.id }, { transaction: t });
    await CartaIntencao.create({ AvaliadoId: novoAvaliado.id }, { transaction: t });
    await MediaHistorico.create({ AvaliadoId: novoAvaliado.id }, { transaction: t });
    await MediaFinal.create({ AvaliadoId: novoAvaliado.id }, { transaction: t });
    await t.commit();
    res.status(201).json(novoAvaliado);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ message: "Erro: O nome já pode existir." });
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

        // Atualiza o nome em outras tabelas se necessário
        await NotasAvaliadores.update({ avaliado: novoNome }, { where: { avaliado: nomeAntigo } });
        
        res.json({ message: "Nome atualizado com sucesso." });
    } catch (err) {
        res.status(500).json({ message: "Erro ao atualizar nome." });
    }
});

app.delete("/admin/avaliados/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await Avaliado.destroy({ where: { id } }); // OnDelete Cascade fará o resto
        res.json({ message: "Avaliado e todas as suas notas foram removidos." });
    } catch (err) {
        res.status(500).json({ message: "Erro ao remover avaliado." });
    }
});

// EDITAR NOTA
app.put("/admin/nota", async (req, res) => {
    const { avaliadoId, tipo, nota } = req.body;
    if (!avaliadoId || !tipo || nota === undefined) {
        return res.status(400).json({ message: "Dados incompletos." });
    }

    try {
        const modelos = {
            'entrevista': MediaEntrevista,
            'carta': CartaIntencao,
            'historico': MediaHistorico,
        };

        const Modelo = modelos[tipo];
        if (!Modelo) return res.status(400).json({ message: "Tipo de nota inválido." });

        await Modelo.update({ nota }, { where: { AvaliadoId: avaliadoId } });
        await calcularMediaFinal(avaliadoId); // Recalcula a média final após a edição

        res.json({ message: "Nota salva com sucesso." });
    } catch (err) {
        res.status(500).json({ message: "Erro ao salvar nota." });
    }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));