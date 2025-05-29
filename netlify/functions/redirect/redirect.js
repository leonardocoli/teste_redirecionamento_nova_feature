// netlify/functions/redirect/redirect.js
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
    const redirectLogsCollection = db.collection('redirect_logs');

    const findResult = await counterCollection.findOneAndUpdate(
      { type: 'single' },
      { $inc: { index: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const currentIndex = findResult ? findResult.index : 1;

    let whatsappNumber1 = process.env.WHATSAPP_NUMBER_1;
    let whatsappNumber2 = process.env.WHATSAPP_NUMBER_2;

    if (!whatsappNumber1 || !whatsappNumber2) {
      throw new Error('Variáveis de ambiente dos números do WhatsApp não configuradas.');
    }

    const mensagem = 'Opa%21+Vim+pela+Bio+do+instagram%2C+gostaria+de+saber+mais+como+voces+pod%C3%AAm+me+ajudar.';

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

    let redirectTo;
    let assignedVendor; // Variável para registrar qual vendedor foi atribuído e seu status

    if (activeWhatsappNumbers.length === 0) {
      // CENÁRIO: Ambos os vendedores estão de folga (ex: regras futuras, ou se os números não estivessem configurados corretamente e essa validação não fosse um 'throw error').
      // De acordo com a sua solicitação, neste caso, mantemos a distribuição padrão intercalada.
      console.warn("Ambos os vendedores estão de folga, mas o lead será distribuído via round-robin padrão.");
      redirectTo = (currentIndex % 2 === 0)
        ? `https://wa.me/${whatsappNumber1}?text=${mensagem}`
        : `https://wa.me/${whatsappNumber2}?text=${mensagem}`;
      
      // Registra o status de 'folga' para o vendedor que recebeu o lead
      assignedVendor = (currentIndex % 2 === 0) ? 'vendor1_off_duty_assigned' : 'vendor2_off_duty_assigned';

    } else if (activeWhatsappNumbers.length === 1) {
      // CENÁRIO: Apenas um vendedor está ativo (o outro está de folga)
      redirectTo = `https://wa.me/${activeWhatsappNumbers[0]}?text=${mensagem}`;
      assignedVendor = (activeWhatsappNumbers[0] === whatsappNumber1) ? 'vendor1_on_duty' : 'vendor2_on_duty';
    } else { // activeWhatsappNumbers.length === 2
      // CENÁRIO: Ambos os vendedores estão ativos (dia de semana normal)
      // Usamos a lógica de round-robin padrão
      redirectTo = (currentIndex % 2 === 0)
        ? `https://wa.me/${whatsappNumber1}?text=${mensagem}`
        : `https://wa.me/${whatsappNumber2}?text=${mensagem}`;
      assignedVendor = (currentIndex % 2 === 0) ? 'vendor1_on_duty' : 'vendor2_on_duty';
    }

    // Registra o redirecionamento detalhado
    await redirectLogsCollection.insertOne({
      timestamp: new Date(),
      vendorAssigned: assignedVendor, // Novo status detalhado
      redirectedTo: redirectTo,
      // userAgent: event.headers['user-agent'],
      // ipAddress: event.headers['x-nf-client-ip']
    });
    console.log(`Redirecionamento logado: ${assignedVendor}`);

    console.log("Valor de currentIndex:", currentIndex);
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
  }
};