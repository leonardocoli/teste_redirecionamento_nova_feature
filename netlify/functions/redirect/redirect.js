require('dotenv').config();
const cors = require('cors');
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
  // Configurações padrão do CORS (permite todas as origens)
  const corsHandler = cors();

  // Simula um objeto 'req' e 'res' para o middleware cors
  const req = {
    headers: event.headers,
  };
  const res = {
    statusCode: 200, // Você pode ajustar o status code conforme necessário
    headers: {},
    end: (body) => {
      // Este é um placeholder para o envio da resposta
      console.log("Resposta CORS:", res.headers, body);
    },
    setHeader: (name, value) => {
      res.headers[name] = value;
    },
  };

  // Executa o middleware cors
  await new Promise((resolve, reject) => {
    corsHandler(req, res, (err) => {
      if (err) {
        console.error("Erro ao aplicar CORS:", err);
        reject(err);
      } else {
        resolve();
      }
    });
  });

  // Sua lógica de redirecionamento aqui
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
        ...res.headers, // Inclui os headers CORS definidos pelo middleware
      },
      body: '',
    };
  } catch (error) {
    console.error("Erro na função:", error);
    return {
      statusCode: 500,
      headers: res.headers, // Inclui os headers CORS mesmo em caso de erro
      body: JSON.stringify({ message: "Erro ao processar a requisição." }),
    };
  } finally {
    await client.close();
  }
};