const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI; // Sua string de conexão estará aqui

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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

    // *** SEU CÓDIGO PARA INTERAGIR COM O BANCO DE DADOS VAI AQUI ***
    const db = client.db('leads'); // Nome do seu banco de dados
    const counterCollection = db.collection('vendor_counter'); // Nome da sua coleção

    // Exemplo: Buscar um documento e incrementá-lo
    const findResult = await counterCollection.findOneAndUpdate(
      { type: 'single' },
      { $inc: { index: 1 } },
      { upsert: true, returnDocument: 'after' }
    );

    const currentIndex = findResult.value ? findResult.value.index : 1;
    const redirectTo = `/redirect-to-${currentIndex % 2 === 0 ? 'whatsapp1' : 'whatsapp2'}`;

    return {
      statusCode: 302,
      headers: {
        Location: redirectTo,
      },
    };

  } catch (e) {
    console.error("Erro ao conectar ou interagir com o MongoDB:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Erro ao processar sua requisição." }),
    };
  } finally {
    await client.close();
  }
};

// (Remova a chamada da função run() que estava no sample code original,
// pois o Netlify chamará a função handler automaticamente)