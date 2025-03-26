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
    const counterCollection = db.collection('vendor_counter');
    const findDocument = await counterCollection.findOne({ type: 'single' });
    console.log("Resultado do findOne:", findDocument);
    const findResult = await counterCollection.findOneAndUpdate(
      { type: 'single' },
      { $inc: { index: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    console.log("Resultado do findOneAndUpdate:", findResult);
    const currentIndex = findResult.value ? findResult.value.index : 1;

    const whatsappNumber1 = process.env.WHATSAPP_NUMBER_1;
    const whatsappNumber2 = process.env.WHATSAPP_NUMBER_2;

    if (!whatsappNumber1 || !whatsappNumber2) {
      throw new Error('Variáveis de ambiente dos números do WhatsApp não configuradas.');
    }
    
    console.log("Valor de currentIndex:", currentIndex);
    let redirectTo = (currentIndex % 2 === 0)
      ? `https://wa.me/${whatsappNumber1}`
      : `https://wa.me/${whatsappNumber2}`;

    return {
      statusCode: 302,
      headers: {
        Location: redirectTo,
      },
      body: null, // Não é necessário corpo para redirecionamento.
    };
  } catch (error) {
    console.error("Erro na função:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Erro interno. Verifique os logs." }),
    };
  } finally {
    await client.close();
  }
};