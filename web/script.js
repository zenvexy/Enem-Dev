const API_URL = 'https://api.enem.dev/v1';

const NOMES_AREAS = {
  linguagens: 'Linguagens',
  'ciencias-humanas': 'Ciências Humanas',
  'ciencias-natureza': 'Ciências da Natureza',
  matematica: 'Matemática'
};


// Todas as rotas usam o mesmo GET mostrado na documentação da API.
async function buscarNaApi(rota) {
  const options = { method: 'GET' };
  const url = `${API_URL}${rota}`;

  let resposta = await fetch(url, options);

  // A API limita algumas rotas. Se necessário, tentamos mais uma vez.
  if (resposta.status === 429) {
    await esperar(1200);
    resposta = await fetch(url, options);
  }

  if (!resposta.ok) {
    throw new Error(`A API retornou o erro ${resposta.status}.`);
  }

  return resposta.json();
}


function esperar(milissegundos) {
  return new Promise((resolver) => setTimeout(resolver, milissegundos));
}


function textoSeguro(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caractere) => {
    const trocas = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return trocas[caractere];
  });
}


function imagemSegura(url) {
  try {
    const endereco = new URL(url);

    if (!['http:', 'https:'].includes(endereco.protocol)) {
      return '';
    }

    if (endereco.pathname.endsWith('/broken-image.svg')) {
      return '';
    }

    return `<img src="${textoSeguro(endereco.href)}" alt="Imagem da questão" loading="lazy">`;
  } catch {
    return '';
  }
}


function formatarTexto(texto) {
  if (!texto) {
    return '';
  }

  let resultado = textoSeguro(texto);

  resultado = resultado.replace(
    /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g,
    (_, url) => imagemSegura(url.replaceAll('&amp;', '&'))
  );

  resultado = resultado.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  return resultado.replaceAll('\n', '<br>');
}


function mostrarErro(elemento, erro) {
  elemento.hidden = false;
  elemento.classList.add('error');
  elemento.textContent = `Não foi possível carregar os dados. ${erro.message}`;
}


// Página de provas: GET /exams e GET /exams/{year}.
async function iniciarPaginaProvas() {
  const status = document.querySelector('#provas-status');
  const lista = document.querySelector('#lista-provas');
  const detalhes = document.querySelector('#detalhes-prova');

  let provas = [];

  try {
    provas = await buscarNaApi('/exams');
    provas.sort((a, b) => b.year - a.year);

    lista.innerHTML = provas.map((prova) => `
      <button class="exam-card" type="button" data-ano="${textoSeguro(prova.year)}">
        <strong>${textoSeguro(prova.title)}</strong>
        <span>Ver detalhes da prova →</span>
      </button>
    `).join('');

    status.hidden = true;
  } catch (erro) {
    mostrarErro(status, erro);
    return;
  }

  lista.addEventListener('click', async (evento) => {
    const botao = evento.target.closest('[data-ano]');

    if (!botao) {
      return;
    }

    const ano = botao.dataset.ano;
    const provaDaLista = provas.find((prova) => String(prova.year) === ano);

    detalhes.hidden = false;
    document.querySelector('#titulo-prova').textContent = `ENEM ${ano}`;
    document.querySelector('#info-prova').textContent = 'Carregando detalhes...';
    detalhes.scrollIntoView({ behavior: 'smooth' });

    try {
      const prova = await buscarNaApi(`/exams/${ano}`);
      mostrarDetalhesProva(prova);
    } catch {
      mostrarDetalhesProva(provaDaLista);
      document.querySelector('#info-prova').textContent =
        'Os detalhes completos não estão disponíveis agora. Veja as áreas e abra as questões.';
    }
  });

  function mostrarDetalhesProva(prova) {
    document.querySelector('#titulo-prova').textContent = prova.title;

    document.querySelector('#info-prova').textContent =
      `${prova.disciplines.length} áreas do conhecimento · ${prova.languages.length} idiomas disponíveis`;

    const areas = prova.disciplines.map((area) => `
      <span>${textoSeguro(area.label)}</span>
    `).join('');

    const idiomas = prova.languages.map((idioma) => `
      <span>${textoSeguro(idioma.label)}</span>
    `).join('');

    document.querySelector('#areas-prova').innerHTML = areas + idiomas;
    document.querySelector('#link-questoes').href = `questoes.html?year=${prova.year}`;
  }
}


