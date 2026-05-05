import { homeHandler } from "./home.ts";
import { autopipelineHandler } from "./autopipeline.ts";
import { doctorHandler } from "./doctor.ts";
import { modelsHandler } from "./models.ts";
import { newsBitesHandler } from "./newsbites.ts";
import { infraHandler } from "./infra.ts";

export async function handleApi(req: Request, url: URL): Promise<Response> {
  const { pathname } = url;
  const method = req.method;

  if (method === "GET" && pathname === "/api/home") return homeHandler();
  if (method === "GET" && pathname === "/api/autopipeline") return autopipelineHandler();
  if (method === "GET" && pathname === "/api/doctor") return doctorHandler(url);
  if (method === "GET" && pathname === "/api/models") return modelsHandler();
  if (method === "GET" && pathname === "/api/newsbites") return newsBitesHandler();
  if (method === "GET" && pathname === "/api/infra") return infraHandler();

  return new Response(JSON.stringify({ error: "not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
