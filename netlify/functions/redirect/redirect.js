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

    // Incrementar o índice e garantir que sempre temos um documento válido
    const findResult = await counterCollection.findOneAndUpdate(
      { type: 'single' }, // Filtro para localizar o documento
      { $inc: { index: 1 } }, // Incrementar o campo "index"
      { upsert: true, returnDocument: 'after' } // Criar o documento se ele não existir
    );

    // Verificar se o índice foi retornado corretamente
    const currentIndex = findResult.value?.index;

    if (currentIndex === undefined) {
      throw new Error("Falha ao atualizar ou recuperar o índice.");
    }

    // DEBUG: Logs para verificar a lógica
    console.log("Resultado do findOneAndUpdate:", findResult);
    console.log("Índice atual:", currentIndex);

    // Configurar os números do WhatsApp
    const whatsappNumber1 = process.env.WHATSAPP_NUMBER_1;
    const whatsappNumber2 = process.env.WHATSAPP_NUMBER_2;

    if (!whatsappNumber1 || !whatsappNumber2) {
      throw new Error('Variáveis de ambiente dos números do WhatsApp não configuradas.');
    }

    // Alternar entre os dois números com base no índice
    const redirectTo = (currentIndex % 2 === 0)
      ? `https://wa.me/${whatsappNumber1}`
      : `https://wa.me/${whatsappNumber2}`;

    console.log("Redirecionando para:", redirectTo); // Log final para verificar o redirecionamento

    // Retornar redirecionamento
    return {
      statusCode: 302,
      headers: {
        Location: redirectTo,
      },
      body: null, // Corpo não é necessário para redirecionamento
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
