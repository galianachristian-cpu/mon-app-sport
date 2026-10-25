// Coach IA de « Mon Programme » : relais entre l'appli et l'API Claude.
// Secrets (Cloudflare) : ANTHROPIC_API_KEY, COACH_CODE (code d'accès saisi dans l'appli).
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `Tu es le coach sportif et nutrition personnel intégré à l'appli « Mon Programme », utilisée par Christian (sapeur-pompier) et Béa.
Réponds en français, en tutoyant, de façon concrète et courte (quelques phrases ou une petite liste), adaptée à un écran de téléphone.
Appuie-toi sur les données de l'appli fournies (programme du jour, historique, nutrition, poids, forme, matériel). Ne propose que des exercices faisables avec le matériel indiqué (caserne et maison).
En cas de douleur : propose des alternatives qui épargnent la zone, réduis la charge, et conseille de consulter un médecin ou un kiné si la douleur est vive, persiste ou s'aggrave. Tu ne poses pas de diagnostic médical.
Pour la nutrition : reste cohérent avec les objectifs caloriques et protéiques de l'appli, et privilégie ce qu'il reste à la maison quand c'est indiqué.
Si une information manque, dis-le simplement plutôt que d'inventer.`;

const json = (body, status, cors) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin)
      ? { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type, x-coach-code", "access-control-allow-methods": "POST, OPTIONS", vary: "origin" }
      : {};
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Méthode non autorisée" }, 405, cors);
    if (!env.COACH_CODE || request.headers.get("x-coach-code") !== env.COACH_CODE) return json({ error: "Code d'accès incorrect" }, 401, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Requête illisible" }, 400, cors); }
    const history = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const messages = history
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!messages.length || messages[0].role !== "user" || messages[messages.length - 1].role !== "user") return json({ error: "Conversation invalide" }, 400, cors);
    const context = String(body.context || "").slice(0, 40000);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        // consignes fixes en premier (mises en cache), données du jour ensuite
        system: [
          { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
          { type: "text", text: `Données actuelles de l'appli (JSON) :\n${context}` },
        ],
        messages,
      });
      if (response.stop_reason === "refusal") return json({ text: "Je ne peux pas répondre à cette demande. Reformule-la autrement, ou parle-en à un professionnel de santé si c'est médical." }, 200, cors);
      const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return json({ text: text || "Je n'ai pas de réponse pour l'instant, réessaie.", truncated: response.stop_reason === "max_tokens" }, 200, cors);
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) return json({ error: "Clé Anthropic invalide côté serveur" }, 502, cors);
      if (error instanceof Anthropic.RateLimitError) return json({ error: "Trop de demandes, réessaie dans une minute" }, 429, cors);
      if (error instanceof Anthropic.APIError) return json({ error: `Erreur du service IA (${error.status})` }, 502, cors);
      return json({ error: "Coach injoignable" }, 502, cors);
    }
  },
};
