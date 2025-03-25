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
    console.log("Iniciando função de redirecionamento...");
    console.log("Conectando ao banco de dados...");
    await client.connect();
    console.log("Conexão com o banco de dados estabelecida!");

    const db = client.db('leads');
    const counterCollection = db.collection('vendor_counter');
    console.log("Acessando a collection 'vendor_counter'...");

    const findResult = await counterCollection.findOneAndUpdate(
      { type: 'single' }, // Filtro
      { $inc: { index: 1 } }, // Incremento
      { upsert: true, returnDocument: 'after' } // Opções
    );

    if (!findResult.value) {
      console.error("Erro: Nenhum documento encontrado ou criado na coleção.");
      throw new Error("Documento ausente na coleção.");
    }

    const currentIndex = findResult.value.index;
    console.log("Índice atual:", currentIndex);

    const whatsappNumber1 = process.env.WHATSAPP_NUMBER_1;
    const whatsappNumber2 = process.env.WHATSAPP_NUMBER_2;

    if (!whatsappNumber1 || !whatsappNumber2) {
      console.error("Erro: Variáveis de ambiente dos números do WhatsApp não configuradas.");
      throw new Error('Variáveis de ambiente dos números do WhatsApp não configuradas.');
    }

    const redirectTo = (currentIndex % 2 === 0)
      ? `https://wa.me/${whatsappNumber1}`
      : `https://wa.me/${whatsappNumber2}`;

    console.log("Redirecionando para:", redirectTo);

    return {
      statusCode: 302,
      headers: {
        Location: redirectTo,
      },
      body: null,
    };
  } catch (error) {
    console.error("Erro na função:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Erro interno. Verifique os logs." }),
    };
  } finally {
    await client.close();
    console.log("Conexão com o MongoDB fechada.");
  }
};
