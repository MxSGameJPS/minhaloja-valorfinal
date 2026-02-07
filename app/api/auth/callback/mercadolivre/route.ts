import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/mercadolibre";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Code not provided" }, { status: 400 });
  }

  try {
    const redirectUri = process.env.ML_REDIRECT_URI!;
    const tokenData = await getAccessToken(code, redirectUri);

    // Armazenar tokens em cookies seguros (HttpOnly)
    const cookieStore = await cookies();

    cookieStore.set("ml_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: tokenData.expires_in,
    });

    cookieStore.set("ml_refresh_token", tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 dias (exemplo)
    });

    cookieStore.set("ml_user_id", String(tokenData.user_id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    // Redirecionar para a home
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Auth Error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}
