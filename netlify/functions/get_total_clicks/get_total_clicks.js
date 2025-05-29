// netlify/functions/get_total_clicks/get_total_clicks.js
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

    // Define o período de tempo (últimas 24 horas)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Consulta o número de documentos na coleção redirect_logs
    const totalClicks = await redirectLogsCollection.countDocuments({
      timestamp: { $gte: twentyFourHoursAgo }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Total de cliques (redirecionamentos) nas últimas 24 horas: ${totalClicks}`,
        totalClicks: totalClicks,
        periodStart: twentyFourHoursAgo.toISOString(),
        periodEnd: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error("Erro ao obter o total de cliques:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Erro interno ao obter dados." }),
    };
  } finally {
    await client.close();
  }
};