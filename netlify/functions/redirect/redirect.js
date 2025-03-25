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
    console.log("Iniciando a função...");
    console.log("Conectando ao banco de dados...");
    await client.connect();
    console.log("Conexão estabelecida com sucesso.");

    const db = client.db('leads');
    const counterCollection = db.collection('vendor_counter');

    // Inicializar o índice se ele não existir (caso raro).
    //if (!findResult.value) {
    //  await counterCollection.updateOne(
    //    { type: 'single' },
    //    { $set: { index: 1 } },
    //    { upsert: true }
    //  );
    //}
    
    console.log("Atualizando índice na coleção 'vendor_counter'...");
    const findResult = await counterCollection.findOneAndUpdate(
      { type: 'single' }, // Filtro
      { $inc: { index: 1 } }, // Incremento
      { upsert: true, returnDocument: 'after' } // Opções
    );

    console.log("Resultado do findOneAndUpdate:", findResult);

    if (!findResult.value || typeof findResult.value.index !== 'number') {
      console.error("Erro: Documento inválido ou índice ausente.");
      throw new Error("Erro ao recuperar o índice atualizado.");
    }

    const currentIndex = findResult.value.index;
    console.log("Índice atual:", currentIndex);

    const whatsappNumber1 = process.env.WHATSAPP_NUMBER_1;
    const whatsappNumber2 = process.env.WHATSAPP_NUMBER_2;

    if (!whatsappNumber1 || !whatsappNumber2) {
      console.error("Erro: Variáveis de ambiente dos números do WhatsApp não configuradas.");
      throw new Error('Números de WhatsApp não configurados nas variáveis de ambiente.');
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
    console.error("Erro capturado:", error.message);
    console.error("Detalhes do erro:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Erro interno. Verifique os logs para mais detalhes.",
        error: error.message, // Incluindo mensagem de erro para debug
      }),
    };
  } finally {
    console.log("Fechando conexão com o banco de dados...");
    await client.close();
    console.log("Conexão encerrada.");
  }
};
