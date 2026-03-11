import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, name, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    // Direct mock login: find or create the user
    // In a real app, this would be handled by Google SSO or similar
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, role },
      create: { email, name, role },
    });

    const sessionData = {
      userId: user.id,
      email: user.email,
      role: user.role as "SA" | "ADMIN",
      name: user.name || undefined,
    };

    const token = await encrypt(sessionData);

    const response = NextResponse.json({ success: true, user });
    
    response.cookies.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 2, // 2 hours
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
