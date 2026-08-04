import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({ baseURL: BASE_URL });

// Injeta token JWT nas requisições admin
api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API pública
export const getLoja = (slug: string) => api.get(`/loja/${slug}`).then(r => r.data);
export const getCardapio = (lojaId: string) => api.get(`/loja/${lojaId}/cardapio`).then(r => r.data);
export const getProduto = (lojaId: string, id: string) => api.get(`/loja/${lojaId}/produto/${id}`).then(r => r.data);
export const criarPedido = (slug: string, body: any) => api.post(`/loja/${slug}/pedidos`, body).then(r => r.data);
export const getPedido = (id: string, tokenAcesso: string) =>
  api.get(`/pedidos/${id}`, { params: { token: tokenAcesso } }).then(r => r.data);

// API admin
export const adminLogin = (email: string, senha: string) =>
  api.post('/auth/login', { email, senha }).then(r => r.data);

export const adminGetLoja = () => api.get('/admin/loja').then(r => r.data);
export const adminUpdateLoja = (data: any) => api.patch('/admin/loja', data).then(r => r.data);

export const adminGetCardapio = () => api.get('/admin/cardapio').then(r => r.data);
export const adminGetPedidos = (status?: string) =>
  api.get('/admin/pedidos', { params: status ? { status } : {} }).then(r => r.data);
export const adminAtualizarStatus = (id: string, status: string) =>
  api.patch(`/admin/pedidos/${id}/status`, { status }).then(r => r.data);

export const adminCriarCategoria = (data: any) => api.post('/admin/categorias', data).then(r => r.data);
export const adminAtualizarCategoria = (id: string, data: any) => api.patch(`/admin/categorias/${id}`, data).then(r => r.data);
export const adminDeletarCategoria = (id: string) => api.delete(`/admin/categorias/${id}`).then(r => r.data);

export const adminCriarProduto = (data: any) => api.post('/admin/produtos', data).then(r => r.data);
export const adminAtualizarProduto = (id: string, data: any) => api.patch(`/admin/produtos/${id}`, data).then(r => r.data);
export const adminDeletarProduto = (id: string) => api.delete(`/admin/produtos/${id}`).then(r => r.data);

// Grupos de opção (tamanhos, sabores, adicionais) e suas opções
export const adminCriarGrupo = (produtoId: string, data: any) => api.post(`/admin/produtos/${produtoId}/grupos`, data).then(r => r.data);
export const adminAtualizarGrupo = (id: string, data: any) => api.patch(`/admin/grupos/${id}`, data).then(r => r.data);
export const adminDeletarGrupo = (id: string) => api.delete(`/admin/grupos/${id}`).then(r => r.data);
export const adminCriarOpcao = (grupoId: string, data: any) => api.post(`/admin/grupos/${grupoId}/opcoes`, data).then(r => r.data);
export const adminAtualizarOpcao = (id: string, data: any) => api.patch(`/admin/opcoes/${id}`, data).then(r => r.data);
export const adminDeletarOpcao = (id: string) => api.delete(`/admin/opcoes/${id}`).then(r => r.data);

export const adminListarMotoboys = () => api.get('/admin/motoboys').then(r => r.data);
export const adminAtribuirMotoboy = (pedidoId: string, motoboyId: string) =>
  api.post(`/admin/motoboys/pedido/${pedidoId}/atribuir`, { motoboy_id: motoboyId }).then(r => r.data);

export const adminGetConfigIA = () => api.get('/admin/ia/config').then(r => r.data);
export const adminUpdateConfigIA = (data: any) => api.patch('/admin/ia/config', data).then(r => r.data);

export const adminPushSubscribe = (data: any) => api.post('/admin/push/subscribe', data).then(r => r.data);
export const adminPushUnsubscribe = (endpoint: string) => api.delete('/admin/push/unsubscribe', { data: { endpoint } }).then(r => r.data);

// Gestão de usuários da loja
export const adminListarUsuarios = () => api.get('/admin/usuarios').then(r => r.data);
export const adminCriarUsuario = (data: { nome: string; email: string; senha: string; papel: string }) =>
  api.post('/admin/usuarios', data).then(r => r.data);
export const adminAtualizarUsuario = (id: string, data: { nome?: string; papel?: string; ativo?: boolean; senha?: string }) =>
  api.patch(`/admin/usuarios/${id}`, data).then(r => r.data);
export const adminRemoverUsuario = (id: string) => api.delete(`/admin/usuarios/${id}`).then(r => r.data);

// Conexão do WhatsApp da loja (Meta Cloud API / Embedded Signup)
export const adminGetWhatsappStatus = () => api.get('/admin/whatsapp/status').then(r => r.data);
export const adminConectarWhatsapp = (data: { waba_id: string; phone_number_id: string }) =>
  api.post('/admin/whatsapp/conectar', data).then(r => r.data);
export const adminDesconectarWhatsapp = () => api.post('/admin/whatsapp/desconectar').then(r => r.data);
