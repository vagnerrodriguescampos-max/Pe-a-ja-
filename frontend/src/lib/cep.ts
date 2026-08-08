export type EnderecoDoCep = {
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
};

/** Aplica a máscara 00000-000 conforme o usuário digita. */
export function formatarCep(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

export function cepCompleto(valor: string) {
  return valor.replace(/\D/g, '').length === 8;
}

/**
 * Consulta o ViaCEP (gratuito, sem chave de API).
 *
 * Devolve `null` em vez de lançar quando o CEP não existe ou o serviço está fora do ar:
 * a busca é uma conveniência, e o cliente sempre pode digitar o endereço na mão — nunca
 * pode ficar impedido de fechar o pedido porque um serviço externo caiu.
 */
export async function buscarCep(valor: string): Promise<EnderecoDoCep | null> {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length !== 8) return null;

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (!resposta.ok) return null;

    const dados = await resposta.json();
    if (dados.erro) return null;

    return {
      logradouro: dados.logradouro || '',
      bairro: dados.bairro || '',
      cidade: dados.localidade || '',
      estado: dados.uf || '',
      cep: formatarCep(digitos),
    };
  } catch {
    return null;
  }
}
