import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Remove todos os cookies de autenticação do ML
    cookieStore.delete("ml_access_token");
    cookieStore.delete("ml_refresh_token");
    cookieStore.delete("ml_user_id");

    return NextResponse.json({ message: "Logout realizado com sucesso" });
  } catch (error) {
    console.error("Erro ao fazer logout:", error);
    return NextResponse.json(
      { error: "Erro ao fazer logout" },
      { status: 500 },
    );
  }
}
