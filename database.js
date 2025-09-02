// database.js
const { Sequelize, DataTypes } = require("sequelize");
const bcrypt = require("bcrypt");

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  protocol: "postgres",
  logging: (msg) => console.log("[Sequelize]", msg),
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
  },
});

// === MODELS ===
const User = sequelize.define("User", {
  id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
});

const Avaliado = sequelize.define("Avaliado", {
  id:   { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nome: { type: DataTypes.STRING, allowNull: false, unique: true },
});

const NotasAvaliadores = sequelize.define("NotasAvaliadores", {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  avaliador: { type: DataTypes.STRING, allowNull: false },
  avaliado:  { type: DataTypes.STRING, allowNull: false }, // nome textual do avaliado
  nota:      { type: DataTypes.FLOAT,  allowNull: false },
});

const MediaEntrevista = sequelize.define("MediaEntrevista", {
  nota: { type: DataTypes.FLOAT, defaultValue: 0 }
});

const CartaIntencao = sequelize.define("CartaIntencao", {
  nota: { type: DataTypes.FLOAT, defaultValue: 0 }
});

const MediaHistorico = sequelize.define("MediaHistorico", {
  nota: { type: DataTypes.FLOAT, defaultValue: 0 }
});

const MediaFinal = sequelize.define("MediaFinal", {
  nota: { type: DataTypes.FLOAT, defaultValue: 0 }
});

// === RELACIONAMENTOS ===
Avaliado.hasMany(NotasAvaliadores, { onDelete: "CASCADE" });
NotasAvaliadores.belongsTo(Avaliado);

Avaliado.hasOne(MediaEntrevista, { onDelete: "CASCADE" });
MediaEntrevista.belongsTo(Avaliado);

Avaliado.hasOne(CartaIntencao, { onDelete: "CASCADE" });
CartaIntencao.belongsTo(Avaliado);

Avaliado.hasOne(MediaHistorico, { onDelete: "CASCADE" });
MediaHistorico.belongsTo(Avaliado);

Avaliado.hasOne(MediaFinal, { onDelete: "CASCADE" });
MediaFinal.belongsTo(Avaliado);

// === SYNC DATABASE ===
async function syncDatabase() {
  try {
    await sequelize.authenticate();
    console.log("✅ Conexão com o banco estabelecida!");
    await sequelize.sync({ alter: true });
    console.log("✅ Tabelas sincronizadas com sucesso!");

    // cria usuário admin default se não existir
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin510";

    const adminExists = await User.findOne({ where: { username: adminUsername } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({ username: adminUsername, password: hashedPassword });
      console.log(`✅ Usuário admin '${adminUsername}' criado.`);
    }
  } catch (error) {
    console.error("❌ Erro ao conectar/sincronizar banco:", error);
  }
}

syncDatabase();

module.exports = {
  sequelize,
  User,
  Avaliado,
  NotasAvaliadores,
  MediaEntrevista,
  CartaIntencao,
  MediaHistorico,
  MediaFinal
};
