import { cookies } from "next/headers";
import Link from "next/link";
import Dashboard from "@/components/Dashboard";

export default async function Home() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("ml_access_token");

  const isLoggedIn = !!accessToken;

  const clientId = process.env.ML_CLIENT_ID;
  const redirectUri = process.env.ML_REDIRECT_URI;
  const loginUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-blue-900 tracking-tight">
            MinhaLoja(SuaMarcaAqui){" "}
            <span className="text-yellow-500">ValorFinal</span>
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Sistema de Precificação Inteligente para Mercado Livre
          </p>
        </div>

        {!isLoggedIn ? (
          <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center justify-center space-y-6">
            <div className="text-center space-y-2">
              <p className="text-gray-500">
                Para acessar a calculadora, faça login com sua conta do Mercado
                Livre.
              </p>
            </div>
            <Link
              href={loginUrl}
              className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105 shadow-lg"
            >
              <svg
                className="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3.7,21.9h16.6c1,0,1.7-0.8,1.7-1.7V3.8c0-1-0.8-1.7-1.7-1.7H3.7c-1,0-1.7,0.8-1.7,1.7v16.3C2,21.1,2.8,21.9,3.7,21.9z M13.8,19.3c0,0.7-0.6,1.2-1.2,1.2h-1.2c-0.7,0-1.2-0.6-1.2-1.2v-1.2c0-0.7,0.6-1.2,1.2-1.2h1.2c0.7,0,1.2,0.6,1.2,1.2V19.3z M10.2,7C10.2,5.5,11.5,5,12,5c2.9,0,4.2,2.2,4.2,4c0,3.3-2.9,3.9-2.9,6.1h-2.5c0-3.3,3-3.8,3-6c0-0.8-0.6-1.7-1.8-1.7c-1.3,0-1.7,1.1-1.7,2L10.2,7z" />
              </svg>
              <span>Entrar com Mercado Livre</span>
            </Link>
          </div>
        ) : (
          <Dashboard />
        )}

        <footer className="text-center text-gray-400 text-sm mt-12">
          &copy; {new Date().getFullYear()} MinhaLoja(SuaMarcaAqui). Todos os
          direitos reservados.
        </footer>
      </div>
    </main>
  );
}
