const CHAVE_RASCUNHO = 'enem-dev-redacao';

const editor = document.querySelector('#rascunho');
const temaLivre = document.querySelector('#tema-livre');
const fonte = document.querySelector('#fonte');
const tamanho = document.querySelector('#tamanho');
const botaoPdf = document.querySelector('#salvar-pdf');
const botoesTemas = [...document.querySelectorAll('[data-tema]')];
const RECUO = '\t';

const fontes = {
  arial: 'Arial, Helvetica, sans-serif',
  georgia: 'Georgia, serif',
  mono: 'Consolas, monospace'
};

let temaSelecionado = '';

const espelho = document.createElement('div');
espelho.className = 'editor-measure';
espelho.setAttribute('aria-hidden', 'true');
document.body.append(espelho);


function selecionarTema(tema) {
  temaSelecionado = tema;

  document.querySelector('#tema-selecionado').textContent = tema
    ? `Tema: ${tema}`
    : 'Selecione um tema acima ou escreva o seu.';

  botoesTemas.forEach((botao) => {
    botao.setAttribute('aria-pressed', String(botao.dataset.tema === tema));
  });

  salvarRascunho();
}


function aplicarFonte() {
  editor.style.fontFamily = fontes[fonte.value] || fontes.arial;
  editor.style.fontSize = `${Number(tamanho.value) || 18}px`;

  atualizarContadores();
  salvarRascunho();
}


function contarLinhasVisuais() {
  if (!editor.value) {
    return 0;
  }

  const estilo = window.getComputedStyle(editor);

  espelho.style.width = `${editor.clientWidth}px`;
  espelho.style.fontFamily = estilo.fontFamily;
  espelho.style.fontSize = estilo.fontSize;
  espelho.style.fontWeight = estilo.fontWeight;
  espelho.style.lineHeight = estilo.lineHeight;
  espelho.style.letterSpacing = estilo.letterSpacing;
  espelho.style.padding = estilo.padding;
  espelho.style.tabSize = estilo.tabSize;
  espelho.textContent = `${editor.value}\u200b`;

  const alturaDoTexto = espelho.scrollHeight
    - parseFloat(estilo.paddingTop)
    - parseFloat(estilo.paddingBottom);

  return Math.max(1, Math.ceil(alturaDoTexto / parseFloat(estilo.lineHeight) - 0.01));
}


function atualizarContadores() {
  const texto = editor.value.trim();
  const linhas = contarLinhasVisuais();
  const palavras = texto ? texto.split(/\s+/).length : 0;
  const paragrafos = texto
    ? texto.split(/\n+/).filter((trecho) => trecho.trim()).length
    : 0;
  const excedeu = linhas > 30;

  document.querySelector('#contador-linhas').textContent =
    `${linhas} de 30 linhas estimadas`;

  document.querySelector('#contador-palavras').textContent =
    `${palavras} ${palavras === 1 ? 'palavra' : 'palavras'}`;

  document.querySelector('#contador-paragrafos').textContent =
    `${paragrafos} ${paragrafos === 1 ? 'parágrafo' : 'parágrafos'}`;

  document.querySelector('#progresso-linhas').style.width =
    `${Math.min(100, linhas / 30 * 100)}%`;

  document.querySelector('#aviso-linhas').hidden = !excedeu;
  document.querySelector('.editor-stats').classList.toggle('over-limit', excedeu);
  document.querySelector('.line-progress').classList.toggle('over-limit', excedeu);
  botaoPdf.disabled = !texto;
}


function salvarRascunho() {
  const dados = {
    texto: editor.value,
    tema: temaSelecionado,
    temaLivre: temaLivre.value,
    fonte: fonte.value,
    tamanho: tamanho.value
  };

  try {
    localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(dados));
  } catch {
  }
}


function restaurarRascunho() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || 'null');

    if (!dados) {
      return;
    }

    editor.value = dados.texto || '';
    temaLivre.value = dados.temaLivre || '';

    if (fontes[dados.fonte]) {
      fonte.value = dados.fonte;
    }

    if (['16', '18', '20'].includes(dados.tamanho)) {
      tamanho.value = dados.tamanho;
    }

    selecionarTema(dados.tema || '');
  } catch {
  }
}


document.querySelector('#lista-temas').addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-tema]');

  if (botao) {
    temaLivre.value = '';
    selecionarTema(botao.dataset.tema);
  }
});


temaLivre.addEventListener('input', () => {
  selecionarTema(temaLivre.value.trim());
});


editor.addEventListener('input', () => {
  atualizarContadores();
  salvarRascunho();
});


fonte.addEventListener('change', aplicarFonte);
tamanho.addEventListener('change', aplicarFonte);


document.querySelector('#novo-paragrafo').addEventListener('click', () => {
  const inicio = editor.selectionStart;
  const fim = editor.selectionEnd;
  const textoAntes = editor.value.slice(0, inicio);
  const precisaNovaLinha = textoAntes.trim() && !textoAntes.endsWith('\n');
  const separador = `${precisaNovaLinha ? '\n' : ''}${RECUO}`;

  editor.setRangeText(separador, inicio, fim, 'end');
  editor.focus();
  atualizarContadores();
  salvarRascunho();
});


editor.addEventListener('keydown', (evento) => {
  if (evento.key !== 'Tab' || evento.shiftKey || evento.ctrlKey || evento.altKey) {
    return;
  }

  evento.preventDefault();
  editor.setRangeText(RECUO, editor.selectionStart, editor.selectionEnd, 'end');
  atualizarContadores();
  salvarRascunho();
});


document.querySelector('#limpar-rascunho').addEventListener('click', () => {
  if (!editor.value || window.confirm('Apagar o texto do rascunho?')) {
    editor.value = '';
    atualizarContadores();
    salvarRascunho();
    editor.focus();
  }
});


botaoPdf.addEventListener('click', () => {
  if (!editor.value.trim()) {
    return;
  }

  const titulo = temaSelecionado || 'Tema livre';
  const textoPdf = document.querySelector('#pdf-texto');

  document.querySelector('#pdf-tema').textContent = titulo;
  textoPdf.textContent = editor.value;
  textoPdf.style.fontFamily = fontes[fonte.value] || fontes.arial;
  textoPdf.style.fontSize = `${Number(tamanho.value) || 18}px`;

  window.print();
});


window.addEventListener('resize', atualizarContadores);

restaurarRascunho();
aplicarFonte();
