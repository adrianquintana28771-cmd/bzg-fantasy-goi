import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/posiciones")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/jugadores", statusCode: 301 });
  },
});
