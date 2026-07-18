import { formatCurrency, formatPhone } from './utils';

// Intl.NumberFormat('pt-BR') usa espaço não-quebrável (code point 160) entre "R$" e o valor.
const NBSP = String.fromCharCode(160);

describe('formatCurrency', () => {
  it('formata valores positivos em BRL', () => {
    expect(formatCurrency(22)).toBe(`R$${NBSP}22,00`);
    expect(formatCurrency(1234.5)).toBe(`R$${NBSP}1.234,50`);
  });

  it('formata zero', () => {
    expect(formatCurrency(0)).toBe(`R$${NBSP}0,00`);
  });
});

describe('formatPhone', () => {
  it('formata celular com 11 dígitos', () => {
    expect(formatPhone('11999990000')).toBe('(11) 99999-0000');
  });

  it('formata fixo com 10 dígitos', () => {
    expect(formatPhone('1133330000')).toBe('(11) 3333-0000');
  });

  it('ignora caracteres não numéricos antes de formatar', () => {
    expect(formatPhone('(11) 99999-0000')).toBe('(11) 99999-0000');
  });

  it('retorna o valor original quando não tem 10 nem 11 dígitos', () => {
    expect(formatPhone('123')).toBe('123');
  });
});
