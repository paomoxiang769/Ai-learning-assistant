import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AuthCredentials = {
  email: string;
  password: string;
};

function redirectToLogin(request: NextRequest, params?: Record<string, string>) {
  const url = new URL("/login", request.url);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url);
}

function redirectToDashboard(request: NextRequest) {
  return NextResponse.redirect(new URL("/dashboard", request.url));
}

function getCredentials(formData: FormData): AuthCredentials | null {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown authentication error.";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const action = String(formData.get("auth_action") ?? "");
  const supabase = await createClient();

  if (action === "logout") {
    await supabase.auth.signOut();

    return redirectToLogin(request);
  }

  const credentials = getCredentials(formData);

  if (!credentials) {
    return redirectToLogin(request, {
      error: "Please enter both email and password.",
    });
  }

  if (action === "signup") {
    const { data, error } = await supabase.auth.signUp(credentials);

    if (error) {
      return redirectToLogin(request, { error: getAuthErrorMessage(error) });
    }

    if (!data.session) {
      return redirectToLogin(request, {
        message: "Registration started. Please check your email before logging in.",
      });
    }

    return redirectToDashboard(request);
  }

  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return redirectToLogin(request, { error: getAuthErrorMessage(error) });
  }

  return redirectToDashboard(request);
}
