// netlify/functions/get_vendor_leads/get_vendor_leads.js
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

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Agregação para contar leads por vendedor
    const vendorLeads = await redirectLogsCollection.aggregate([
      {
        $match: {
          timestamp: { $gte: twentyFourHoursAgo }
        }
      },
      {
        $group: {
          _id: "$vendorAssigned", // Agrupa pelo campo vendorAssigned
          count: { $sum: 1 }      // Conta o número de documentos em cada grupo
        }
      }
    ]).toArray();

    // Formata o resultado para facilitar a leitura
    const formattedResults = {};
    vendorLeads.forEach(item => {
      formattedResults[item._id] = item.count;
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Contagem de leads por vendedor nas últimas 24 horas:",
        leadsByVendor: formattedResults,
        periodStart: twentyFourHoursAgo.toISOString(),
        periodEnd: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error("Erro ao obter leads por vendedor:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Erro interno ao obter dados." }),
    };
  } finally {
    await client.close();
  }
};