// Página de questões: GET /exams/{year}/questions e
// GET /exams/{year}/questions/{index}.
async function iniciarPaginaQuestoes() {
  const anoSelect = document.querySelector('#ano');
  const areaSelect = document.querySelector('#area');
  const idiomaSelect = document.querySelector('#idioma');
  const status = document.querySelector('#questoes-status');
  const lista = document.querySelector('#lista-questoes');
  const paginacao = document.querySelector('#paginacao');
  const parametros = new URLSearchParams(window.location.search);

  let todasQuestoes = [];
  let pagina = 0;
  let carregamentoAtual = 0;
  let carregando = false;

  if (NOMES_AREAS[parametros.get('area')]) {
    areaSelect.value = parametros.get('area');
  }

  if (['ingles', 'espanhol'].includes(parametros.get('language'))) {
    idiomaSelect.value = parametros.get('language');
  }

  try {
    const provas = await buscarNaApi('/exams');
    provas.sort((a, b) => b.year - a.year);

    anoSelect.innerHTML = provas.map((prova) => `
      <option value="${textoSeguro(prova.year)}">ENEM ${textoSeguro(prova.year)}</option>
    `).join('');

    const anoPedido = parametros.get('year');

    if (provas.some((prova) => String(prova.year) === anoPedido)) {
      anoSelect.value = anoPedido;
    }

    await esperar(1100);
    carregarQuestoes();
  } catch (erro) {
    mostrarErro(status, erro);
  }

  async function carregarQuestoes() {
    const meuCarregamento = ++carregamentoAtual;
    const ano = anoSelect.value;
    const idioma = idiomaSelect.value;

    pagina = 0;
    todasQuestoes = [];
    carregando = true;
    anoSelect.disabled = true;
    idiomaSelect.disabled = true;
    lista.innerHTML = '';
    paginacao.hidden = true;
    status.hidden = false;
    status.classList.remove('error');
    status.textContent = 'Carregando questões...';
    fecharQuestao();

    try {
      let offset = 0;
      let continuar = true;

      // A lista vem em páginas. Carregamos todas para filtrar por área.
      while (continuar) {
        const rota = `/exams/${ano}/questions?limit=50&offset=${offset}&language=${idioma}`;
        const dados = await buscarNaApi(rota);

        if (meuCarregamento !== carregamentoAtual) {
          return;
        }

        todasQuestoes.push(...dados.questions);
        offset += dados.questions.length;
        continuar = dados.metadata.hasMore && dados.questions.length > 0;

        if (continuar) {
          status.textContent = `Carregando questões... ${todasQuestoes.length}`;
          await esperar(1100);
        }
      }

      carregando = false;
      anoSelect.disabled = false;
      idiomaSelect.disabled = false;
      status.hidden = true;
      mostrarLista();
    } catch (erro) {
      if (meuCarregamento === carregamentoAtual) {
        carregando = false;
        anoSelect.disabled = false;
        idiomaSelect.disabled = false;
        mostrarErro(status, erro);
      }
    }
  }

  function mostrarLista() {
    const area = areaSelect.value;
    const filtradas = area === 'todas'
      ? todasQuestoes
      : todasQuestoes.filter((questao) => questao.discipline === area);

    const porPagina = 10;
    const totalPaginas = Math.ceil(filtradas.length / porPagina);
    const visiveis = filtradas.slice(pagina * porPagina, (pagina + 1) * porPagina);

    lista.innerHTML = visiveis.map((questao) => `
      <button class="question-card" type="button" data-index="${textoSeguro(questao.index)}">
        <strong>${textoSeguro(questao.title)}</strong>
        <span>${textoSeguro(NOMES_AREAS[questao.discipline] || 'Área não informada')}</span>
      </button>
    `).join('');

    if (!filtradas.length) {
      status.hidden = false;
      status.textContent = 'Nenhuma questão encontrada para essa área.';
    } else {
      status.hidden = true;
    }

    paginacao.hidden = totalPaginas <= 1;
    document.querySelector('#pagina-atual').textContent =
      `Página ${pagina + 1} de ${totalPaginas}`;
    document.querySelector('#anterior').disabled = pagina === 0;
    document.querySelector('#proxima').disabled = pagina >= totalPaginas - 1;
  }

  async function abrirQuestao(index) {
    const ano = anoSelect.value;
    const idioma = idiomaSelect.value;
    const painel = document.querySelector('#questao-aberta');

    painel.hidden = false;
    document.querySelector('#titulo-questao').textContent = 'Carregando questão...';
    document.querySelector('#enunciado').innerHTML = '';
    document.querySelector('#alternativas').innerHTML = '';
    document.querySelector('#resposta').hidden = true;
    painel.scrollIntoView({ behavior: 'smooth' });

    try {
      const rota = `/exams/${ano}/questions/${index}?language=${idioma}`;
      const questao = await buscarNaApi(rota);

      document.querySelector('#titulo-questao').textContent = questao.title;

      const imagens = (questao.files || []).map(imagemSegura).join('');

      document.querySelector('#enunciado').innerHTML = `
        <div>${formatarTexto(questao.context)}</div>
        ${imagens}
        <p>${formatarTexto(questao.alternativesIntroduction)}</p>
      `;

      const alternativas = document.querySelector('#alternativas');

      alternativas.innerHTML = questao.alternatives.map((alternativa) => `
        <button class="alternative" type="button" data-letra="${textoSeguro(alternativa.letter)}">
          <strong>${textoSeguro(alternativa.letter)}</strong>
          <span>
            ${formatarTexto(alternativa.text)}
            ${alternativa.file ? imagemSegura(alternativa.file) : ''}
          </span>
        </button>
      `).join('');

      alternativas.onclick = (evento) => {
        const escolhida = evento.target.closest('[data-letra]');

        if (!escolhida) {
          return;
        }

        const correta = questao.correctAlternative;
        const resposta = document.querySelector('#resposta');

        alternativas.querySelectorAll('.alternative').forEach((botao) => {
          botao.disabled = true;

          if (botao.dataset.letra === correta) {
            botao.classList.add('correct');
          }
        });

        if (escolhida.dataset.letra !== correta) {
          escolhida.classList.add('wrong');
        }

        resposta.textContent = escolhida.dataset.letra === correta
          ? 'Você acertou!'
          : `A resposta correta é ${correta}.`;
        resposta.hidden = false;
        alternativas.onclick = null;
      };
    } catch (erro) {
      document.querySelector('#titulo-questao').textContent = 'Erro ao abrir questão';
      document.querySelector('#enunciado').textContent = erro.message;
    }
  }

  function fecharQuestao() {
    document.querySelector('#questao-aberta').hidden = true;
  }

  anoSelect.addEventListener('change', carregarQuestoes);
  idiomaSelect.addEventListener('change', carregarQuestoes);

  areaSelect.addEventListener('change', () => {
    pagina = 0;
    fecharQuestao();

    if (!carregando) {
      mostrarLista();
    }
  });

  lista.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-index]');

    if (botao) {
      abrirQuestao(botao.dataset.index);
    }
  });

  document.querySelector('#anterior').addEventListener('click', () => {
    pagina--;
    mostrarLista();
  });

  document.querySelector('#proxima').addEventListener('click', () => {
    pagina++;
    mostrarLista();
  });

  document.querySelector('#fechar-questao').addEventListener('click', fecharQuestao);
}


if (document.body.dataset.page === 'provas') {
  iniciarPaginaProvas();
}

if (document.body.dataset.page === 'questoes') {
  iniciarPaginaQuestoes();
}
