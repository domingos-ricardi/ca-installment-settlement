import type { NextConfig } from "next";

// Hosts permitidos no dev server (Next 16 bloqueia por segurança recursos
// de desenvolvimento — /_next/static, /_next/hmr — quando o Host é tratado
// como cross-origin, respondendo 403 no navegador).
//
// Em WSL2 + acesso pela rede local, o Host recebido é o IP do Windows
// (ex.: 192.168.1.23), não o do WSL. Adicione aqui todos os IPs/hostnames
// usados para acessar a máquina em desenvolvimento, ou defina a variável
// ALLOWED_DEV_ORIGINS (separada por vírgula) no .env.local.
const envOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    // Acessos locais (localhost/loopback) e o IP atual da LAN do Windows.
    "localhost",
    "127.0.0.1",
    "192.168.1.23",
    ...envOrigins,
  ],
};

export default nextConfig;
