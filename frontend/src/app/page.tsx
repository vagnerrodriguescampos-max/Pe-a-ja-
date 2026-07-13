import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-5">🛍️</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Eu Pedi</h1>
        <p className="text-gray-500 text-lg mb-8">
          Peça direto da sua loja favorita,<br />sem comissão
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/cadastrar"
            className="bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-3.5 rounded-2xl transition-colors text-sm">
            Cadastre seu restaurante grátis
          </Link>
          <Link
            href="/admin/login"
            className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-8 py-3.5 rounded-2xl transition-colors text-sm">
            Já tenho conta
          </Link>
        </div>
        <p className="mt-10 text-xs text-gray-400">
          Cardápio de restaurante?{' '}
          <code className="bg-gray-100 px-2 py-0.5 rounded font-mono">/loja/seu-slug</code>
        </p>
      </div>
    </div>
  );
}
