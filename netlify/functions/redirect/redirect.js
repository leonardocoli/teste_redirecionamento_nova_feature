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
    const currentIndex = findResult ? findResult.index : 1;

    let whatsappNumber1 = process.env.WHATSAPP_NUMBER_1;
    let whatsappNumber2 = process.env.WHATSAPP_NUMBER_2;

    if (!whatsappNumber1 || !whatsappNumber2) {
      throw new Error('Variáveis de ambiente dos números do WhatsApp não configuradas.');
    }

    const mensagem = 'Opa%21+Vim+pela+Bio+do+instagram%2C+gostaria+de+saber+mais+como+voces+pod%C3%AAm+me+ajudar.';

    // --- Lógica para desabilitar vendedores por dia da semana ---
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday

    const isSaturday = dayOfWeek === 6; // Saturday
    const isSunday = dayOfWeek === 0;  // Sunday

    let activeWhatsappNumbers = [];
    if (!isSaturday) {
      activeWhatsappNumbers.push(whatsappNumber1);
    }
    if (!isSunday) {
      activeWhatsappNumbers.push(whatsappNumber2);
    }

    // Handle cases where only one number is active or neither is
    let redirectTo;
    if (activeWhatsappNumbers.length === 0) {
      // Fallback if both are disabled (e.g., choose a default or display a message)
      console.warn("Both WhatsApp numbers are disabled today. Consider a fallback.");
      // For now, let's just pick one or redirect to a general contact page
      // You might want to redirect to a "come back later" page or a general support number.
      redirectTo = `https://wa.me/${whatsappNumber1}?text=Desculpe%2C+no+momento+nao+temos+atendimento.+Por+favor%2C+volte+mais+tarde.`; // Example fallback
    } else if (activeWhatsappNumbers.length === 1) {
      redirectTo = `https://wa.me/${activeWhatsappNumbers[0]}?text=${mensagem}`;
    } else {
      // Both are active, use the round-robin logic
      redirectTo = (currentIndex % 2 === 0)
        ? `https://wa.me/${whatsappNumber1}?text=${mensagem}`
        : `https://wa.me/${whatsappNumber2}?text=${mensagem}`;
    }
    // --- Fim da lógica de desabilitar vendedores ---

    console.log("Valor de currentIndex:", currentIndex);
    console.log("Redirecionando para:", redirectTo);

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