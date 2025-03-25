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
    const findResult = await counterCollection.findOneAndUpdate(
      { type: 'single' },
      { $inc: { index: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const currentIndex = findResult.value ? findResult.value.index : 1;
    const whatsappNumber1 = process.env.WHATSAPP_NUMBER_1;
    const whatsappNumber2 = process.env.WHATSAPP_NUMBER_2;
    let redirectTo;
    if (currentIndex % 2 === 0) {
      redirectTo = `https://wa.me/${whatsappNumber1}`;
    } else {
      redirectTo = `https://wa.me/${whatsappNumber2}`;
    }
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