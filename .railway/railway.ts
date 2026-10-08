import { defineRailway, github, project, service } from "railway/iac";

/**
 * Additive Railway deployment definition. Apply only after creating/choosing
 * the intended Railway project and adding its environment variables.
 */
export default defineRailway(() => {
  const web = service("web", {
    source: github("Jason533993292/memecoin-journal"),
    build: "npm run build",
    start: "npm run start",
    healthcheck: "/api/health",
    healthcheckTimeout: 300,
  });

  return project("memecoin-journal", { resources: [web] });
});
