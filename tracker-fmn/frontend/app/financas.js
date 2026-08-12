/* ================================================================
   Contas do dinheiro — fonte única

   POR QUE ESTE ARQUIVO EXISTE
   ───────────────────────────
   Antes desta versão, Dashboard e Financeiro calculavam resultado
   cada um do seu jeito, e chegavam a números diferentes pro mesmo
   mês. O rateio de despesa estava copiado inteiro nos dois arquivos,
   e o lucro tinha três definições concorrentes na mesma tela.

   Agora existe um lugar só. Quem quiser mudar a regra do dinheiro
   muda aqui, e as duas telas mudam junto. Não é organização por
   estética: era só questão de tempo até as duas divergirem em
   silêncio, que é o pior tipo de erro num painel financeiro.

   AS DEFINIÇÕES (combinadas com Felipe em 2026-08-12)
   ───────────────────────────────────────────────────
   Faturamento bruto ....... o valor da venda, que é a base da nota
   Faturamento líquido ..... o que a Hotmart deposita, já sem a taxa dela
   Imposto sobre a nota .... Simples Nacional, sobre o BRUTO
   Imposto Meta ............ sobre o gasto com anúncios
   Tráfego ................. o gasto com anúncios em si
   Despesas ................ o que é cadastrado à mão, rateado no período

   LUCRO = líquido - imposto da nota - imposto Meta - tráfego - despesas

   Duas decisões que valem explicação:

   1. O lucro parte do LÍQUIDO, não do bruto. A taxa da Hotmart é
      dinheiro que nunca chega na conta; contar ela como receita
      inflava o lucro em ~11% do faturamento.

   2. Reembolso NÃO é subtraído. Quando a Hotmart estorna, ela
      atualiza a própria linha da venda: de "aprovada" pra
      "reembolsada". A venda some sozinha do faturamento. Subtrair
      de novo descontava o mesmo reembolso duas vezes (em junho de
      2026 isso escondia R$ 1.288 de lucro). Reembolso não gera
      ganho nem custo, ele simplesmente não aconteceu.
   ================================================================ */

(function () {
  'use strict';

  /* ── Rateio de despesa dentro do período ───────────────────────
     Despesa mensal vale por dia: R$ 300/mês em 10 dias de período
     entram como R$ 100, não como R$ 300. Sem isso, escolher "7 dias"
     mostraria um mês inteiro de assinatura e afundaria o lucro da
     semana.                                                        */
  function rateioDespesa(despesa, from, to) {
    const dIni = new Date(from + 'T00:00:00');
    const dFim = new Date(to   + 'T00:00:00');
    const valor = Number(despesa.valor) || 0;

    if (despesa.tipo === 'unico') {
      const dEntry = new Date((despesa.data || from) + 'T00:00:00');
      return (dEntry >= dIni && dEntry <= dFim) ? valor : 0;
    }

    const recorrencia = despesa.recorrencia || 'mensal';
    let total = 0;

    if (recorrencia === 'mensal') {
      let cur = new Date(dIni.getFullYear(), dIni.getMonth(), 1);
      while (cur <= dFim) {
        const mesIni = new Date(cur.getFullYear(), cur.getMonth(), 1);
        const mesFim = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
        const sobIni = dIni > mesIni ? dIni : mesIni;
        const sobFim = dFim < mesFim ? dFim : mesFim;
        const dias = Math.max(0, Math.round((sobFim - sobIni) / 86400000) + 1);
        total += (valor / mesFim.getDate()) * dias;
        cur.setMonth(cur.getMonth() + 1);
      }
      return total;
    }

    if (recorrencia === 'anual') {
      for (let y = dIni.getFullYear(); y <= dFim.getFullYear(); y++) {
        const anoIni = new Date(y, 0, 1);
        const anoFim = new Date(y, 11, 31);
        const sobIni = dIni > anoIni ? dIni : anoIni;
        const sobFim = dFim < anoFim ? dFim : anoFim;
        const dias = Math.max(0, Math.round((sobFim - sobIni) / 86400000) + 1);
        const diasAno = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
        total += (valor / diasAno) * dias;
      }
      return total;
    }

    return valor;
  }

  function somarDespesas(lista, from, to) {
    return (lista || []).reduce((s, d) => s + rateioDespesa(d, from, to), 0);
  }

  /* ── O resultado do período ────────────────────────────────────
     `vendas` já vem filtrada pelo período e contém SÓ as aprovadas.
     `gasto` é o gasto com anúncios do mesmo período.               */
  function calcularResultado({ vendas, despesas, gasto, notaPct, metaPct, from, to }) {
    const aprovadas = (vendas || []).filter(v => v.status === 'aprovada' || v.status === undefined);

    // O bruto é a base da nota fiscal. Em venda parcelada, `preco_oferta`
    // é o preço do produto sem os juros do parcelamento, que é o que
    // realmente vira nota; quando não existe, o bruto serve.
    const bruto   = aprovadas.reduce((s, v) => s + Number(v.preco_oferta ?? v.valor_bruto ?? 0), 0);
    const liquido = aprovadas.reduce((s, v) => s + Number(v.valor_liquido ?? v.valor_bruto ?? 0), 0);
    const taxaHotmart = Math.max(0, bruto - liquido);

    const trafego     = Number(gasto) || 0;
    const impostoNota = bruto   * (Number(notaPct) / 100);
    // Sem faturamento não há nota, mas o imposto do anúncio é cobrado do
    // mesmo jeito: ele incide sobre o gasto, não sobre a venda.
    const impostoMeta = trafego * (Number(metaPct) / 100);
    const despesasPer = somarDespesas(despesas, from, to);

    const lucro  = liquido - impostoNota - impostoMeta - trafego - despesasPer;
    const margem = bruto > 0 ? (lucro / bruto) * 100 : 0;

    return {
      bruto, liquido, taxaHotmart,
      impostoNota, impostoMeta, trafego,
      despesas: despesasPer,
      custoTotal: taxaHotmart + impostoNota + impostoMeta + trafego + despesasPer,
      lucro, margem,
      vendas: aprovadas.length,
      // ROI: o que sobrou dividido pelo que foi investido pra fazer sobrar.
      roi:  (trafego + despesasPer) > 0 ? lucro / (trafego + despesasPer) : null,
      roas: trafego > 0 ? bruto / trafego : null,
    };
  }

  window.FMNFinancas = { rateioDespesa, somarDespesas, calcularResultado };
})();
