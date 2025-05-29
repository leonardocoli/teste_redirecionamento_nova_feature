// netlify/functions/cleanup_logs/cleanup_logs.js
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

exports.handler = async (event, context) => {
  try {
    await client.connect();
    const db = client.db('leads');
    const redirectLogsCollection = db.collection('redirect_logs');

    // Define a data limite (ex: 30 dias atrás)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Deleta documentos mais antigos que a data limite
    const result = await redirectLogsCollection.deleteMany({
      timestamp: { $lt: thirtyDaysAgo } // $lt significa "less than" (anterior a)
    });

    console.log(`Documentos antigos deletados: ${result.deletedCount}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Limpeza de logs concluída. ${result.deletedCount} documentos deletados.`,
      }),
    };

  } catch (error) {
    console.error("Erro na limpeza de logs:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Erro interno na limpeza de logs." }),
    };
  } finally {
    await client.close();
  }
};