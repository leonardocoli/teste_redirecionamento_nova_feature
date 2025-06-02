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
    const userAssignmentsCollection = db.collection('user_vendor_assignments'); // NOVA COLEÇÃO

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

    const mensagem = 'Opa%21+Vim+pela+Bio+do+instagram%2C+gostaria+de+saber+mais+como+voces+podem+me+ajudar.';

    // --- Coleta de Informações Adicionais (mantidas) ---
    const instagramSource = event.queryStringParameters.insta_source || 'N/A';
    const campaign = event.queryStringParameters.campanha || 'N/A';
    const userAgent = event.headers['user-agent'] || 'N/A';
    const ipAddress = event.headers['x-nf-client-ip'] || 'N/A'; // Usado como userId para "sticky"
    const referer = event.headers['referer'] || 'N/A';
    // --- Fim Coleta ---

    let redirectTo;
    let assignedVendor;
    let assignedWhatsappNumber = '';
    let isStickyAssignment = false; // Flag para log

    const currentTime = new Date();
    let userId = ipAddress; // Usando IP como identificador de usuário

    // --- Lógica de "Sticky Vendor" por 24 horas (FIXO a partir do PRIMEIRO clique) ---
    const existingAssignment = await userAssignmentsCollection.findOne({ userId: userId });

    if (existingAssignment) {
      // Calcula o tempo de expiração com base no timestamp ORIGINAL da atribuição
      const expiryTime = new Date(existingAssignment.assignmentTimestamp.getTime() + (10 * 60 * 1000)); // 10 min a partir do assignmentTimestamp teste da lógica
      //const expiryTime = new Date(existingAssignment.assignmentTimestamp.getTime() + (24 * 60 * 60 * 1000)); // 24 horas a partir do assignmentTimestamp

      if (currentTime < expiryTime) { // Verifica se ainda está dentro da janela de 24h
        // Se encontrou e ainda está dentro da janela de 24 horas do PRIMEIRO clique
        console.log(`Atribuição sticky ativa para ${userId}: ${existingAssignment.assignedVendorKey}`);
        assignedVendor = existingAssignment.assignedVendorKey;
        isStickyAssignment = true;

        if (assignedVendor.includes('vendor1')) {
          assignedWhatsappNumber = whatsappNumber1;
        } else if (assignedVendor.includes('vendor2')) {
          assignedWhatsappNumber = whatsappNumber2;
        } else {
          assignedWhatsappNumber = whatsappNumber1; // Fallback caso a chave seja desconhecida
          console.warn(`Chave de vendedor desconhecida em atribuição sticky: ${assignedVendor}. Defaulting para vendor1.`);
        }
        redirectTo = `https://wa.me/${assignedWhatsappNumber}?text=${mensagem}`;

        // IMPORTANTE: NÃO ATUALIZAR 'assignmentTimestamp' aqui para manter as 24h a partir do PRIMEIRO clique
        // O TTL no MongoDB cuidará da exclusão após 24h do assignmentTimestamp inicial.

      } else {
        // Atribuição existente, mas já expirou (>24h desde o PRIMEIRO clique)
        console.log(`Atribuição sticky para ${userId} expirou. Gerando nova atribuição.`);
        // Continua para a lógica de atribuição normal abaixo
      }
    }

    if (!isStickyAssignment) { // Se não foi uma atribuição sticky (nova ou expirada)
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 for Sunday, ..., 6 for Saturday

      const isSaturday = dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;

      let activeWhatsappNumbers = [];
      if (!isSaturday) {
        activeWhatsappNumbers.push(whatsappNumber1);
      }
      if (!isSunday) {
        activeWhatsappNumbers.push(whatsappNumber2);
      }

      if (activeWhatsappNumbers.length === 0) {
        console.warn("Ambos os vendedores estão de folga, mas o lead será distribuído via round-robin padrão.");
        redirectTo = (currentIndex % 2 === 0)
          ? `https://wa.me/${whatsappNumber1}?text=${mensagem}`
          : `https://wa.me/${whatsappNumber2}?text=${mensagem}`;

        assignedVendor = (currentIndex % 2 === 0) ? 'vendor1_off_duty_assigned' : 'vendor2_off_duty_assigned';
        assignedWhatsappNumber = (currentIndex % 2 === 0) ? whatsappNumber1 : whatsappNumber2;

      } else if (activeWhatsappNumbers.length === 1) {
        redirectTo = `https://wa.me/${activeWhatsappNumbers[0]}?text=${mensagem}`;
        assignedVendor = (activeWhatsappNumbers[0] === whatsappNumber1) ? 'vendor1_on_duty' : 'vendor2_on_duty';
        assignedWhatsappNumber = activeWhatsappNumbers[0];

      } else { // activeWhatsappNumbers.length === 2
        redirectTo = (currentIndex % 2 === 0)
          ? `https://wa.me/${whatsappNumber1}?text=${mensagem}`
          : `https://wa.me/${whatsappNumber2}?text=${mensagem}`;
        assignedVendor = (currentIndex % 2 === 0) ? 'vendor1_on_duty' : 'vendor2_on_duty';
        assignedWhatsappNumber = (currentIndex % 2 === 0) ? whatsappNumber1 : whatsappNumber2;
      }

      // Salvar a NOVA atribuição (ou atualizar uma expirada) na coleção de sticky
      await userAssignmentsCollection.updateOne(
        { userId: userId },
        {
          $set: {
            assignedVendorKey: assignedVendor,
            assignmentTimestamp: currentTime // O timestamp é definido/atualizado APENAS quando uma NOVA atribuição ocorre
          }
        },
        { upsert: true } // Cria o documento se não existir
      );
    }
    // --- Fim Lógica de "Sticky Vendor" ---


    // Registra o redirecionamento detalhado (SEMPRE ACONTECE NO redirect_logs)
    await redirectLogsCollection.insertOne({
      timestamp: currentTime,
      vendorAssigned: assignedVendor,
      assignedWhatsappNumber: assignedWhatsappNumber,
      redirectedTo: redirectTo,
      instagramSource: instagramSource,
      campaign: campaign,
      userAgent: userAgent,
      ipAddress: ipAddress,
      referer: referer,
      isStickyAssignment: isStickyAssignment // Indica se foi uma atribuição sticky ou nova
    });
    console.log(`Redirecionamento logado: ${assignedVendor} para ${assignedWhatsappNumber}. Sticky: ${isStickyAssignment}`);

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