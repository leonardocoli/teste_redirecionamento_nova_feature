const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI; // Sua string de conexão estará aqui

const client = new MongoClient(uri);

exports.handler = async (event, context) => {
  try {
    await client.connect();
    const db = client.db('leads'); // Nome do seu banco de dados
    const counterCollection = db.collection('vendor_counter'); // Nome da sua coleção

    // Buscar o contador atual
    const counterDoc = await counterCollection.findOneAndUpdate(
      { type: 'single' },
      { $inc: { index: 1 } },
      { upsert: true, returnDocument: 'after' }
    );

    const whatsappNumbers = [
      "554896063646", // Vendedor 1
      "554899517399"   // Vendedor 2
    ];

    const nextIndex = (counterDoc.value.index - 1) % whatsappNumbers.length; // Subtrai 1 porque o índice foi incrementado antes de pegar o valor
    const whatsappNumber = whatsappNumbers[nextIndex];
    const message = "Opa! Vim pela Bio do instagram, gostaria de saber mais como vocês podem me ajudar!";
    const encodedMessage = encodeURIComponent(message);
    const whatsappURL = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    return {
      statusCode: 302,
      headers: {
        Location: whatsappURL,
      },
      body: '',
    };
  } catch (error) {
    console.error("Erro ao conectar ou interagir com o MongoDB:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao processar a requisição com MongoDB.' }),
    };
  } finally {
    await client.close();
  }
};
