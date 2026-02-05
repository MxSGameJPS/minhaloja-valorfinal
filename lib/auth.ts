import { cookies } from "next/headers";
import { refreshAccessToken } from "./mercadolibre";

/**
 * Tenta obter o access token dos cookies.
 * Se não existir, retorna null.
 * Se existir, tenta usar.
 * Opcionalmente, pode-se verificar a validade se tivéssemos salvo o 'expires_at'.
 * Como o ML retorna 401 se expirado, podemos implementar uma lógica de tentativa e refresh.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("ml_access_token")?.value;
  const refreshToken = cookieStore.get("ml_refresh_token")?.value;

  if (accessToken) return accessToken;

  // Se não tem access token mas tem refresh token, tenta renovar
  if (refreshToken) {
    try {
      console.log("Access token missing/expired. Attempting refresh...");
      const newTokenData = await refreshAccessToken(refreshToken);

      // Atualizar cookies
      // Nota: Não podemos setar cookies aqui facilmente pois estamos numa função auxiliar,
      // não numa Route Handler ou Server Action que retorna Response.
      // MAS, em Next.js App Router (Server Components/Actions), 'cookies().set' funciona.

      cookieStore.set("ml_access_token", newTokenData.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: newTokenData.expires_in,
      });

      if (newTokenData.refresh_token) {
        cookieStore.set("ml_refresh_token", newTokenData.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }

      return newTokenData.access_token;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      return null;
    }
  }

  return null;
}
