const faunadb = require('faunadb');
const q = faunadb.query;

exports.handler = async function(event, context) {
  // Configurar cliente FaunaDB
  const client = new faunadb.Client({
    secret: process.env.FAUNADB_SERVER_SECRET
  });

  const whatsappNumbers = [
    "554896063646", // Vendedor 1
    "554899517399"  // Vendedor 2
  ];

  try {
    // Buscar o contador atual
    const result = await client.query(
      q.Get(
        q.Match(q.Index('last_vendor_index'), 'single')
      )
    );

    // Obter o índice atual
    const currentIndex = result.data.index;

    // Calcular o próximo índice (alternar entre 0 e o número de vendedores)
    const nextIndex = (currentIndex + 1) % whatsappNumbers.length;

    // Atualizar o documento com o próximo índice
    await client.query(
      q.Update(
        result.ref,
        { data: { index: nextIndex } }
      )
    );

    const whatsappNumber = whatsappNumbers[currentIndex]; // Usar o índice ANTES da atualização para o redirecionamento atual
    const message = "Opa! Vim pela Bio do instagram, gostaria de saber mais como vocês podem me ajudar!";
    const encodedMessage = encodeURIComponent(message);
    const whatsappURL = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    return {
      statusCode: 302, // Redirecionamento temporário
      headers: {
        Location: whatsappURL,
      },
      body: '',
    };
  } catch (error) {
    // Se o índice não existir, cria um novo começando com o primeiro vendedor
    if (error.requestResult && error.requestResult.statusCode === 404) {
      try {
        await client.query(
          q.Create(
            q.Collection('vendor_counter'),
            { data: { type: 'single', index: 0 } }
          )
        );
        const whatsappNumber = whatsappNumbers[0];
        const message = "Opa! Vim pela Bio do instagram, gostaria de saber mais como vocês podem me ajudar!";
        const encodedMessage = encodeURIComponent(message);
        const whatsappURL = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
        return {
          statusCode: 302,
          headers: {
            Location: whatsappURL,
          },
          body: '',
        };
      } catch (createError) {
        console.error("Erro ao criar o contador:", createError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Erro ao processar a requisição.' }),
        };
      }
    } else {
      console.error("Erro ao buscar/atualizar o índice:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Erro ao processar a requisição.' }),
      };
    }
  }
};