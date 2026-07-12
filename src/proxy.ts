import { NextResponse } from "next/server";
import { auth } from "@/auth";
const publicPaths = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/api/health",
];
export default auth((request) => {
  const path = request.nextUrl.pathname;
  if (publicPaths.some((publicPath) => path.startsWith(publicPath)))
    return NextResponse.next();
  if (!request.auth) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
});
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
