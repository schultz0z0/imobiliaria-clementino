export const publicationIssueMessage = (path: readonly (string | number | symbol)[]): string => {
  const [section, field] = path;
  if (section === 'privateAddress') return 'Complete CEP, UF, cidade, bairro e logradouro.';
  if (section === 'publicLocation') return 'Confirme a localização pública aproximada.';
  if (section === 'classification') return 'Selecione a finalidade, o tipo e o subtipo do imóvel.';
  if (section === 'editorial' && field === 'title') return 'Informe um título com pelo menos 10 caracteres.';
  if (section === 'editorial' && field === 'description') return 'Escreva uma descrição com pelo menos 80 caracteres.';
  if (section === 'editorial' && field === 'reference') return 'Informe a referência comercial do imóvel.';
  if (section === 'pricing') return 'Informe o preço de cada finalidade selecionada.';
  if (section === 'media') return 'Revise a foto de capa e a ordem da galeria.';
  if (section === 'facts') return 'Revise os dados principais do imóvel.';
  return 'Revise os dados deste cadastro antes de publicar.';
};

