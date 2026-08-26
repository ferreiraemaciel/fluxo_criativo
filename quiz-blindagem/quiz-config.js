/* ================================================================
   Quiz Blindagem — definição do funil (editável)
   As "key" batem com as colunas da tabela quiz_leads no Supabase,
   e os textos das opções batem com o histórico do FP (para os
   gráficos do Tracker juntarem leads dos dois funis).
   ================================================================ */
window.QUIZ_CONFIG = {
  funnelSlug: 'blindagem',
  checkoutUrl: 'https://pay.hotmart.com/C106394543X?checkoutMode=10',
  preco: { de: 'R$ 697,00', por: 'R$ 397,00', parcelas: '12x R$ 41,06' },

  steps: [
    { type: 'single', key: 'area_atuacao',
      welcome: {
        heading: 'Bora descobrir o quanto o seu trabalho está protegido?',
        body: 'Responde como se estivesse me contando o seu dia a dia. Leva 2 minutinhos e no fim você recebe um diagnóstico feito pro seu caso.',
      },
      title: 'Pra começar, me conta: o que você faz?',
      options: [
        { img: 'assets/fotografo.png', label: 'Fotógrafo(a)' },
        { img: 'assets/videomaker.png', label: 'Videomaker' },
        { img: 'assets/hibrido.png', label: 'Faço os dois (híbrido)' },
      ] },

    { type: 'single', key: 'profissionalizacao',
      title: 'E isso já é o seu ganha-pão?',
      options: [
        { emoji: '🏆', label: 'Sim, vivo exclusivamente disso.' },
        { emoji: '💰', label: 'Sim, mas é uma renda extra.' },
        { emoji: '🚀', label: 'Ainda sou amador, mas quero me profissionalizar.' },
      ] },

    { type: 'single', key: 'tipo_negocio',
      title: 'Hoje, como você toca o seu trabalho?',
      options: [
        { emoji: '🧍', label: 'Autônomo' },
        { emoji: '💼', label: 'Empresário/MEI' },
        { emoji: '🌱', label: 'Ainda sou amador' },
      ] },

    { type: 'single', key: 'confianca_clientes',
      title: 'Como você e seu cliente assinam os contratos atualmente?',
      options: [
        { emoji: '🖨️', label: 'Imprimo todos os contratos e assinamos manuscrito.' },
        { emoji: '📲', label: 'Mando pelo WhatsApp e peço uma foto dele assinado.' },
        { emoji: '🏛️', label: 'Assino pelo gov.br.' },
        { emoji: '✍️', label: 'Uso uma plataforma de assinatura digital, mas não integrada ao meu processo de contratos.' },
      ] },

    { type: 'content',
      heading: 'Seu <b>sucesso</b> depende de…',
      img: 'assets/big-ideia.png',
      body: 'Ser artista é só uma parte. O que precisa vir em primeiro lugar é encarar a <b>arte como negócio</b>. Antes de ser artista, é preciso ser empreendedor.',
      cta: 'Continuar' },

    { type: 'multi', key: 'situacoes',
      title: 'Seja sincero: por quais dessas você já passou?',
      subtitle: 'Pode marcar mais de uma.',
      options: [
        { emoji: '😤', label: 'Postaram uma foto minha sem dar os créditos' },
        { emoji: '😱', label: 'Colocaram filtro e acabaram com a minha foto' },
        { emoji: '👎', label: 'Cliente não gostou das fotos que eu fiz' },
        { emoji: '💾', label: 'Cliente quer que eu entregue os arquivos brutos' },
        { emoji: '✏️', label: 'Cliente pediu várias alterações no meu contrato' },
        { emoji: '🪄', label: 'Cliente pediu muitos retoques e Photoshop excessivo' },
        { emoji: '🍽️', label: 'Ficou sem jantar/mesa em um evento' },
        { emoji: '💸', label: 'Cliente cancelou o contrato e pediu o dinheiro de volta' },
        { emoji: '📅', label: 'Anos depois o cliente pediu as fotos que eu não guardei mais' },
        { emoji: '🖊️', label: 'Não sabia se o cliente tinha assinado o contrato ou não' },
      ] },

    { type: 'single', key: 'custo_processo',
      title: 'E se algo desse errado, você imagina o tamanho do prejuízo?',
      options: [
        { emoji: '💵', label: 'No máximo uns R$ 500, dá para resolver fácil.' },
        { emoji: '💸', label: 'Algo entre R$ 2.000 e R$ 5.000, dependendo do caso.' },
        { emoji: '⚖️', label: 'Pode ultrapassar R$ 20.000, incluindo honorários e custas processuais.' },
        { emoji: '😌', label: 'Valor inestimável, nada paga dormir tranquilo.' },
        { emoji: '🤷', label: 'Não faço ideia, mas espero nunca descobrir.' },
      ] },

    { type: 'carousel',
      subtitle: 'De acordo com suas respostas anteriores, estamos elaborando as próximas perguntas.',
      heading: 'Não é exagero. É a realidade dos tribunais.',
      durationPerSlide: 3500,
      slides: ['assets/juris-01.jpg', 'assets/juris-02.jpg', 'assets/juris-03.jpg'] },

    { type: 'single', key: 'usa_contrato',
      title: 'Falando em proteção: você usa contrato nos seus trabalhos?',
      options: [
        { emoji: '😬', label: 'Nunca, acho que não preciso.' },
        { emoji: '🤝', label: 'Às vezes, quando o cliente pede…' },
        { emoji: '🧾', label: 'Sim, sempre' },
      ] },

    { type: 'single', key: 'tipo_contrato_atual',
      title: 'E o seu contrato hoje, como ele é?',
      options: [
        { emoji: '📄', label: 'Um textão em Word e nem sei se me protege.' },
        { emoji: '💬', label: 'Salvo as mensagens que troquei com o cliente pelo WhatsApp.' },
        { emoji: '😨', label: 'Na verdade, eu nem uso contrato…' },
        { emoji: '📂', label: 'Tenho contratos, mas é uma bagunça de arquivos, e-mails e PDF.' },
      ] },

    { type: 'single', key: 'foco_artistico',
      title: 'No corre do dia a dia, sobra tempo pra sua arte?',
      options: [
        { emoji: '😩', label: 'Parece que passo mais tempo resolvendo pepino do que fotografando/filmando.' },
        { emoji: '😣', label: 'Tento focar na arte, mas sempre surge um problema…' },
        { emoji: '🥵', label: 'Estou sempre lidando com burocracias e clientes problemáticos!' },
        { emoji: '🎨', label: 'Sim, meu contrato cuida dessa parte pra mim.' },
      ] },

    { type: 'multi', key: 'sentimentos',
      title: 'E por dentro, como você anda se sentindo?',
      subtitle: 'Pode marcar mais de uma.',
      options: [
        { emoji: '😨', label: 'Medo do meu negócio não dar certo.' },
        { emoji: '😟', label: 'Insegurança por não ter clientes.' },
        { emoji: '😤', label: 'Estresse por ter que estar sempre atrás do dinheiro.' },
        { emoji: '😰', label: 'Ansiedade por não ter tempo para me dedicar.' },
      ] },

    { type: 'single', key: 'protege_dinheiro',
      title: 'Se um cliente cancelar o serviço e pedir o dinheiro de volta, o que acontece?',
      options: [
        { emoji: '😖', label: 'Já passei por isso e perdi dinheiro, não tinha proteção nenhuma.' },
        { emoji: '😐', label: 'Depende do caso, já tive problema mas consegui resolver de algum jeito.' },
        { emoji: '🛡️', label: 'Tenho cláusulas claras de cancelamento, me sinto protegido.' },
      ] },

    { type: 'single', key: 'temas_dominados',
      title: 'Quando você precisa encontrar um contrato antigo de um cliente, o que acontece?',
      options: [
        { emoji: '🔍', label: 'Fico procurando em e-mails, pastas e WhatsApp por vários minutos.' },
        { emoji: '📋', label: 'Peço para o cliente me mandar de volta porque não sei onde guardei.' },
        { emoji: '📁', label: 'Tenho uma pasta no computador, mas é difícil navegar.' },
        { emoji: '✅', label: 'Encontro fácil, tenho tudo organizado por cliente.' },
      ] },

    { type: 'single', key: 'entende_contrato',
      title: 'Hoje, o seu processo de fechar contrato é:',
      options: [
        { emoji: '💬', label: 'Mando o arquivo por WhatsApp e espero o cliente responder.' },
        { emoji: '📝', label: 'Peço pra assinar em papel e fico com uma via.' },
        { emoji: '🤷', label: 'Não tenho processo. Cada fechamento é um improviso.' },
        { emoji: '📊', label: 'Tenho processo, mas não consigo acompanhar o status de cada contrato.' },
      ] },

    { type: 'comparison',
      key: 'quer_modelos',
      heading: 'Contrato não é papel. É sistema.',
      afterImg: 'assets/mockup-app-macbook.webp',
      body: 'O <b>Blindagem</b> inclui os <b>+200 Modelos de Contrato Visual</b> (fotografia, vídeo, eventos, ensaio e muito mais) mais tudo que você precisa para gerir contratos do início ao fim: gere, envie para assinar digitalmente, organize por cliente e acompanhe o status em tempo real.',
      question: 'Quer um sistema para gerar, assinar, organizar e acompanhar seus contratos?',
      options: [
        { emoji: '✅', label: 'Sim, preciso disso agora. Estou sem controle.' },
        { emoji: '🤔', label: 'Sim, mas quero entender melhor como funciona.' },
        { emoji: '💭', label: 'Talvez, ainda tenho algumas dúvidas.' },
      ] },

    { type: 'capture',
      heading: 'Falta pouco para o seu diagnóstico.',
      img: 'assets/foto-checkout.jpg',
      body: 'Sou Felipe Ferreira, advogado especializado em profissionais da imagem, fotógrafo e videomaker há 15 anos, Mestre em Gestão e Inovação pela UFSC e fundador do Fotografia é o Meu Negócio. Criei o Blindagem para acabar de vez com o caos dos contratos no WhatsApp. Deixe seus dados para ver o seu diagnóstico.',
      cta: 'Ver o meu diagnóstico' },

    { type: 'loading',
      img: 'assets/mockup-app-celular.webp',
      heading: 'Com o Blindagem você ganha:',
      duration: 4500,
      items: [
        { emoji: '📝', title: 'Geração de Contratos', body: 'Crie contratos profissionais em minutos, do zero.' },
        { emoji: '✍️', title: 'Assinatura Digital', body: 'Assine e receba assinaturas sem papel ou impressora.' },
        { emoji: '📁', title: 'Organização Total', body: 'Todos os contratos centralizados e fáceis de encontrar.' },
        { emoji: '🔔', title: 'Acompanhamento em Tempo Real', body: 'Saiba o status de cada contrato sem precisar ligar pro cliente.' },
        { emoji: '🎨', title: '+200 Modelos de Contrato Visual incluídos', body: 'Fotografia, vídeo, ensaio, evento e muito mais. Prontos para usar, adaptáveis ao seu nicho.' },
        { emoji: '🛡️', title: 'Muito mais proteção jurídica para o seu negócio.' },
      ],
      loadingText: 'Analisando perfil e gerando relatório…' },

    { type: 'result' },
    { type: 'precheckout' },
  ],
};
